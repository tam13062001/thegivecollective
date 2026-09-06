// src/components/insights/EngagementPagination.tsx
import { ChevronLeft, ChevronRight } from "lucide-react";

export function EngagementPagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  return (
    <nav
      className="mt-3 flex items-center justify-between gap-3 border-t border-signal-border px-1 pt-3"
      aria-label="Engagement posts pagination"
    >
      <span className="font-signal-mono text-[9px] uppercase tracking-wide text-signal-muted sm:text-[10px]">
        {firstItem}–{lastItem} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous engagement posts page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-signal-border bg-signal-surface text-signal-muted transition-colors hover:border-signal-cyan hover:text-signal-cyan disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-16 text-center font-signal-mono text-[9px] uppercase tracking-wide text-signal-muted">
          Page {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === pageCount}
          aria-label="Next engagement posts page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-signal-border bg-signal-surface text-signal-muted transition-colors hover:border-signal-cyan hover:text-signal-cyan disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}
