import { createHmac, randomBytes } from 'node:crypto';

const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30; // seconds

/**
 * Generate a new TOTP secret (20 bytes, base32-encoded).
 */
export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  return base32Encode(bytes);
}

/**
 * Generate an otpauth:// URI for QR code display.
 */
export function generateTotpUri(secret: string, email: string, issuer = 'BoutinlyCRM'): string {
  const encoded = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${encoded}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

/**
 * Verify a TOTP code against a secret.
 * Accepts codes from the current, previous, or next time window (drift tolerance of ±1 period).
 */
export function verifyTotp(secret: string, code: string): boolean {
  if (code.length !== TOTP_DIGITS) return false;

  const counter = Math.floor(Date.now() / 1000 / TOTP_PERIOD);

  // Check current, previous, and next windows
  for (let offset = -1; offset <= 1; offset++) {
    if (computeTotp(secret, counter + offset) === code) {
      return true;
    }
  }

  return false;
}

function computeTotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const counterBytes = Buffer.alloc(8);
  // RFC 4226: counter as 8-byte big-endian
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = c & 0xff;
    c = Math.floor(c / 256);
  }

  const hmac = createHmac('sha1', key).update(counterBytes).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binCode % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

// ─── Base32 encoding/decoding (RFC 4648) ───────────────

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function base32Decode(encoded: string): Buffer {
  const sanitized = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of sanitized) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}
