/**
 * The connector capability contract.
 *
 * v1 of every connector is read-only, with `list`, `pull` and `health`
 * capabilities, and write capabilities declared but off, so the same code can
 * later serve agents over MCP.
 *
 * An adapter is the thin layer each connector writes over what it already has:
 * its registry becomes `list`, its extractor becomes `pull`, and its token and
 * run state becomes `health`. A gateway in front of several adapters then
 * implements nothing of its own — it calls these three methods.
 *
 * Self-contained (no imports) so tests and scripts can load it directly.
 */

/** The three read capabilities every v1 connector implements. */
export type ReadCapability = "list" | "pull" | "health";

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
  /** Always all three true in v1; present so a partial connector can say so. */
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
   * Incremental watermark, ISO 8601. Omit for a full load. A connector whose
   * platform expires change tracking (QuickBooks drops it after ~30 days) must
   * ignore a watermark that is too old and report `mode: "full"` instead of
   * quietly syncing less.
   */
  changedSince?: string;
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
 * What every connector implements, and the only surface the gateway, the
 * workbook and later the MCP server depend on.
 */
export interface ConnectorAdapter {
  readonly capabilities: Capabilities;
  /** Every tenant this connector knows about, including disconnected ones. */
  list(): Promise<Tenant[]>;
  pull(options: PullOptions): Promise<PullResult>;
  health(tenantId: string): Promise<HealthReport>;
}

/** Write operations that are declared, whether on or off. */
export function declaredWrites(capabilities: Capabilities): WriteOperation[] {
  return capabilities.write;
}

/** Write operations that are actually switched on. Empty in v1. */
export function enabledWrites(capabilities: Capabilities): WriteOperation[] {
  return capabilities.write.filter((w) => w.enabled);
}

/**
 * Problems with a capability declaration, or [] if it is sound. Separate from
 * `assertWritesOff` so the guard can report every problem at once rather than
 * throwing on the first.
 */
export function capabilityProblems(capabilities: Capabilities): string[] {
  const problems: string[] = [];

  for (const capability of ["list", "pull", "health"] as ReadCapability[]) {
    if (!capabilities.read[capability]) {
      problems.push(
        `${capabilities.platform}: read capability "${capability}" is off. v1 implements all three.`,
      );
    }
  }

  const seen = new Set<string>();
  for (const write of capabilities.write) {
    if (seen.has(write.name)) {
      problems.push(`${capabilities.platform}: duplicate write operation "${write.name}".`);
    }
    seen.add(write.name);

    if (write.enabled && !write.decision) {
      problems.push(
        `${capabilities.platform}: write operation "${write.name}" is enabled with no decision. ` +
          `Add the authorising row to the hub DECISIONS.md and name it here.`,
      );
    }
    if (write.scopes.length === 0) {
      problems.push(
        `${capabilities.platform}: write operation "${write.name}" declares no scopes. ` +
          `Declare what it would need, so the cost of enabling it is visible.`,
      );
    }
  }

  return problems;
}

/**
 * Throw unless every write is off, or on with a decision. Call this where a
 * connector builds its adapter, so a mistake fails at startup rather than
 * reaching a client's books.
 */
export function assertWritesOff(capabilities: Capabilities): void {
  const problems = capabilityProblems(capabilities);
  if (problems.length > 0) {
    throw new Error(`Unsound capability declaration:\n  - ${problems.join("\n  - ")}`);
  }
}
