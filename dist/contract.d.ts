/**
 * The connector capability contract.
 *
 * v1 of every connector is read-only, with `list`, `pull`, `health` and
 * `status` capabilities, and write capabilities declared but off, so the same
 * code can later serve agents over MCP.
 *
 * An adapter is the thin layer each connector writes over what it already has:
 * its registry becomes `list`, its extractor becomes `pull`, and its token and
 * run state becomes `health` per tenant and `status` connector-wide. A gateway
 * in front of several adapters then implements nothing of its own — it calls
 * these four methods.
 *
 * Self-contained (no imports) so tests and scripts can load it directly.
 */
/**
 * The read capabilities every v1 connector implements.
 *
 * One list rather than a hand-written union, because `capabilityProblems` used
 * to repeat the names and drifted from the type when `status` was added.
 */
export declare const READ_CAPABILITIES: readonly ["list", "pull", "health", "status"];
export type ReadCapability = (typeof READ_CAPABILITIES)[number];
/**
 * A write this connector *could* do, declared so the capability surface is
 * honest, and switched off so v1 stays read-only.
 *
 * `enabled` is typed to allow `true`, because Zoho Books' cleanup engine will
 * eventually turn one on. It may only be `true` with a `decision`, and
 * `assertWritesOff` and `check:capabilities` enforce that.
 */
export interface WriteOperation {
    /** Stable identifier, used in the guard and in decision rows. */
    name: string;
    label: string;
    /** Platform scopes this operation needs. Requested only when enabled. */
    scopes: string[];
    /** False for everything in v1. */
    enabled: boolean;
    /**
     * The hub `DECISIONS.md` row authorising this write, e.g. "#21". Null while
     * the operation is declared but off.
     */
    decision: string | null;
}
/** What a connector can do, as data rather than as documentation. */
export interface Capabilities {
    /** Platform key: "quickbooks", "zoho-books", "shopify". */
    platform: string;
    /** Which brand's listing this instance serves: "flcpa" or "smallbizdata". */
    brand: string;
    /** Always all four true in v1; present so a partial connector can say so. */
    read: Record<ReadCapability, boolean>;
    /** Every write this connector could make. All `enabled: false` in v1. */
    write: WriteOperation[];
}
/** One connected client: a QuickBooks company, a Zoho Books org, a Shopify store. */
export interface Tenant {
    /** The platform's own key: realmId, organization_id, or shop domain. */
    tenantId: string;
    tenantName: string;
    brand: string;
    /** "sandbox" | "production". Sandbox data never lands in a client dataset. */
    environment: "sandbox" | "production";
    /** BigQuery dataset, fixed at first connect and never recomputed. */
    datasetName: string;
    status: "connected" | "reauth_required" | "disconnected";
    /** ISO 8601. */
    connectedAt: string;
    /** ISO 8601, or null if nothing has synced yet. */
    lastSyncedAt: string | null;
}
export interface PullOptions {
    tenantId: string;
    /**
     * What to ask for. "changes" (the default) extracts everything since the
     * connector's own watermark; "full" reloads everything, and is the only way
     * deletions surface.
     *
     * **The connector owns the watermark** (hub DECISION #22). It stores the last
     * successful sync per tenant and advances it only when a run succeeds, so a
     * caller cannot hand in a stale or clock-skewed date and quietly get less
     * than it expects — the failure that looks like success and surfaces as a
     * trial balance that does not tie.
     *
     * Asking for "changes" is a request, not a promise: with no stored watermark
     * — a first sync, or a platform that has expired its change tracking, as
     * QuickBooks does after ~30 days — the connector does a full load and says so
     * in `PullResult.mode`. Read the result, not the request.
     *
     * Re-pulling one specific window is deliberately not expressible yet. It
     * needs its own option, added when something actually needs it.
     */
    mode?: "full" | "changes";
    /** Restrict to these catalogued entities. Omit for everything catalogued. */
    entities?: string[];
}
/** Per-entity outcome of a pull. */
export interface EntityResult {
    loaded: number;
    deleted: number;
}
/** A pass/fail check recorded against a run. Failures are surfaced, never absorbed. */
export interface QualityCheckResult {
    name: string;
    passed: boolean;
    expected: string | null;
    actual: string | null;
    detail: string | null;
}
/**
 * The outcome of a pull.
 *
 * `status` is "partial" when rows landed but a check failed or pagination
 * stopped short. A caller must never present a partial result as complete —
 * the hub's ground rules and all three connector repos say the same thing, so
 * the type makes it awkward to ignore: `rowsLoaded` is meaningless without
 * `checks` and `truncated`.
 */
