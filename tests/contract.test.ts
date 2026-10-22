import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertWritesOff,
  capabilityProblems,
  declaredWrites,
  enabledWrites,
  type Capabilities,
} from "../src/contract.ts";

/** A v1 connector: all three reads on, one write declared and off. */
function readOnlyCapabilities(): Capabilities {
  return {
    platform: "zoho-books",
    brand: "flcpa",
    read: { list: true, pull: true, health: true },
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
