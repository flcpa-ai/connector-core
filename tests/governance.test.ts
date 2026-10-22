import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt, loadKey } from "../src/crypto.ts";
import { DEV_PREFIX, datasetNameFor, slugForTenant } from "../src/dataset.ts";
import { formatMoney, multiplyMoney, parseMoney } from "../src/money.ts";
import { catalogProblems, minimize, personalEntities, type CatalogEntity } from "../src/catalog.ts";
import { describeRun, failedChecks, isCompleteResult, type ExtractionRunRecord } from "../src/lineage.ts";

const key = randomBytes(32);
const never = () => false;

// ---------------------------------------------------------------- money

test("money parses and formats without floating-point drift", () => {
  assert.equal(formatMoney(parseMoney("1201.00")!), "1201.00");
  assert.equal(formatMoney(parseMoney("-5.25")!), "-5.25");
  assert.equal(formatMoney(parseMoney("20.0")!), "20.00");
});

test("0.1 + 0.2 is exact, which is the whole point", () => {
  const sum = parseMoney("0.1")! + parseMoney("0.2")!;
  assert.equal(formatMoney(sum), "0.30");
});

test("a quantity times a unit price stays exact over many lines", () => {
  const unit = parseMoney("19.99")!;
  let total = 0n;
  for (let i = 0; i < 1000; i++) total += multiplyMoney(unit, 3);
  assert.equal(formatMoney(total), "59970.00");
});

test("unparseable money returns null rather than zero", () => {
  for (const bad of ["", "abc", "1,201.00", "$5", "1.2.3", "1e5"]) {
    assert.equal(parseMoney(bad), null, `${bad} should not parse`);
  }
});

test("formatting rounds half-up at the requested precision", () => {
  assert.equal(formatMoney(parseMoney("1.005")!), "1.01");
  assert.equal(formatMoney(parseMoney("2.5")!, 0), "3");
});

// --------------------------------------------------------------- crypto

test("tokens round-trip through encryption", () => {
  const sealed = encrypt("refresh-token-value", key);
  assert.ok(sealed.startsWith("v1:"));
  assert.ok(!sealed.includes("refresh-token-value"));
  assert.equal(decrypt(sealed, key), "refresh-token-value");
});

test("the same token encrypts differently each time", () => {
  assert.notEqual(encrypt("x", key), encrypt("x", key));
});

test("tampered ciphertext is rejected", () => {
  const parts = encrypt("secret", key).split(":");
  parts[3] = Buffer.from("tampered").toString("base64");
  assert.throws(() => decrypt(parts.join(":"), key));
});

test("a key of the wrong length is refused", () => {
  assert.throws(() => loadKey(randomBytes(16).toString("base64")), /32 bytes/);
  assert.throws(() => loadKey(undefined), /not set/);
});

// -------------------------------------------------------------- dataset

test("tenant names become safe BigQuery slugs", () => {
  assert.equal(slugForTenant("Acme Supply Co."), "acme_supply_co");
  assert.equal(slugForTenant("Smith & Sons"), "smith_and_sons");
  assert.equal(slugForTenant("Café Noël"), "cafe_noel");
  assert.equal(slugForTenant("!!!"), "tenant");
});

test("dataset names carry the connector prefix", () => {
  assert.equal(
    datasetNameFor({ prefix: "zohobooks_", tenantName: "Acme Supply", tenantId: "9001", taken: never }),
    "zohobooks_acme_supply",
  );
});

test("a dev tenant is unmistakable", () => {
  const name = datasetNameFor({
    prefix: "shopify_",
    tenantName: "Test Store",
    tenantId: "test.myshopify.com",
    taken: never,
    dev: true,
  });
  assert.ok(name.startsWith(DEV_PREFIX));
});

test("a collision appends the platform id, slugged so a shop domain stays valid", () => {
  const name = datasetNameFor({
    prefix: "shopify_",
    tenantName: "Acme",
    tenantId: "acme.myshopify.com",
    taken: (n) => n === "shopify_acme",
  });
  assert.equal(name, "shopify_acme_acme_myshopify_com");
  assert.doesNotMatch(name, /[^a-z0-9_]/);
});

// -------------------------------------------------------------- catalog

