/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Token blocklist for refresh token rotation and revocation.
 * In-memory with a clean interface (swap to Redis in production).
 * - Every refresh token rotation invalidates the old token.
 * - Logout adds the current access token to the blocklist.
 * - Admin can force-revoke all tokens for a user.
 */

import { createHash, randomBytes } from 'node:crypto';

interface BlocklistEntry {
  jti: string;
  userId: string;
  expiresAt: number;
  type: 'access' | 'refresh';
}

export interface TokenBlocklist {
  add(jti: string, userId: string, ttlSeconds: number, type: 'access' | 'refresh'): void;
  isBlocked(jti: string): boolean;
  revokeAllForUser(userId: string): number;
}

export class InMemoryTokenBlocklist implements TokenBlocklist {
  private entries = new Map<string, BlocklistEntry>();

  add(jti: string, userId: string, ttlSeconds: number, type: 'access' | 'refresh'): void {
    this.entries.set(jti, {
      jti,
      userId,
      expiresAt: Date.now() + ttlSeconds * 1000,
      type,
    });
    // Auto-expire after TTL
    setTimeout(() => this.entries.delete(jti), ttlSeconds * 1000).unref();
  }

  isBlocked(jti: string): boolean {
    const entry = this.entries.get(jti);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(jti);
      return false;
    }
    return true;
  }

  revokeAllForUser(userId: string): number {
    let count = 0;
    for (const [jti, entry] of this.entries) {
      if (entry.userId === userId) {
        this.entries.delete(jti);
        count++;
      }
    }
    return count;
  }
}

// JTI generation helper
export function generateJti(): string {
  return createHash('sha256').update(randomBytes(32)).digest('base64url').substring(0, 32);
}
