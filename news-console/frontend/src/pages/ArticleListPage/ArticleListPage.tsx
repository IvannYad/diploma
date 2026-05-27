import './ArticleListPage.scss';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import type { Article } from '../../types/news';
import { fetchNews, fetchClusters, PAGE_SIZE } from '../../api/news';
import type { ClusterInfo } from '../../types/pipeline';
import ArticleCard from '../../components/ArticleCard/ArticleCard';
import Pagination from '../../components/Pagination/Pagination';
import Spinner from '../../components/Spinner/Spinner';
import ClusterSelect from '../../components/ClusterSelect/ClusterSelect';

const formatLabel = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function ArticleListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = Math.max(0, parseInt(searchParams.get('page') ?? '1', 10) - 1);
  const query = searchParams.get('q') ?? '';
  const selectedClusters = searchParams.getAll('cluster');
  const majorOnly = searchParams.get('major') === '1';
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo = searchParams.get('date_to') ?? '';

  // inputValue tracks the text field separately (may be ahead of committed query)
  const [inputValue, setInputValue] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [news, setNews] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clusters, setClusters] = useState<ClusterInfo[]>([]);

  const MAJOR_THRESHOLD = 20;
  const visibleClusters = majorOnly
    ? clusters.filter((c) => c.count > MAJOR_THRESHOLD)
    : clusters;

  /** Replace history entry so filter tweaks do not flood the back stack. */
  const setParams = useCallback(
    (updater: (p: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          updater(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    fetchClusters().then(setClusters);
  }, []);

  // Keep inputValue in sync when URL changes externally (e.g. browser back)
  useEffect(() => {
    setInputValue(query);
  }, [query]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchNews(page, query, selectedClusters, majorOnly ? MAJOR_THRESHOLD + 1 : 0, dateFrom, dateTo)
      .then((data) => {
        setNews(data.news);
        setTotal(data.total);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, selectedClusters.join('\x00'), majorOnly, dateFrom, dateTo]);

  const handleInput = (value: string) => {
    setInputValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setParams((p) => {
        if (value.trim()) p.set('q', value.trim());
        else p.delete('q');
        p.delete('page');
      });
    }, 350);
  };

  const handlePageChange = (newPage: number) => {
    setParams((p) => {
      if (newPage === 0) p.delete('page');
      else p.set('page', String(newPage + 1));
    });
  };

  const handleClustersChange = (v: string[]) => {
    setParams((p) => {
      p.delete('cluster');
      v.forEach((c) => p.append('cluster', c));
      p.delete('page');
    });
  };

  const handleMajorToggle = (on: boolean) => {
    localStorage.setItem('majorOnly', String(on));
    setParams((p) => {
      if (on) {
        p.set('major', '1');
        // Major-only mode must not leave filters pointing at hidden clusters.
        const majorLabels = new Set(
          clusters.filter((c) => c.count > MAJOR_THRESHOLD).map((c) => c.label),
        );
        const kept = p.getAll('cluster').filter((l) => majorLabels.has(l));
        p.delete('cluster');
        kept.forEach((c) => p.append('cluster', c));
      } else {
        p.delete('major');
      }
      p.delete('page');
    });
  };

  const handleRemoveCluster = (lbl: string) => {
    setParams((p) => {
      const kept = p.getAll('cluster').filter((c) => c !== lbl);
      p.delete('cluster');
      kept.forEach((c) => p.append('cluster', c));
      p.delete('page');
    });
  };

  const handleDateFromChange = (value: string) => {
    setParams((p) => {
      if (value) p.set('date_from', value);
      else p.delete('date_from');
      p.delete('page');
    });
  };

  const handleDateToChange = (value: string) => {
    setParams((p) => {
      if (value) p.set('date_to', value);
      else p.delete('date_to');
      p.delete('page');
    });
  };

  const clearDateFilter = () => {
    setParams((p) => {
      p.delete('date_from');
      p.delete('date_to');
      p.delete('page');
    });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const globalStart = page * PAGE_SIZE;

  const sectionTitle =
    selectedClusters.length === 1
      ? formatLabel(selectedClusters[0])
      : selectedClusters.length > 1
      ? `${selectedClusters.length} clusters selected`
      : query
      ? `Results for "${query}"`
      : dateFrom && dateTo
      ? `Articles ${dateFrom} – ${dateTo}`
      : dateFrom
      ? `Articles from ${dateFrom}`
      : dateTo
      ? `Articles until ${dateTo}`
      : 'Latest Articles';

  return (
    <div className="page" data-testid="news-list-page">
      <div className="search-row">
        <div className="search-bar">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder="Search articles…"
            value={inputValue}
            onChange={(e) => handleInput(e.target.value)}
          />
          {inputValue && (
            <button className="search-clear" onClick={() => handleInput('')} aria-label="Clear search">
              ×
            </button>
          )}
        </div>
        {visibleClusters.length > 0 && (
          <ClusterSelect
            clusters={visibleClusters}
            selected={selectedClusters}
            onChange={handleClustersChange}
          />
        )}

        <div className="date-filter-pair">
          <label className={['date-field', dateFrom ? 'has-value' : ''].filter(Boolean).join(' ')}>
            <span className="date-field-prefix">From</span>
            <input
              className={`date-field-input${dateFrom ? ' filled' : ''}`}
              type="date"
              aria-label="From date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => handleDateFromChange(e.target.value)}
            />
          </label>
          <label className={['date-field', dateTo ? 'has-value' : ''].filter(Boolean).join(' ')}>
            <span className="date-field-prefix">To</span>
            <input
              className={`date-field-input${dateTo ? ' filled' : ''}`}
              type="date"
              aria-label="To date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => handleDateToChange(e.target.value)}
            />
          </label>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              className="date-field-clear"
              onClick={clearDateFilter}
              aria-label="Clear publication date filter"
            >
              ×
            </button>
          )}
        </div>

        <label className="major-toggle" title="Show only clusters with more than 20 articles">
          <input
            type="checkbox"
            checked={majorOnly}
            onChange={(e) => handleMajorToggle(e.target.checked)}
          />
          <span className="major-toggle-track"><span className="major-toggle-thumb" /></span>
          <span className="major-toggle-label">Major clusters</span>
        </label>
      </div>

      {selectedClusters.length > 0 && (
        <div className="cluster-badges">
          {selectedClusters.map((lbl) => {
            const info = clusters.find((c) => c.label === lbl);
            return (
              <span key={lbl} className="cluster-badge">
                <span className="cluster-badge-name">{formatLabel(lbl)}</span>
                {info && <span className="cluster-badge-count">{info.count.toLocaleString()}</span>}
                <button
                  className="cluster-badge-remove"
                  aria-label={`Remove ${lbl}`}
                  onClick={() => handleRemoveCluster(lbl)}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="section-label">
        <h2>{sectionTitle}</h2>
        <span className="count">{total.toLocaleString()}</span>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <div className="error"><strong>Error:</strong> {error}</div>
      ) : news.length === 0 ? (
        <div className="search-empty">No articles match your search.</div>
      ) : (
        <>
          {news.map((article, i) => (
            <ArticleCard
              key={article.id}
              article={article}
              index={globalStart + i + 1}
              query={query}
              onClick={() => navigate(`/article/${article.id}`, { state: { listSearch: location.search } })}
            />
          ))}
          <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </div>
  );
}
