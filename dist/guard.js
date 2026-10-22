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
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
const METHOD = /method\s*:\s*["'`](\w+)["'`]/g;
function walk(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory())
            out.push(...walk(full));
        else if (/\.(ts|tsx|js|mjs)$/.test(name))
            out.push(full);
    }
    return out;
}
/** Normalise a path to forward slashes, for messages and comparisons. */
function norm(path) {
    return path.split(sep).join("/");
}
/**
 * Problems found, or [] when the repo is sound. Returns every problem rather
 * than throwing on the first, so one run shows all the work.
 */
export function readOnlyProblems(options) {
    const { root, dirs = ["app", "scripts"], allowedHostFiles, hostPattern, clientFile, clientInterface, oauthFile, allowedOAuthPostTargets = ["TOKEN_URL", "REVOKE_URL"], writeMechanics = [], writerFile, skip = [], } = options;
    const problems = [];
    const allowedHosts = new Set(allowedHostFiles.map(norm));
    const skipped = new Set(skip.map(norm));
    const files = dirs
        .flatMap((d) => {
        try {
            return walk(join(root, d));
        }
        catch {
            return []; // A connector without a scripts/ directory is not a problem.
        }
    })
        .map((f) => norm(relative(root, f)));
    if (files.length === 0) {
        return [`No files found under ${dirs.join(", ")}. Check the guard's root and dirs.`];
    }
    for (const file of files) {
        if (skipped.has(file))
            continue;
        const text = readFileSync(join(root, file), "utf8");
        // Who may talk to the platform at all. Comment lines do not count, so the
        // modules can explain themselves.
        const namesHost = text
            .split("\n")
            .some((line) => hostPattern.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line));
        if (namesHost && !allowedHosts.has(file)) {
            problems.push(`${file}: references a platform host. Only ${[...allowedHosts].join(", ")} may.`);
        }
        // HTTP methods in the two modules that are allowed to make calls.
        for (const match of text.matchAll(METHOD)) {
            const method = match[1].toUpperCase();
            if (file === norm(clientFile) && method !== "GET") {
                problems.push(`${file}: the read client sends ${method}. It must be GET-only.`);
            }
            if (file === norm(oauthFile) && method !== "GET" && method !== "POST") {
                problems.push(`${file}: the OAuth module sends ${method}.`);
            }
        }
        if (file === norm(oauthFile)) {
            const posts = [
                ...text.matchAll(/fetch\(\s*([A-Za-z_][\w.]*)\s*,\s*\{\s*method:\s*["'`]POST["'`]/g),
            ].map((m) => m[1]);
            for (const target of posts) {
                if (!allowedOAuthPostTargets.includes(target)) {
                    problems.push(`${file}: POSTs to ${target}. Only ${allowedOAuthPostTargets.join(" and ")} are allowed.`);
                }
            }
        }
        // Write mechanics anywhere outside the writer module, if there is one.
        if (!writerFile || file !== norm(writerFile)) {
            for (const { pattern, label } of writeMechanics) {
                if (pattern.test(text))
                    problems.push(`${file}: uses ${label}.`);
            }
        }
    }
    // The read client must expose reads only.
    if (clientInterface) {
        const clientText = readFileSync(join(root, clientFile), "utf8");
        const body = new RegExp(`interface ${clientInterface}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(clientText)?.[1] ?? "";
        const members = [...body.matchAll(/^\s*(\w+)\s*[<(]/gm)].map((m) => m[1]);
        if (members.join(",") !== "get") {
            problems.push(`${norm(clientFile)}: ${clientInterface} exposes [${members.join(", ")}]; it may only expose get.`);
        }
    }
    return problems;
}
/** Count of files the guard would scan. Reported on success, as both originals do. */
export function scannedFileCount(root, dirs = ["app", "scripts"]) {
    return dirs.flatMap((d) => {
        try {
            return walk(join(root, d));
        }
        catch {
            return [];
        }
    }).length;
}
//# sourceMappingURL=guard.js.map