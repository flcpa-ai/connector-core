/**
 * Exact decimal money arithmetic.
 *
 * Every platform returns money amounts as decimal strings: QuickBooks
 * "1201.00", Shopify "20.0", Zoho Books "-5.25". Parsing those into JavaScript
 * numbers and multiplying by quantities introduces binary floating-point
 * drift, which is not acceptable in figures that feed a balance sheet.
 * Everything here works in integer minor units via BigInt instead.
 *
 * Consolidated from the connectors that had grown their own copy of it; the
 * copies were byte-identical apart from a comment naming the platform.
 *
 * Self-contained (no imports) so tests can load it directly.
 */
/**
 * Parse a decimal money string into a BigInt scaled by 10^SCALE.
 * Returns null for anything that is not a plain decimal number, so callers must
 * decide how to treat unparseable input rather than silently getting zero.
 */
export declare function parseMoney(amount: string): bigint | null;
/** Multiply a scaled money value by a whole quantity. */
export declare function multiplyMoney(scaled: bigint, quantity: number): bigint;
/** Format a scaled money value as a plain decimal string with `places` digits. */
export declare function formatMoney(scaled: bigint, places?: number): string;
//# sourceMappingURL=money.d.ts.map