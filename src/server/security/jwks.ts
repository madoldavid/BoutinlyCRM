/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * JWT key management with rotation support.
 * Keys are versioned. The current key signs new tokens.
 * Old keys are retained for verification during the grace period.
 * Exposes a JWKS endpoint at /.well-known/jwks.json.
 */

import { createHmac, randomBytes } from 'node:crypto';

interface JwkKey {
  kty: 'oct';
  kid: string;
  alg: 'HS256';
  k: string;  // base64url-encoded key
  use: 'sig';
}

export interface KeyVersion {
  version: string;
  secret: Buffer;
  createdAt: number;
  active: boolean;
}

export class KeyManager {
  private keys: Map<string, KeyVersion> = new Map();
  private currentVersion: string;

  /**
   * Initialize with the base JWT_SECRET and optionally additional keys.
   * Keys are versioned as v1, v2, etc.
   */
  constructor(baseSecret: string) {
    const v1: KeyVersion = {
      version: 'v1',
      secret: Buffer.from(baseSecret),
      createdAt: Date.now(),
      active: true,
    };
    this.keys.set('v1', v1);
    this.currentVersion = 'v1';
  }

  /** Get the current active signing key. */
  getCurrentKey(): KeyVersion {
    return this.keys.get(this.currentVersion)!;
  }

  /** Get a key by version (for verification). Returns undefined if not found. */
  getKey(version: string): KeyVersion | undefined {
    return this.keys.get(version);
  }

  /** Get all active verification keys. */
  getVerificationKeys(): KeyVersion[] {
    return Array.from(this.keys.values()).filter(k => k.active);
  }

  /** Rotate to a new key. Returns the new version string. */
  rotate(): string {
    const idx = this.keys.size + 1;
    const version = `v${idx}`;
    const secret = randomBytes(64);
    const newKey: KeyVersion = {
      version,
      secret,
      createdAt: Date.now(),
      active: true,
    };
    this.keys.set(version, newKey);
    this.currentVersion = version;

    // Deactivate keys older than 2 rotations
    for (const [ver, key] of this.keys) {
      if (key.active && ver !== version && this.keys.size > 3) {
        const ageHours = (Date.now() - key.createdAt) / 3600_000;
        if (ageHours > 48) {
          key.active = false;
        }
      }
    }

    return version;
  }

  /** Build a JWKS response for the current active keys. */
  getJwks(): { keys: JwkKey[] } {
    const jwksKeys: JwkKey[] = [];
    for (const key of this.getVerificationKeys()) {
      jwksKeys.push({
        kty: 'oct',
        kid: key.version,
        alg: 'HS256',
        k: key.secret.toString('base64url'),
        use: 'sig',
      });
    }
    return { keys: jwksKeys };
  }

  /** Sign data with the current key using HMAC-SHA256. */
  sign(data: string): { signature: string; kid: string } {
    const key = this.getCurrentKey();
    const sig = createHmac('sha256', key.secret).update(data).digest('base64url');
    return { signature: sig, kid: key.version };
  }

  /** Verify a signature against the specified key version. */
  verify(data: string, signature: string, kid: string): boolean {
    const key = this.keys.get(kid);
    if (!key || !key.active) return false;
    const expected = createHmac('sha256', key.secret).update(data).digest('base64url');
    try {
      return cryptoTimingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}

function cryptoTimingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
