"use client";

import * as React from "react";
import { cn } from "../lib/cn";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: "start" | "center" | "end";
  /** Accessor for sorting; defaults to row[key]. */
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
}

type SortDir = "asc" | "desc";

/**
 * Enterprise data table — sortable columns with aria-sort, sticky header,
 * hover rows, skeleton loading, and a first-class empty state.
 */
export function DataTable<T>({ columns, data, rowKey, loading, emptyState, onRowClick }: DataTableProps<T>) {
  const [sort, setSort] = React.useState<{ key: string; dir: SortDir } | null>(null);

  const sorted = React.useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return data;
    const val = col.sortValue ?? ((row: T) => (row as Record<string, unknown>)[sort.key] as string | number);
    return [...data].sort((a, b) => {
      const av = val(a), bv = val(b);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [data, sort, columns]);

  const toggleSort = (key: string) =>
    setSort((prev) => (prev?.key === key ? (prev.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));

  const alignCls = { start: "text-start", center: "text-center", end: "text-end" } as const;

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-e1 ring-hairline">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground backdrop-blur">
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn("px-4 py-3 font-medium", alignCls[c.align ?? "start"])}
                >
                  {c.sortable ? (
                    <button
                      onClick={() => toggleSort(c.key)}
                      className={cn("inline-flex items-center gap-1 rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active && "text-foreground")}
                    >
                      {c.header}
                      <span className="text-[10px]">{active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3"><div className="skeleton h-4 w-full" /></td>
                ))}
              </tr>
            ))
          ) : sorted.length > 0 ? (
            sorted.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn("transition-colors hover:bg-muted/40", onRowClick && "cursor-pointer")}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-3", alignCls[c.align ?? "start"])}>{c.render(row)}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-14 text-center text-muted-foreground">
                {emptyState ?? "No data"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
