/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side CSV export with Excel-safe quoting (RFC 4180 + BOM).
 */

function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export interface CsvColumn<T> {
  key: string;
  header: string;
  /** Optional formatter; default: String(value) */
  format?: (row: T) => string | number | null | undefined;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map(c => escapeCell(c.header)).join(',');
  const body = rows.map(row =>
    columns.map(c => escapeCell(c.format ? c.format(row) : (row as Record<string, unknown>)[c.key] as string | number | null | undefined)).join(',')
  );
  return header + '\n' + body.join('\n');
}

/** Trigger a browser download of the CSV. */
export function downloadCsv(filename: string, csv: string): void {
  // BOM so Excel opens UTF-8 correctly
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Convenience: build + download in one call. */
export function exportCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  downloadCsv(filename, toCsv(rows, columns));
}
