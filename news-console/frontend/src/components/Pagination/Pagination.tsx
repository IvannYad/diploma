import './Pagination.scss';

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
    if (totalPages <= 7) return i;
    if (page < 4) return i;
    if (page > totalPages - 5) return totalPages - 7 + i;
    return page - 3 + i;
  });

  return (
    <div className="pagination">
      <button onClick={() => onPageChange(page - 1)} disabled={page === 0}>
        ← Prev
      </button>
      {pages.map((p) => (
        <button
          key={p}
          className={p === page ? 'active' : ''}
          onClick={() => onPageChange(p)}
        >
          {p + 1}
        </button>
      ))}
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1}>
        Next →
      </button>
    </div>
  );
}
