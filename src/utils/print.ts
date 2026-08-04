/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Print / Save-as-PDF helper (G-FE-11).
 *
 * Adds the `printing` class to <html> so the print stylesheet in
 * index.css isolates .print-area, invokes the native print dialog
 * (which includes "Save as PDF"), and cleans up afterwards.
 */

export function printRecord(): void {
  const root = document.documentElement;
  root.classList.add('printing');
  // Wait a frame so the visibility rules apply before the print dialog renders
  window.setTimeout(() => {
    window.print();
    window.setTimeout(() => root.classList.remove('printing'), 500);
  }, 50);
}
