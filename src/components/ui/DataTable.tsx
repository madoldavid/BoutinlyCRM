/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Enterprise DataTable — sortable columns, pagination, row selection,
 * column resize, sticky header, and density control.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Columns3, RotateCcw } from 'lucide-react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  width?: number;
  minWidth?: number;
  render: (row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Unique key extractor for each row (used for selection) */
  rowKey: (row: T) => string;
  /** Show row selection checkboxes */
  selectable?: boolean;
  /** Called when selection changes */
  onSelectionChange?: (selectedKeys: Set<string>) => void;
  /** External selection state */
  selectedKeys?: Set<string>;
  /** Per-page limit */
  pageSize?: number;
  /** Page size options */
  pageSizeOptions?: number[];
  /** Total count (if server-side pagination) */
  totalCount?: number;
  /** Current page (1-indexed) */
  page?: number;
  /** Called on page change */
  onPageChange?: (page: number) => void;
  /** Called on page size change */
  onPageSizeChange?: (size: number) => void;
  /** Called on sort change */
  onSortChange?: (sort: { key: string; dir: 'asc' | 'desc' } | null) => void;
  /** Empty state content */
  emptyState?: React.ReactNode;
  /** Density preset */
  density?: 'compact' | 'normal' | 'comfortable';
  /** Show density toggle */
  showDensityToggle?: boolean;
  /** Additional class on wrapper */
  className?: string;
  /** Loading state */
  loading?: boolean;
  /**
   * Stable identifier for this table (e.g. "contacts"). When set, column
   * visibility and density preferences persist per user device (G-FE-02).
   */
  tableId?: string;
}

const prefsKey = (tableId: string) => `boutinly_table_prefs_${tableId}`;

interface TablePrefs {
  hidden?: string[];
  density?: 'compact' | 'normal' | 'comfortable';
}

function loadPrefs(tableId?: string): TablePrefs {
  if (!tableId) return {};
  try {
    return JSON.parse(localStorage.getItem(prefsKey(tableId)) || '{}') as TablePrefs;
  } catch {
    return {};
  }
}

function savePrefs(tableId: string | undefined, prefs: TablePrefs) {
  if (!tableId) return;
  try { localStorage.setItem(prefsKey(tableId), JSON.stringify(prefs)); } catch { /* noop */ }
}

const densityRowStyles: Record<string, string> = {
  compact: 'text-2xs py-1.5 px-3',
  normal: 'text-xs py-2.5 px-4',
  comfortable: 'text-sm py-3.5 px-5',
};

