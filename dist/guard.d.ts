/**
 * The read-only guard, shared.
 *
 * v1 is read-only, but on some platforms the scope alone does not enforce that:
 * an accounting scope may grant read and write together, so a single careless
 * POST would reach a client's books. Connectors answered that with their own
 * near-identical guard scripts, differing only in hostnames and write
 * mechanics. This is that logic once, so every connector runs the same one.
 *
 * Each connector keeps a thin script that supplies its own platform facts and
 * exits non-zero on problems.
 *
 * Reads the filesystem through node:fs only; no platform access of any kind.
 */
/** A platform write mechanic to ban outside the files allowed to write. */
export interface WriteMechanic {
    pattern: RegExp;
    /** Said in the failure message, e.g. "QuickBooks batch endpoint". */
    label: string;
}
export interface ReadOnlyGuardOptions {
    /** Repo root. Paths in problems are reported relative to it. */
    root: string;
    /** Directories to scan. Defaults to app/ and scripts/. */
    dirs?: string[];
    /**
     * The only files allowed to name a platform host: usually the OAuth module,
     * the read client, and any data-center or endpoint table. Repo-relative.
     */
    allowedHostFiles: string[];
    /** Matches the platform's API hostnames. */
    hostPattern: RegExp;
    /** The read client. Must send GET only. Repo-relative. */
    clientFile: string;
    /**
     * The interface the read client exposes, which may expose nothing but `get`.
     * Omit to skip that check.
     */
    clientInterface?: string;
    /** The OAuth module. May POST only to the targets below. Repo-relative. */
    oauthFile: string;
    /** Constant names the OAuth module may POST to. */
    allowedOAuthPostTargets?: string[];
    /** Platform write mechanics, banned everywhere unless `writerFile` allows them. */
    writeMechanics?: WriteMechanic[];
    /**
     * A module deliberately allowed to write, for an app that writes on purpose
     * (app-quickbooks-import). Omit in a read-only connector, which is the point.
     */
    writerFile?: string;
    /** Repo-relative files to skip, such as the calling script itself. */
    skip?: string[];
}
/**
 * Problems found, or [] when the repo is sound. Returns every problem rather
 * than throwing on the first, so one run shows all the work.
 */
export declare function readOnlyProblems(options: ReadOnlyGuardOptions): string[];
/** Count of files the guard would scan. Reported on success, as both originals do. */
export declare function scannedFileCount(root: string, dirs?: string[]): number;
//# sourceMappingURL=guard.d.ts.map