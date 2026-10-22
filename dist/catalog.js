/**
 * Data catalog types and field minimization.
 *
 * The catalog is the declared, reviewable record of every object a connector
 * reads, why, and how sensitive it is. The rule is the same in all three
 * connector repos: if you cannot write an honest, specific rationale tying an
 * object to accounting or tax work, do not collect it. It drives the
 * client-facing transparency page, the platform's protected-data
 * justification, and which entities the extractor may pull.
 *
 * The *contents* stay in each connector repo — the catalogues share almost no
 * entity names, and each one is reviewed against its own platform's rules.
 * What is here is the shape they agree on, plus the minimizer, whose logic was
 * the same in each repo while its field lists were not.
 *
 * Self-contained (no imports) so tests can load it directly.
 */
/** Whether an entity name is catalogued, and so allowed to be requested. */
export function isCataloged(catalog, name) {
    return catalog.some((e) => e.name === name);
}
/** Catalogued entities that carry personal data, for the protected-data review. */
export function personalEntities(catalog) {
    return catalog.filter((e) => e.sensitivity === "personal");
}
/**
 * Problems with a catalog, or [] if it is sound. Run this in each connector's
 * tests: the catalog is a compliance document, and a missing rationale is the
 * kind of thing that is only noticed during app review.
 */
export function catalogProblems(catalog) {
    const problems = [];
    const seen = new Set();
    for (const entity of catalog) {
        if (seen.has(entity.name))
            problems.push(`${entity.name}: listed more than once.`);
        seen.add(entity.name);
        if (entity.rationale.trim().length < 20) {
            problems.push(`${entity.name}: rationale is too short to be honest about why it is collected.`);
        }
        if (entity.purposes.length === 0) {
            problems.push(`${entity.name}: no purpose declared.`);
        }
    }
    return problems;
}
/**
 * Strip contact details from a platform record, recursively. Returns a new
 * value; the input is not modified.
 *
 * Data minimization is a review requirement on every platform, and doing it
 * here — before the record reaches BigQuery — is what makes the transparency
 * page's claims true. Addresses keep only region, postal code and country,
 * which is what sales-tax work actually needs.
 */
export function minimize(value, options) {
    const dropped = new Set(options.droppedFields);
    const kept = new Set(options.addressKeptFields);
    const walk = (node) => {
        if (Array.isArray(node))
            return node.map(walk);
        if (node === null || typeof node !== "object")
            return node;
        const out = {};
        for (const [key, child] of Object.entries(node)) {
            if (dropped.has(key))
                continue;
            if (options.addressPattern.test(key) && child && typeof child === "object" && !Array.isArray(child)) {
                out[key] = Object.fromEntries(Object.entries(child).filter(([k]) => kept.has(k)));
                continue;
            }
            out[key] = walk(child);
        }
        return out;
    };
    return walk(value);
}
//# sourceMappingURL=catalog.js.map