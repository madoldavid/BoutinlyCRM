/**
 * G-SEC-09: deterministic boundary tests for the account-lockout service.
 * Uses an injected fake clock so window/duration edges are exact.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { AccountLockoutService } from './lockout.js';
import { createLogger } from '../logger.js';

function makeService(opts: { maxFailedAttempts?: number; lockoutDurationMs?: number; windowMs?: number } = {}) {
  let t = 1_000_000;
  const clock = { advance: (ms: number) => { t += ms; }, now: () => t };
  const service = new AccountLockoutService(createLogger('test'), {
    maxFailedAttempts: opts.maxFailedAttempts ?? 3,
    lockoutDurationMs: opts.lockoutDurationMs ?? 60_000,
    windowMs: opts.windowMs ?? 120_000,
    now: clock.now,
  });
  return { service, clock };
}

describe('AccountLockoutService (G-SEC-09)', () => {
  let disposable: AccountLockoutService | null = null;
  afterEach(() => { disposable?.dispose(); disposable = null; });

  it('does not lock below the threshold', () => {
    const { service } = makeService({ maxFailedAttempts: 3 });
    disposable = service;
    expect(service.recordFailure('k')).toEqual({ locked: false, remainingAttempts: 2 });
    expect(service.recordFailure('k')).toEqual({ locked: false, remainingAttempts: 1 });
    expect(service.isLocked('k')).toBe(false);
  });

  it('locks exactly at the threshold', () => {
    const { service } = makeService({ maxFailedAttempts: 3 });
    disposable = service;
    service.recordFailure('k');
    service.recordFailure('k');
    expect(service.recordFailure('k')).toEqual({ locked: true, remainingAttempts: 0 });
    expect(service.isLocked('k')).toBe(true);
  });

  it('reports remaining lockout seconds and expires after the duration', () => {
    const { service, clock } = makeService({ maxFailedAttempts: 1, lockoutDurationMs: 60_000 });
    disposable = service;
    service.recordFailure('k');
    expect(service.isLocked('k')).toBe(true);
    expect(service.remainingLockoutSeconds('k')).toBe(60);
    clock.advance(59_999);
    expect(service.isLocked('k')).toBe(true);
    clock.advance(2);
    expect(service.isLocked('k')).toBe(false);
    expect(service.remainingLockoutSeconds('k')).toBe(0);
  });

  it('resets the failure count after the window elapses', () => {
    const { service, clock } = makeService({ maxFailedAttempts: 3, windowMs: 120_000 });
    disposable = service;
    service.recordFailure('k');
    service.recordFailure('k');
    clock.advance(120_001); // window expired — counter restarts
    expect(service.recordFailure('k')).toEqual({ locked: false, remainingAttempts: 2 });
    expect(service.isLocked('k')).toBe(false);
  });

  it('keeps counting within the window', () => {
    const { service, clock } = makeService({ maxFailedAttempts: 3, windowMs: 120_000 });
    disposable = service;
    service.recordFailure('k');
    clock.advance(119_000); // still inside the window
    service.recordFailure('k');
    expect(service.recordFailure('k').locked).toBe(true);
  });

  it('reset and unlock clear state per key; resetAll clears everything', () => {
    const { service } = makeService({ maxFailedAttempts: 1 });
    disposable = service;
    service.recordFailure('a');
    service.recordFailure('b');
    expect(service.isLocked('a')).toBe(true);
    service.reset('a');
    expect(service.isLocked('a')).toBe(false);
    expect(service.unlock('b')).toBe(true);
    expect(service.unlock('b')).toBe(false);
    service.recordFailure('c');
    service.resetAll();
    expect(service.isLocked('c')).toBe(false);
  });

  it('keys are independent (email vs IP)', () => {
    const { service } = makeService({ maxFailedAttempts: 2 });
    disposable = service;
    service.recordFailure('login:a@x.com');
    service.recordFailure('login:ip:1.2.3.4');
    expect(service.isLocked('login:a@x.com')).toBe(false);
    expect(service.isLocked('login:ip:1.2.3.4')).toBe(false);
    expect(service.recordFailure('login:a@x.com').locked).toBe(true);
    expect(service.isLocked('login:ip:1.2.3.4')).toBe(false);
  });

  it('exposes its effective configuration', () => {
    const { service } = makeService({ maxFailedAttempts: 7, lockoutDurationMs: 5_000, windowMs: 10_000 });
    disposable = service;
    expect(service.getConfig()).toEqual({ maxFailedAttempts: 7, lockoutDurationMs: 5_000, windowMs: 10_000 });
  });
});