const densityHeaderStyles: Record<string, string> = {
  compact: 'text-[10px] py-1.5 px-3',
  normal: 'text-2xs py-2.5 px-4',
  comfortable: 'text-xs py-3.5 px-5',
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  selectable = false,
  onSelectionChange,
  selectedKeys,
  pageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  totalCount,
  page,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  emptyState,
  density: initialDensity = 'normal',
  showDensityToggle = true,
  className = '',
  loading = false,
  tableId,
}: DataTableProps<T>) {
  const [density, setDensityState] = useState<'compact' | 'normal' | 'comfortable'>(
    () => loadPrefs(tableId).density ?? initialDensity,
  );
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(
    () => new Set(loadPrefs(tableId).hidden ?? []),
  );
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const setDensity = useCallback((d: 'compact' | 'normal' | 'comfortable') => {
    setDensityState(d);
    savePrefs(tableId, { ...loadPrefs(tableId), density: d });
  }, [tableId]);

  const toggleColumn = useCallback((key: string) => {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < columns.length - 1) next.add(key); // keep at least one column
      savePrefs(tableId, { ...loadPrefs(tableId), hidden: [...next] });
      return next;
    });
  }, [tableId, columns.length]);

  const resetColumns = useCallback(() => {
    setHiddenCols(new Set());
    savePrefs(tableId, { ...loadPrefs(tableId), hidden: [] });
  }, [tableId]);

  const visibleColumns = useMemo(
    () => columns.filter(c => !hiddenCols.has(c.key)),
    [columns, hiddenCols],
  );

  // Close the column picker on Escape
  useEffect(() => {
    if (!showColumnPicker) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowColumnPicker(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showColumnPicker]);
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(pageSize);
  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set());
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<string | null>(null);
  const startXRef = useRef(0);
  const startWRef = useRef(0);

  const currentPage = page ?? internalPage;
  const currentPageSize = pageSize ?? internalPageSize;
  const currentSelected = selectedKeys ?? internalSelected;

  // ─── Sorting ────────────────────────────────────

  const sortedData = useMemo(() => {
    if (!sort) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sort.key];
      const bVal = b[sort.key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sort.dir === 'desc' ? -cmp : cmp;
    });
  }, [data, sort]);

  // ─── Pagination ─────────────────────────────────

  const total = totalCount ?? sortedData.length;
  const totalPages = Math.ceil(total / currentPageSize);
  const pagedData = sortedData.slice(
    (currentPage - 1) * currentPageSize,
    currentPage * currentPageSize,
  );

  const handleSort = useCallback((key: string) => {
    const next = sort?.key === key && sort.dir === 'asc'
      ? { key, dir: 'desc' as const }
      : sort?.key === key && sort.dir === 'desc'
        ? null
        : { key, dir: 'asc' as const };
    setSort(next);
    onSortChange?.(next);
  }, [sort, onSortChange]);

  const handlePage = useCallback((p: number) => {
    setInternalPage(p);
    onPageChange?.(p);
  }, [onPageChange]);

  const handlePageSize = useCallback((s: number) => {
    setInternalPageSize(s);
    onPageSizeChange?.(s);
    handlePage(1);
  }, [onPageSizeChange, handlePage]);

  const toggleSelect = useCallback((key: string) => {
    const next = new Set(currentSelected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setInternalSelected(next);
    onSelectionChange?.(next);
  }, [currentSelected, onSelectionChange]);

  const toggleSelectAll = useCallback(() => {
    const allKeys = pagedData.map(rowKey);
    const next = currentSelected.size === allKeys.length && allKeys.every(k => currentSelected.has(k))
      ? new Set<string>()
      : new Set(allKeys);
    setInternalSelected(next);
    onSelectionChange?.(next);
  }, [pagedData, rowKey, currentSelected, onSelectionChange]);

  // ─── Column resize ──────────────────────────────

  const onResizeStart = useCallback((key: string, e: React.MouseEvent) => {
    resizingRef.current = key;
    startXRef.current = e.clientX;
    const col = columns.find(c => c.key === key);
    startWRef.current = columnWidths[key] || col?.width || 150;
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  }, [columns, columnWidths]);

  const onResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    const diff = e.clientX - startXRef.current;
    const minW = columns.find(c => c.key === resizingRef.current)?.minWidth || 60;
    setColumnWidths(prev => ({
      ...prev,
      [resizingRef.current!]: Math.max(minW, startWRef.current + diff),
    }));
  }, [columns]);

  const onResizeEnd = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
  }, [onResizeMove]);

  // ─── Pagination helpers ──────────────────────────

  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    const show = 5;
    let start = Math.max(1, currentPage - Math.floor(show / 2));
    let end = Math.min(totalPages, start + show - 1);
    if (end - start < show - 1) start = Math.max(1, end - show + 1);
    if (start > 1) pages.push(1, 'ellipsis');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages) pages.push('ellipsis', totalPages);
    return pages;
  }, [currentPage, totalPages]);

  // ─── Render ─────────────────────────────────────

  if (data.length === 0 && emptyState && !loading) {
    return <>{emptyState}</>;
  }

  return (
    <div className={`bg-theme-card border border-theme-border rounded-[10px] overflow-hidden ${className}`}>
      {/* Table toolbar: density + column picker */}
      {(showDensityToggle || tableId) && (
        <div className="flex items-center justify-end gap-1 px-3 py-1.5 border-b border-theme-border bg-theme-inset/30">
          {showDensityToggle && (['compact', 'normal', 'comfortable'] as const).map(d =>
            <button
              key={d}
              onClick={() => setDensity(d)}
              className={`text-[10px] px-2 py-0.5 rounded font-sans cursor-pointer transition-colors ${
                density === d ? 'bg-theme-accent-soft text-theme-accent' : 'text-theme-secondary hover:text-theme-primary'
              }`}
            >
              {d}
            </button>
          )}
          {tableId && (
            <div className="relative ml-1">
              <button
                onClick={() => setShowColumnPicker(v => !v)}
                aria-expanded={showColumnPicker}
                aria-haspopup="true"
                aria-label="Choose visible columns"
                title="Columns"
                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-sans cursor-pointer transition-colors ${
                  hiddenCols.size > 0 ? 'bg-theme-accent-soft text-theme-accent' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <Columns3 className="w-3 h-3" />
                Columns{hiddenCols.size > 0 ? ` (${columns.length - hiddenCols.size}/${columns.length})` : ''}
              </button>
              {showColumnPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowColumnPicker(false)} aria-hidden="true" />
                  <div className="absolute right-0 mt-1.5 w-52 bg-theme-card border border-theme-border rounded-[10px] shadow-overlay z-50 py-1.5 animate-overlay-in" role="menu">
                    <div className="px-3 py-1 text-[10px] font-semibold text-theme-secondary uppercase tracking-wider font-sans">
                      Visible columns
                    </div>
                    {columns.map(col => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-theme-primary hover:bg-theme-hover cursor-pointer font-sans"
                      >
                        <input
                          type="checkbox"
                          checked={!hiddenCols.has(col.key)}
                          onChange={() => toggleColumn(col.key)}
                          className="w-3.5 h-3.5 rounded border-theme-border cursor-pointer"
                        />
                        <span className="truncate">{col.header}</span>
                      </label>
                    ))}
                    {hiddenCols.size > 0 && (
                      <button
                        onClick={resetColumns}
                        className="w-full flex items-center gap-1.5 px-3 py-1.5 mt-1 border-t border-theme-border text-[10px] text-theme-secondary hover:text-theme-primary cursor-pointer font-sans bg-transparent"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset to default
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-theme-border bg-theme-inset/50">
              {selectable && (
                <th className={`${densityHeaderStyles[density]} w-10 text-left sticky top-0 bg-theme-inset/50 z-10`}>
                  <input
                    type="checkbox"
                    checked={pagedData.length > 0 && pagedData.every(r => currentSelected.has(rowKey(r)))}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded border-theme-border cursor-pointer"
                  />
                </th>
              )}
              {visibleColumns.map(col => {
                const width = columnWidths[col.key] || col.width;
                return (
                  <th
                    key={col.key}
                    className={`${densityHeaderStyles[density]} text-left font-semibold text-theme-secondary uppercase tracking-wider sticky top-0 bg-theme-inset/50 z-10 select-none`}
                    style={{ width: width ? `${width}px` : undefined, minWidth: col.minWidth || 60 }}
                  >
                    <div className="flex items-center gap-1">
                      {col.sortable !== false ? (
                        <button
                          onClick={() => handleSort(col.key)}
                          className="flex items-center gap-1 hover:text-theme-primary transition-colors cursor-pointer bg-transparent border-none text-inherit font-inherit"
                        >
                          {col.header}
                          {sort?.key === col.key
                            ? sort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            : <ChevronsUpDown className="w-3 h-3 opacity-30" />
                          }
                        </button>
                      ) : (
                        <span>{col.header}</span>
                      )}
                      {/* Resize handle */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-theme-accent/30"
                        onMouseDown={e => onResizeStart(col.key, e)}
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0)} className="text-center py-12 text-xs text-theme-secondary">
                  Loading…
                </td>
              </tr>
            ) : pagedData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0)} className="text-center py-12 text-xs text-theme-secondary">
                  No data to display.
                </td>
              </tr>
            ) : (
              pagedData.map((row, idx) => {
                const key = rowKey(row);
                const isSelected = currentSelected.has(key);
                return (
                  <tr
                    key={key}
                    className={`border-b border-theme-border last:border-b-0 transition-colors ${
                      isSelected ? 'bg-theme-accent-soft/50' : 'hover:bg-theme-hover/50'
                    }`}
                  >
                    {selectable && (
                      <td className={`${densityRowStyles[density]} w-10`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(key)}
                          className="w-3.5 h-3.5 rounded border-theme-border cursor-pointer"
                        />
                      </td>
                    )}
                    {visibleColumns.map(col => (
                      <td key={col.key} className={`${densityRowStyles[density]} text-theme-primary whitespace-nowrap`}>
                        {col.render(row, idx)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-theme-border bg-theme-inset/20 text-xs text-theme-secondary">
          <div className="flex items-center gap-2">
            <span>{total.toLocaleString()} rows</span>
            <select
              value={currentPageSize}
              onChange={e => handlePageSize(Number(e.target.value))}
              className="bg-theme-card border border-theme-border rounded px-1.5 py-0.5 text-xs cursor-pointer"
            >
              {pageSizeOptions.map(s => <option key={s} value={s}>{s}/page</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-2 py-0.5 rounded border border-theme-border hover:bg-theme-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs"
            >
              Prev
            </button>
            {pageNumbers.map((p, i) =>
              p === 'ellipsis'
                ? <span key={`e-${i}`} className="px-1">…</span>
                : (
                  <button
                    key={p}
                    onClick={() => handlePage(p)}
                    className={`w-6 h-6 rounded text-xs font-mono cursor-pointer ${
                      p === currentPage ? 'bg-theme-accent text-white' : 'hover:bg-theme-hover'
                    }`}
                  >
                    {p}
                  </button>
                )
            )}
            <button
              onClick={() => handlePage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-2 py-0.5 rounded border border-theme-border hover:bg-theme-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-xs"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
