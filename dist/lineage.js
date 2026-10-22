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
/** Checks that did not pass. Empty on a clean run. */
export function failedChecks(run) {
    return run.checks.filter((c) => !c.passed);
}
/**
 * Whether a run's row counts can be quoted as a complete figure.
 *
 * The hub's ground rules say a partial result is never reported as complete.
 * This is the one-line test for that: a run that failed, is still going, or
 * carries a failed check is not a number anyone may put in a total without
 * saying so.
 */
export function isCompleteResult(run) {
    return run.status === "succeeded" && failedChecks(run).length === 0;
}
/** One-line summary for a console or a log. Names the shortfall rather than hiding it. */
export function describeRun(run) {
    const failed = failedChecks(run);
    const rows = `${run.rowsLoaded} row${run.rowsLoaded === 1 ? "" : "s"}`;
    if (run.status === "running")
        return `Running since ${run.startedAt}; ${rows} so far.`;
    if (run.status === "failed")
        return `Failed: ${run.error ?? "no error recorded"}.`;
    if (failed.length > 0 || run.status === "partial") {
        const names = failed.map((c) => c.name).join(", ");
        return `Partial: ${rows} loaded, ${failed.length} check${failed.length === 1 ? "" : "s"} failed${names ? ` (${names})` : ""}. Not a complete figure.`;
    }
    return `Succeeded: ${rows} loaded in ${run.readCalls} read calls.`;
}
//# sourceMappingURL=lineage.js.map