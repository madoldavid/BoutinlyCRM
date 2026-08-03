/**
 * G-SEC-08 (subset): configurable password policy.
 * Defaults (min 8, no complexity requirement) preserve prior behavior.
 * Full per-organization policy objects arrive with the policy engine (G-SEC-03/08).
 */

export interface PasswordPolicy {
  minLength: number;
  requireComplexity: boolean;
}

/**
 * Validate a password against the policy.
 * Returns null when valid, otherwise a human-readable reason.
 */
export function validatePasswordPolicy(password: string, policy: PasswordPolicy): string | null {
  if (password.length < policy.minLength) {
    return `Password must be at least ${policy.minLength} characters.`;
  }
  if (policy.requireComplexity) {
    if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter.';
    if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must contain a digit.';
    if (!/[^a-zA-Z0-9]/.test(password)) return 'Password must contain a symbol.';
  }
  return null;
}
