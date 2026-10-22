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
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
const VERSION = "v1";
export function loadKey(base64) {
    if (!base64)
        throw new Error("TOKEN_ENCRYPTION_KEY is not set.");
    const key = Buffer.from(base64, "base64");
    if (key.length !== 32) {
        throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
    }
    return key;
}
export function encrypt(plaintext, key) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [VERSION, iv, tag, ciphertext].map((p) => (typeof p === "string" ? p : p.toString("base64"))).join(":");
}
export function decrypt(sealed, key) {
    const [version, iv, tag, ciphertext] = sealed.split(":");
    if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
        throw new Error("Unrecognized encrypted token format.");
    }
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, "base64")),
        decipher.final(),
    ]).toString("utf8");
}
//# sourceMappingURL=crypto.js.map