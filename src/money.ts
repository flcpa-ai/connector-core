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

/** Internal fixed scale. Six places covers every ISO-4217 currency exponent. */
const SCALE = 6;
const SCALE_FACTOR = 10n ** BigInt(SCALE);

/**
 * Parse a decimal money string into a BigInt scaled by 10^SCALE.
 * Returns null for anything that is not a plain decimal number, so callers must
 * decide how to treat unparseable input rather than silently getting zero.
 */
export function parseMoney(amount: string): bigint | null {
  const trimmed = amount.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!match) return null;

  const [, sign, whole, fraction = ""] = match;
  // Pad or truncate the fractional part to exactly SCALE digits.
  const frac = fraction.padEnd(SCALE, "0").slice(0, SCALE);
  const magnitude = BigInt(whole) * SCALE_FACTOR + BigInt(frac);
  return sign === "-" ? -magnitude : magnitude;
}

/** Multiply a scaled money value by a whole quantity. */
export function multiplyMoney(scaled: bigint, quantity: number): bigint {
  return scaled * BigInt(Math.trunc(quantity));
}

/** Format a scaled money value as a plain decimal string with `places` digits. */
export function formatMoney(scaled: bigint, places = 2): string {
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;

  // Round half-up at the requested precision.
  const divisor = 10n ** BigInt(SCALE - places);
  const rounded = (abs + divisor / 2n) / divisor;

  const factor = 10n ** BigInt(places);
  const whole = rounded / factor;
  const frac = rounded % factor;

  const body =
    places === 0
      ? whole.toString()
      : `${whole}.${frac.toString().padStart(places, "0")}`;

  return negative ? `-${body}` : body;
}
