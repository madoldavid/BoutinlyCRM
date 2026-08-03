/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Account lockout service — tracks failed login attempts and enforces lockout.
 * Uses an in-memory store with automatic cleanup (production should use Redis).
 *
 * G-SEC-09: thresholds are configurable (max failures, window, lock duration)
 * and the clock is injectable so boundary behavior is deterministically testable.
 */

import type { AppLogger } from '../logger.js';

interface FailedAttempt {
  count: number;
  firstFailure: number;
  lockedUntil: number | null;
}

export interface LockoutOptions {
  /** Failures within the window that trigger a lock. Default 5. */
  maxFailedAttempts?: number;
  /** How long a lock lasts, in ms. Default 15 minutes. */
  lockoutDurationMs?: number;
  /** Rolling window in which failures accumulate, in ms. Default 30 minutes. */
  windowMs?: number;
  /** Injectable clock for deterministic tests. Default Date.now. */
  now?: () => number;
}

const DEFAULT_MAX_FAILED_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_WINDOW_MS = 30 * 60 * 1000; // Reset failures after 30 min of no attempts

export class AccountLockoutService {
  private failures = new Map<string, FailedAttempt>();
  private cleanupInterval: ReturnType<typeof setInterval>;
  private readonly maxFailedAttempts: number;
  private readonly lockoutDurationMs: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(private logger: AppLogger, options: LockoutOptions = {}) {
    this.maxFailedAttempts = options.maxFailedAttempts ?? DEFAULT_MAX_FAILED_ATTEMPTS;
    this.lockoutDurationMs = options.lockoutDurationMs ?? DEFAULT_LOCKOUT_DURATION_MS;
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.now = options.now ?? Date.now;
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000).unref();
  }

  /** Effective configuration (for messages, admin surfaces, and tests). */
  getConfig(): { maxFailedAttempts: number; lockoutDurationMs: number; windowMs: number } {
    return {
      maxFailedAttempts: this.maxFailedAttempts,
      lockoutDurationMs: this.lockoutDurationMs,
      windowMs: this.windowMs,
    };
  }

  /** Record a failed login attempt. Returns true if the account is now locked. */
  recordFailure(key: string): { locked: boolean; remainingAttempts: number } {
    const now = this.now();
    let entry = this.failures.get(key);

    if (!entry || now - entry.firstFailure > this.windowMs) {
      entry = { count: 0, firstFailure: now, lockedUntil: null };
      this.failures.set(key, entry);
    }

    entry.count++;

    if (entry.count >= this.maxFailedAttempts) {
      entry.lockedUntil = now + this.lockoutDurationMs;
      this.logger.warn({ key, attempts: entry.count }, 'Account locked due to repeated failed logins');
      return { locked: true, remainingAttempts: 0 };
    }

    return { locked: false, remainingAttempts: this.maxFailedAttempts - entry.count };
  }

  /** Check if a key (email or IP) is currently locked. */
  isLocked(key: string): boolean {
    const entry = this.failures.get(key);
    if (!entry?.lockedUntil) return false;
    if (this.now() > entry.lockedUntil) {
      this.failures.delete(key);
      return false;
    }
    return true;
  }

  /** Get remaining lockout time in seconds, or 0 if not locked. */
  remainingLockoutSeconds(key: string): number {
    const entry = this.failures.get(key);
    if (!entry?.lockedUntil || this.now() > entry.lockedUntil) return 0;
    return Math.ceil((entry.lockedUntil - this.now()) / 1000);
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

  /** Clear all lockout state (test harnesses and admin emergency use). */
  resetAll(): void {
    this.failures.clear();
  }

  /** Stop the background cleanup timer (graceful shutdown / test teardown). */
  dispose(): void {
    clearInterval(this.cleanupInterval);
    this.failures.clear();
  }

  private cleanup(): void {
    const now = this.now();
    for (const [key, entry] of this.failures) {
      if (entry.lockedUntil && now > entry.lockedUntil) this.failures.delete(key);
      else if (!entry.lockedUntil && now - entry.firstFailure > this.windowMs) this.failures.delete(key);
    }
  }
}
