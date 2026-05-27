interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function RankingPagination({ page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  // Build the list of page numbers (with '...' gaps when many pages)
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-2">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="px-2 py-1 text-sm rounded disabled:opacity-30 hover:bg-slate-100"
        aria-label="이전 페이지"
      >
        ◀
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="px-1 text-sm text-muted-foreground select-none">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p as number)}
            className={`w-7 h-7 text-sm rounded transition-colors ${
              page === p
                ? 'bg-blue-600 text-white font-bold'
                : 'hover:bg-slate-100 text-foreground'
            }`}
            aria-current={page === p ? 'page' : undefined}
          >
            {p}
          </button>
        ),
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="px-2 py-1 text-sm rounded disabled:opacity-30 hover:bg-slate-100"
        aria-label="다음 페이지"
      >
        ▶
      </button>
    </div>
  );
}
