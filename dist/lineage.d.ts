/**
 * Lineage records.
 *
 * One record per sync, and every BigQuery row carries its run id, so any figure
 * in a report can be traced back to the call that produced it. All three
 * connectors already store this; the three Prisma models agree on everything
 * below, so these types are the contract between them and anything that reads
 * their runs — the staff consoles today, the gateway later.
 *
 * These are record types, not a storage layer. Each connector keeps its own
 * Prisma schema; this is the shape it maps to on the way out.
 *
 * Self-contained (no imports) so tests can load it directly.
 */
/** A pass/fail check recorded against a run. Failures are surfaced, never absorbed. */
export interface QualityCheckRecord {
    name: string;
    passed: boolean;
    expected: string | null;
    actual: string | null;
    detail: string | null;
}
/** Per-entity outcome within a run. */
export interface EntityOutcome {
    loaded: number;
    deleted: number;
    mode: "full" | "changes";
}
export interface ExtractionRunRecord {
    id: string;
    tenantId: string;
    /** "full" on a first load, or a reload after change tracking expired. */
    mode: "full" | "changes";
    status: "running" | "succeeded" | "failed" | "partial";
    /** Who or what started it: a staff email, "client", or "schedule". */
    startedBy: string;
    /** ISO 8601. */
    startedAt: string;
    /** ISO 8601, or null while still running. */
    finishedAt: string | null;
    /** Change-tracking window start for a "changes" run. ISO 8601. */
    changedSince: string | null;
    readCalls: number;
    rowsLoaded: number;
    perEntity: Record<string, EntityOutcome>;
    checks: QualityCheckRecord[];
    error: string | null;
}
/** Checks that did not pass. Empty on a clean run. */
export declare function failedChecks(run: ExtractionRunRecord): QualityCheckRecord[];
/**
 * Whether a run's row counts can be quoted as a complete figure.
 *
 * The hub's ground rules say a partial result is never reported as complete.
 * This is the one-line test for that: a run that failed, is still going, or
 * carries a failed check is not a number anyone may put in a total without
 * saying so.
 */
export declare function isCompleteResult(run: ExtractionRunRecord): boolean;
/** One-line summary for a console or a log. Names the shortfall rather than hiding it. */
export declare function describeRun(run: ExtractionRunRecord): string;
//# sourceMappingURL=lineage.d.ts.map