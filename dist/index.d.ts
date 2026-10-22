/**
 * Everything the connectors consume, in one place.
 *
 * Subpath imports work too, and are preferable where only one module is
 * needed: `@flcpa-ai/connector-core/money`. This barrel is the only file in
 * the package with relative imports, and they carry .js extensions because
 * that is what an emitting ESM TypeScript package needs — see CLAUDE.md.
 */
export type { Capabilities, ConnectorAdapter, EntityResult, HealthReport, PullOptions, PullResult, QualityCheckResult, ReadCapability, Tenant, WriteOperation, } from "./contract.js";
export { assertWritesOff, capabilityProblems, declaredWrites, enabledWrites, } from "./contract.js";
export { formatMoney, multiplyMoney, parseMoney } from "./money.js";
export { decrypt, encrypt, loadKey } from "./crypto.js";
export type { DatasetNameOptions } from "./dataset.js";
export { DEV_PREFIX, datasetNameFor, slugForTenant } from "./dataset.js";
export type { CatalogEntity, ExcludedEntity, MinimizeOptions, Purpose, Sensitivity, } from "./catalog.js";
export { catalogProblems, isCataloged, minimize, personalEntities } from "./catalog.js";
export type { EntityOutcome, ExtractionRunRecord, QualityCheckRecord, } from "./lineage.js";
export { describeRun, failedChecks, isCompleteResult } from "./lineage.js";
export type { ReadOnlyGuardOptions, WriteMechanic } from "./guard.js";
export { readOnlyProblems, scannedFileCount } from "./guard.js";
//# sourceMappingURL=index.d.ts.map