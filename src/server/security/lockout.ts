/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Account lockout service — tracks failed login attempts and enforces lockout.
 * Uses an in-memory store with automatic cleanup (production should use Redis).
 */

import type { AppLogger } from '../logger.js';

interface FailedAttempt {
  count: number;
  firstFailure: number;
  lockedUntil: number | null;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_MS = 30 * 60 * 1000; // Reset failures after 30 min of no attempts

export class AccountLockoutService {
  private failures = new Map<string, FailedAttempt>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(private logger: AppLogger) {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000).unref();
  }

  /** Record a failed login attempt. Returns true if the account is now locked. */
  recordFailure(key: string): { locked: boolean; remainingAttempts: number } {
    const now = Date.now();
    const entry = this.failures.get(key);

    if (!entry || now - entry.firstFailure > WINDOW_MS) {
      this.failures.set(key, { count: 1, firstFailure: now, lockedUntil: null });
      return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - 1 };
    }

    entry.count++;

    if (entry.count >= MAX_FAILED_ATTEMPTS) {
      entry.lockedUntil = now + LOCKOUT_DURATION_MS;
      this.logger.warn({ key, attempts: entry.count }, 'Account locked due to repeated failed logins');
      return { locked: true, remainingAttempts: 0 };
    }

    return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS - entry.count };
  }

  /** Check if a key (email or IP) is currently locked. */
  isLocked(key: string): boolean {
    const entry = this.failures.get(key);
    if (!entry?.lockedUntil) return false;
    if (Date.now() > entry.lockedUntil) {
      this.failures.delete(key);
      return false;
    }
    return true;
  }

  /** Get remaining lockout time in seconds, or 0 if not locked. */
  remainingLockoutSeconds(key: string): number {
    const entry = this.failures.get(key);
    if (!entry?.lockedUntil || Date.now() > entry.lockedUntil) return 0;
    return Math.ceil((entry.lockedUntil - Date.now()) / 1000);
  }

  /** Reset lockout for a key (used on successful login or admin unlock). */
  reset(key: string): void {
    this.failures.delete(key);
  }

  /** Admin: unlock a specific key. */
  unlock(key: string): boolean {
    const existed = this.failures.has(key);
    this.failures.delete(key);
    return existed;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.failures) {
      if (entry.lockedUntil && now > entry.lockedUntil) this.failures.delete(key);
      else if (!entry.lockedUntil && now - entry.firstFailure > WINDOW_MS) this.failures.delete(key);
    }
  }
}
