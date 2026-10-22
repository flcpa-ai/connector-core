/**
 * BigQuery dataset naming.
 *
 * `<prefix><tenant>`: one dataset per connected client, named from the
 * client's own name, with a prefix identifying the connector and the brand it
 * serves. The prefix keeps a connector's datasets from colliding with any
 * other loader's.
 *
 * No platform offers a stable human-readable key: company and org names change
 * and are not unique, and the platform's own id is an opaque number. So the
 * dataset name is derived from the tenant name once, at first connect, stored
 * on the tenant row, and never recomputed — a rename must never move or split
 * a client's data.
 *
 * Consolidated from connectors whose copies differed only in saying "company"
 * or "org"; both are "tenant" here.
 * QuickBooks' `environment: "sandbox" | "production"` and Zoho's `dev` boolean
 * are both expressed as `dev`, which is what the prefix actually means.
 *
 * Self-contained (no imports) so tests can load it directly.
 */
/** Slug for a tenant name: lowercase, underscore-separated, never empty. */
export declare function slugForTenant(tenantName: string): string;
/** Sandbox, test and demo tenants land in clearly marked, auto-expiring datasets. */
export declare const DEV_PREFIX = "dev_";
export interface DatasetNameOptions {
    /** The connector's dataset prefix, identifying the source and the brand. */
    prefix: string;
    tenantName: string;
    /** The platform's own id, appended only to break a collision. */
    tenantId: string;
    /** Whether a name is already used by another tenant. */
    taken: (name: string) => boolean;
    /** Sandbox or test tenant. Gets the dev_ prefix. Defaults to false. */
    dev?: boolean;
}
/**
 * Dataset name for a newly connected tenant. On a collision the platform id is
 * appended, which is unique, so the result never collides. Dev tenants get the
 * dev_ prefix so test data can never be mistaken for a client's.
 */
export declare function datasetNameFor(options: DatasetNameOptions): string;
//# sourceMappingURL=dataset.d.ts.map