export interface PullResult {
    runId: string;
    tenantId: string;
    mode: "full" | "changes";
    status: "succeeded" | "failed" | "partial";
    startedAt: string;
    finishedAt: string;
    rowsLoaded: number;
    /** Platform API calls spent, for budget tracking. */
    readCalls: number;
    perEntity: Record<string, EntityResult>;
    checks: QualityCheckResult[];
    /** True when a page limit or an API error stopped the pull short. */
    truncated: boolean;
    error: string | null;
}
/**
 * Connector health, as distinct from the health of a client's books. Books
 * health is the accountant's cleanup checklist and stays in the connector
 * repos; this is whether the pipe works.
 */
export interface HealthReport {
    tenantId: string;
    ok: boolean;
    /** ISO 8601. */
    checkedAt: string;
    tokenValid: boolean;
    /** ISO 8601, or null when the platform does not say. */
    tokenExpiresAt: string | null;
    lastRun: {
        at: string;
        status: PullResult["status"];
        rowsLoaded: number;
    } | null;
    /** API budget, where the platform meters one. */
    budget: {
        used: number;
        limit: number;
        /** What the limit is measured over, e.g. "month", "day", "minute". */
        window: string;
    } | null;
    /** Plain-language problems. Empty when `ok` is true. */
    problems: string[];
}
/**
 * Whether the integration works at all, as against whether one client's
 * connection does (hub DECISION #23).
 *
 * This exists because the per-tenant answer does not scale into an overview:
 * `health()` checks a token and does a test read, so asking it about 26 tenants
 * costs 26 API calls — against a rate limit, and against a daily quota the
 * connector is already metering for real syncs. A status page must not be able
 * to exhaust the budget it is reporting on.
 */
export interface ConnectorStatus {
    platform: string;
    /** False when the platform itself could not be reached. */
    reachable: boolean;
    /** ISO 8601. */
    checkedAt: string;
    /** How many tenants are in each state, counted from stored state. */
    tenants: Record<Tenant["status"], number>;
    /** The most recent run across every tenant, or null if none has run. */
    lastRun: {
        tenantId: string;
        at: string;
        status: PullResult["status"];
    } | null;
    /** Budget where the platform meters one connector-wide rather than per tenant. */
    budget: {
        used: number;
        limit: number;
        window: string;
    } | null;
    /** Plain-language problems. Empty when `reachable` is true and nothing is broken. */
    problems: string[];
}
/**
 * What every connector implements, and the only surface the gateway, the
 * workbook and later the MCP server depend on.
 */
export interface ConnectorAdapter {
    readonly capabilities: Capabilities;
    /**
     * Every tenant this connector knows about, **including disconnected ones**,
     * each carrying its own `status` (hub DECISION #21). A caller wanting only
     * live connections filters; a caller wanting to know which client stopped
     * sending books needs exactly the rows that filtering would have hidden.
     */
    list(): Promise<Tenant[]>;
    pull(options: PullOptions): Promise<PullResult>;
    /** One tenant, in detail. Costs API calls: a token check and a test read. */
    health(tenantId: string): Promise<HealthReport>;
    /**
     * The whole connector, cheaply. Implementations must answer from stored state
     * plus at most one reachability probe — **never a call per tenant**, which is
     * the entire reason this is separate from `health`.
     */
    status(): Promise<ConnectorStatus>;
}
/** Write operations that are declared, whether on or off. */
export declare function declaredWrites(capabilities: Capabilities): WriteOperation[];
/** Write operations that are actually switched on. Empty in v1. */
export declare function enabledWrites(capabilities: Capabilities): WriteOperation[];
/**
 * Problems with a capability declaration, or [] if it is sound. Separate from
 * `assertWritesOff` so the guard can report every problem at once rather than
 * throwing on the first.
 */
export declare function capabilityProblems(capabilities: Capabilities): string[];
/**
 * Throw unless every write is off, or on with a decision. Call this where a
 * connector builds its adapter, so a mistake fails at startup rather than
 * reaching a client's books.
 */
export declare function assertWritesOff(capabilities: Capabilities): void;
//# sourceMappingURL=contract.d.ts.map