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
export const READ_CAPABILITIES = ["list", "pull", "health", "status"];
/** Write operations that are declared, whether on or off. */
export function declaredWrites(capabilities) {
    return capabilities.write;
}
/** Write operations that are actually switched on. Empty in v1. */
export function enabledWrites(capabilities) {
    return capabilities.write.filter((w) => w.enabled);
}
/**
 * Problems with a capability declaration, or [] if it is sound. Separate from
 * `assertWritesOff` so the guard can report every problem at once rather than
 * throwing on the first.
 */
export function capabilityProblems(capabilities) {
    const problems = [];
    for (const capability of READ_CAPABILITIES) {
        if (!capabilities.read[capability]) {
            problems.push(`${capabilities.platform}: read capability "${capability}" is off. ` +
                `v1 implements all ${READ_CAPABILITIES.length}.`);
        }
    }
    const seen = new Set();
    for (const write of capabilities.write) {
        if (seen.has(write.name)) {
            problems.push(`${capabilities.platform}: duplicate write operation "${write.name}".`);
        }
        seen.add(write.name);
        if (write.enabled && !write.decision) {
            problems.push(`${capabilities.platform}: write operation "${write.name}" is enabled with no decision. ` +
                `Add the authorising row to the hub DECISIONS.md and name it here.`);
        }
        if (write.scopes.length === 0) {
            problems.push(`${capabilities.platform}: write operation "${write.name}" declares no scopes. ` +
                `Declare what it would need, so the cost of enabling it is visible.`);
        }
    }
    return problems;
}
/**
 * Throw unless every write is off, or on with a decision. Call this where a
 * connector builds its adapter, so a mistake fails at startup rather than
 * reaching a client's books.
 */
export function assertWritesOff(capabilities) {
    const problems = capabilityProblems(capabilities);
    if (problems.length > 0) {
        throw new Error(`Unsound capability declaration:\n  - ${problems.join("\n  - ")}`);
    }
}
//# sourceMappingURL=contract.js.map