const catalog: CatalogEntity[] = [
  {
    name: "Account",
    label: "Chart of accounts",
    kind: "entity",
    sensitivity: "business",
    purposes: ["financial-reporting"],
    rationale: "Every balance and transaction maps to an account; tax workpapers map accounts to return lines.",
  },
  {
    name: "Customer",
    label: "Customers",
    kind: "entity",
    sensitivity: "personal",
    purposes: ["reconciliation"],
    rationale: "Invoices must be attributed to a payer to reconcile receipts against deposits.",
  },
];

test("a sound catalog has no problems", () => {
  assert.deepEqual(catalogProblems(catalog), []);
});

test("a rationale too short to be honest is rejected", () => {
  const problems = catalogProblems([{ ...catalog[0], rationale: "needed" }]);
  assert.match(problems.join("\n"), /rationale is too short/);
});

test("an entity with no declared purpose is rejected", () => {
  assert.match(catalogProblems([{ ...catalog[0], purposes: [] }]).join("\n"), /no purpose declared/);
});

test("personal entities can be listed for the protected-data review", () => {
  assert.deepEqual(personalEntities(catalog).map((e) => e.name), ["Customer"]);
});

test("minimize drops contact details and reduces addresses", () => {
  const options = {
    droppedFields: ["PrimaryEmailAddr", "PrimaryPhone", "GivenName"],
    addressPattern: /Addr$/,
    addressKeptFields: ["CountrySubDivisionCode", "PostalCode", "Country"],
  };
  const record = {
    Id: "42",
    GivenName: "Dana",
    PrimaryEmailAddr: { Address: "dana@example.com" },
    PrimaryPhone: { FreeFormNumber: "555-0100" },
    BillAddr: { Line1: "1 Main St", City: "Chicago", CountrySubDivisionCode: "IL", PostalCode: "60601", Country: "US" },
    Balance: "120.00",
  };

  const out = minimize(record, options) as Record<string, unknown>;
  assert.deepEqual(Object.keys(out), ["Id", "BillAddr", "Balance"]);
  assert.deepEqual(out.BillAddr, { CountrySubDivisionCode: "IL", PostalCode: "60601", Country: "US" });
  assert.ok(!JSON.stringify(out).includes("dana@example.com"));
  assert.ok(!JSON.stringify(out).includes("1 Main St"));
});

test("minimize recurses into arrays and leaves the input alone", () => {
  const options = { droppedFields: ["Email"], addressPattern: /Addr$/, addressKeptFields: [] };
  const input = { Lines: [{ Email: "a@b.c", Amount: "1.00" }] };

  const out = minimize(input, options) as { Lines: Record<string, unknown>[] };
  assert.deepEqual(out.Lines, [{ Amount: "1.00" }]);
  assert.equal(input.Lines[0].Email, "a@b.c");
});

// -------------------------------------------------------------- lineage

function run(overrides: Partial<ExtractionRunRecord> = {}): ExtractionRunRecord {
  return {
    id: "run_1",
    tenantId: "9001",
    mode: "changes",
    status: "succeeded",
    startedBy: "schedule",
    startedAt: "2026-10-21T06:00:00.000Z",
    finishedAt: "2026-10-21T06:04:00.000Z",
    changedSince: "2026-10-14T06:00:00.000Z",
    readCalls: 120,
    rowsLoaded: 4_210,
    perEntity: { Invoice: { loaded: 4_210, deleted: 0, mode: "changes" } },
    checks: [{ name: "trial balance ties", passed: true, expected: "0.00", actual: "0.00", detail: null }],
    error: null,
    ...overrides,
  };
}

test("a clean run is a complete figure", () => {
  assert.equal(isCompleteResult(run()), true);
  assert.match(describeRun(run()), /^Succeeded: 4210 rows loaded/);
});

test("a failed check makes the run incomplete even though rows landed", () => {
  const partial = run({
    status: "partial",
    checks: [{ name: "trial balance ties", passed: false, expected: "0.00", actual: "12.50", detail: null }],
  });

  assert.equal(isCompleteResult(partial), false);
  assert.equal(failedChecks(partial).length, 1);
  assert.match(describeRun(partial), /Not a complete figure/);
  assert.match(describeRun(partial), /trial balance ties/);
});

test("a succeeded status cannot hide a failed check", () => {
  const sneaky = run({
    status: "succeeded",
    checks: [{ name: "order count matches", passed: false, expected: "900", actual: "880", detail: null }],
  });

  assert.equal(isCompleteResult(sneaky), false);
});

test("a failed run says why", () => {
  assert.match(describeRun(run({ status: "failed", error: "token expired" })), /Failed: token expired/);
});
