/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCRM } from '../store';

/**
 * Check whether a feature flag is enabled.
 * Defaults to `true` when the flag is not found in state (graceful degradation).
 */
export function useFeatureFlag(key: string): boolean {
  const { featureFlags } = useCRM();
  const flag = featureFlags.find(f => f.key === key);
  return flag ? flag.enabled : true;
}
