/**
 * Encryption for OAuth tokens at rest.
 *
 * A platform access or refresh token can read a client's entire ledger or
 * store, so it is never stored in plain text. AES-256-GCM with a key from the
 * connector's own `TOKEN_ENCRYPTION_KEY` (32 bytes, base64). In production that
 * key comes from Secret Manager.
 *
 * Format: "v1:<iv>:<auth tag>:<ciphertext>", each part base64. The version
 * prefix allows key rotation later without guessing at old formats.
 *
 * Consolidated from the connectors that had grown their own byte-identical
 * copy of it, so there is one implementation to review rather than several.
 *
 * Self-contained (node:crypto only) so tests can load it directly.
 */
export declare function loadKey(base64: string | undefined): Buffer;
export declare function encrypt(plaintext: string, key: Buffer): string;
export declare function decrypt(sealed: string, key: Buffer): string;
//# sourceMappingURL=crypto.d.ts.map