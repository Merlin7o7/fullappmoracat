"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, cn } from "@moraqat/ui";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isAr?: boolean;
  className?: string;
}

/**
 * Accessible Prev/Next pager driven by the API's pagination.totalPages.
 * Renders nothing when there is a single page. RTL-aware: chevrons and
 * labels flip with locale so "Next" always points forward in reading order.
 */
export function Pagination({ page, totalPages, onPageChange, isAr = false, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const atStart = page <= 1;
  const atEnd = page >= totalPages;
  // In RTL the visual "back" chevron points right, "forward" points left.
  const PrevIcon = isAr ? ChevronRight : ChevronLeft;
  const NextIcon = isAr ? ChevronLeft : ChevronRight;

  return (
    <nav
      className={cn("flex items-center justify-between gap-4 pt-1", className)}
      aria-label={isAr ? "ترقيم الصفحات" : "Pagination"}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={atStart}
        aria-label={isAr ? "الصفحة السابقة" : "Previous page"}
      >
        <PrevIcon className="size-4" /> {isAr ? "السابق" : "Previous"}
      </Button>

      <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
        {isAr ? (
          <>
            صفحة {page.toLocaleString("ar-SA")} من {totalPages.toLocaleString("ar-SA")}
          </>
        ) : (
          <>
            Page {page} of {totalPages}
          </>
        )}
      </p>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={atEnd}
        aria-label={isAr ? "الصفحة التالية" : "Next page"}
      >
        {isAr ? "التالي" : "Next"} <NextIcon className="size-4" />
      </Button>
    </nav>
  );
}
