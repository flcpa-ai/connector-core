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
export type Sensitivity = 
/** Business configuration with no personal information. */
"business"
/** Names or contact details of the client's customers or vendors. */
 | "personal";
export type Purpose = "financial-reporting" | "tax-compliance" | "reconciliation" | "close-monitoring" | "inventory" | "lineage";
export interface CatalogEntity {
    /** The platform's API entity or report name. */
    name: string;
    label: string;
    kind: "entity" | "report" | "metadata";
    sensitivity: Sensitivity;
    purposes: Purpose[];
    /** Why this is collected, in terms a client can check. */
    rationale: string;
}
export interface ExcludedEntity {
    name: string;
    /** Why it is not collected. Shown on the transparency page. */
    reason: string;
}
/** Whether an entity name is catalogued, and so allowed to be requested. */
export declare function isCataloged(catalog: CatalogEntity[], name: string): boolean;
/** Catalogued entities that carry personal data, for the protected-data review. */
export declare function personalEntities(catalog: CatalogEntity[]): CatalogEntity[];
/**
 * Problems with a catalog, or [] if it is sound. Run this in each connector's
 * tests: the catalog is a compliance document, and a missing rationale is the
 * kind of thing that is only noticed during app review.
 */
export declare function catalogProblems(catalog: CatalogEntity[]): string[];
export interface MinimizeOptions {
    /**
     * Field names dropped wherever they appear: emails, phone numbers, street
     * lines, personal name parts. Per platform, since the field names differ.
     */
    droppedFields: readonly string[];
    /**
     * Matches address-shaped objects, whose contents are reduced rather than
     * dropped — e.g. /Addr$/ for QuickBooks' BillAddr and ShipAddr.
     */
    addressPattern: RegExp;
    /** The only address fields kept: region, postal code, country. */
    addressKeptFields: readonly string[];
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
export declare function minimize(value: unknown, options: MinimizeOptions): unknown;
//# sourceMappingURL=catalog.d.ts.map