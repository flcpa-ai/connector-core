import { test } from "node:test";
import assert from "node:assert/strict";
import {
  READ_CAPABILITIES,
  assertWritesOff,
  capabilityProblems,
  declaredWrites,
  enabledWrites,
  type Capabilities,
  type ConnectorAdapter,
} from "../src/contract.ts";

/** A v1 connector: every read on, one write declared and off. */
function readOnlyCapabilities(): Capabilities {
  return {
    platform: "zoho-books",
    brand: "flcpa",
    read: { list: true, pull: true, health: true, status: true },
    write: [
      {
        name: "tidy-chart-of-accounts",
        label: "Chart Of Accounts Tidy",
        scopes: ["ZohoBooks.settings.UPDATE"],
        enabled: false,
        decision: null,
      },
    ],
  };
}

test("a read-only declaration with a declared, disabled write is sound", () => {
  const capabilities = readOnlyCapabilities();
  assert.deepEqual(capabilityProblems(capabilities), []);
  assert.doesNotThrow(() => assertWritesOff(capabilities));
});

test("declared writes are visible even though none are enabled", () => {
  const capabilities = readOnlyCapabilities();
  assert.equal(declaredWrites(capabilities).length, 1);
  assert.deepEqual(enabledWrites(capabilities), []);
});

test("a write enabled without a decision is rejected", () => {
  const capabilities = readOnlyCapabilities();
  capabilities.write[0].enabled = true;

  const problems = capabilityProblems(capabilities);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /enabled with no decision/);
  assert.throws(() => assertWritesOff(capabilities), /tidy-chart-of-accounts/);
});

test("a write enabled with a decision is allowed", () => {
  const capabilities = readOnlyCapabilities();
  capabilities.write[0].enabled = true;
  capabilities.write[0].decision = "#21";

  assert.deepEqual(capabilityProblems(capabilities), []);
  assert.equal(enabledWrites(capabilities).length, 1);
});

test("a write declaring no scopes is rejected, so the cost of enabling it stays visible", () => {
  const capabilities = readOnlyCapabilities();
  capabilities.write[0].scopes = [];

  assert.match(capabilityProblems(capabilities).join("\n"), /declares no scopes/);
});

test("a missing read capability is reported", () => {
  const capabilities = readOnlyCapabilities();
  capabilities.read.health = false;

  const problems = capabilityProblems(capabilities);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /"health" is off/);
});

test("the connector-level status capability is required, like the other three", () => {
  const capabilities = readOnlyCapabilities();
  capabilities.read.status = false;

  const problems = capabilityProblems(capabilities);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /"status" is off/);
  assert.match(problems[0], /all 4/);
});

test("every capability in the list is checked, so the type cannot drift from the guard", () => {
  for (const capability of READ_CAPABILITIES) {
    const capabilities = readOnlyCapabilities();
    capabilities.read[capability] = false;
    assert.match(
      capabilityProblems(capabilities).join("\n"),
      new RegExp(`"${capability}" is off`),
      `${capability} is in READ_CAPABILITIES but capabilityProblems ignores it`,
    );
  }
});

test("duplicate write names are reported", () => {
  const capabilities = readOnlyCapabilities();
  capabilities.write.push({ ...capabilities.write[0] });

  assert.match(capabilityProblems(capabilities).join("\n"), /duplicate write operation/);
});

test("every problem is reported at once, not just the first", () => {
  const capabilities = readOnlyCapabilities();
  capabilities.read.list = false;
  capabilities.write[0].enabled = true;
  capabilities.write[0].scopes = [];

  assert.equal(capabilityProblems(capabilities).length, 3);
});

/**
 * A conforming adapter, kept here because nothing implements `ConnectorAdapter`
 * yet and a contract no one has written against is a contract no one has
 * tested. `npm run typecheck` is what actually checks this: if a change makes
 * the interface awkward or impossible to satisfy, this stops compiling.
 */
const adapter: ConnectorAdapter = {
  capabilities: readOnlyCapabilities(),

  async list() {
    // Including a tenant that is NOT connected, which is the point of #21.
    return [
      {
        tenantId: "9341453891234567",
        tenantName: "Acme",
        brand: "flcpa",
        environment: "production",
        datasetName: "quickbooks_acme",
        status: "reauth_required",
        connectedAt: "2026-07-01T00:00:00.000Z",
        lastSyncedAt: "2026-10-01T00:00:00.000Z",
      },
    ];
  },

  async pull(options) {
    // The caller asks; the connector decides and reports what it did. Asking
    // for changes with no watermark is a full load.
    const asked = options.mode ?? "changes";
    const watermark: string | null = null;
    const mode = asked === "changes" && watermark ? "changes" : "full";
    return {
      runId: "run_1",
      tenantId: options.tenantId,
      mode,
      status: "succeeded",
      startedAt: "2026-10-22T00:00:00.000Z",
      finishedAt: "2026-10-22T00:01:00.000Z",
      rowsLoaded: 1,
      readCalls: 1,
      perEntity: { Invoice: { loaded: 1, deleted: 0 } },
      checks: [],
      truncated: false,
      error: null,
    };
  },

  async health(tenantId) {
    return {
      tenantId,
      ok: true,
      checkedAt: "2026-10-22T00:00:00.000Z",
      tokenValid: true,
      tokenExpiresAt: null,
      lastRun: null,
      budget: null,
      problems: [],
    };
  },

  async status() {
    return {
      platform: "zoho-books",
      reachable: true,
      checkedAt: "2026-10-22T00:00:00.000Z",
      tenants: { connected: 25, reauth_required: 1, disconnected: 0 },
      lastRun: null,
      budget: { used: 111, limit: 5000, window: "day" },
      problems: [],
    };
  },
};

test("a conforming adapter satisfies the contract", async () => {
  assert.deepEqual(capabilityProblems(adapter.capabilities), []);

  const tenants = await adapter.list();
  assert.equal(tenants.length, 1);
  assert.equal(tenants[0].status, "reauth_required", "list() keeps broken connections visible");

  const result = await adapter.pull({ tenantId: tenants[0].tenantId, mode: "changes" });
  assert.equal(result.mode, "full", "asking for changes with no watermark reports a full load");

  const overview = await adapter.status();
  assert.equal(overview.tenants.reauth_required, 1);
  assert.equal(overview.tenants.connected + overview.tenants.reauth_required, 26);
});
