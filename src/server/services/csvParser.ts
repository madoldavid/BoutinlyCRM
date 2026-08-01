/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Minimal RFC 4180 CSV parser — no dependency required.
 * Handles quoted fields, embedded commas, and escaped quotes.
 */

/**
 * Parse a CSV string into an array of objects using the header row as keys.
 * Returns { headers, rows } where each row is a Record<string, string>.
 * Row values are trimmed and empty strings are preserved.
 */
export function parseCsv(input: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = splitLines(input.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length === 0 || (values.length === 1 && values[0] === '')) continue; // skip empty rows
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = idx < values.length ? values[idx].trim() : '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function splitLines(input: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (inQuotes && input[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else if (ch === '\r' && !inQuotes) {
      // skip carriage return, handle \r\n at i+1
      lines.push(current);
      current = '';
      if (input[i + 1] === '\n') i++;
    } else {
      current += ch;
    }
  }
  // Last line (no trailing newline)
  if (current.length > 0 || lines.length > 0) {
    lines.push(current);
  }

  return lines;
}

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}
