import './ArticleDetailPage.scss';
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import type { Article } from '../../types/news';
import { fetchArticleById } from '../../api/news';
import SubclusterChart from '../../components/SubclusterChart/SubclusterChart';
import Spinner from '../../components/Spinner/Spinner';

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const listSearch: string = (location.state as { listSearch?: string } | null)?.listSearch ?? '';
  const [searchParams, setSearchParams] = useSearchParams();

  // Read filters from the URL on every render so article navigation resets chart state.
  const initialFact = searchParams.get('fact') ?? undefined;
  const initialFilters: Record<string, string[]> = {};
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith('f_')) {
      initialFilters[key.slice(2)] = value.split(',').filter(Boolean);
    }
  }

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setArticle(null);
    fetchArticleById(id).then((a) => {
      setArticle(a);
      setLoading(false);
    });
  }, [id]);

  function handleChartStateChange(fact: string, filters: Record<string, Set<string>>) {
    const params = new URLSearchParams();
    if (fact) params.set('fact', fact);
    for (const [dim, vals] of Object.entries(filters)) {
      if (vals.size > 0) params.set(`f_${dim}`, Array.from(vals).join(','));
    }
    setSearchParams(params, { replace: true });
  }

  if (loading) {
    return (
      <div className="page">
        <div className="detail-wrap">
          <Spinner />
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="page">
        <div className="detail-wrap">
          <p>Article not found.</p>
          <button className="back-btn" onClick={() => navigate(`/news/${listSearch}`)}>
            Back to articles
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page" data-testid="article-detail-page">
      <div className="detail-wrap">
        <button className="back-btn" onClick={() => navigate(`/news/${listSearch}`)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          All articles
        </button>

        <h1 className="detail-title">{article.title || '(no title)'}</h1>

        <div className="detail-byline">
          {article.date && (
            <span className="time">
              {article.date}
              {article.time ? ' · ' + article.time : ''}
            </span>
          )}
          {article.code && <span className="code">{article.code}</span>}
        </div>

        <div
          className="detail-body"
          data-testid="article-body"
          dangerouslySetInnerHTML={{ __html: article.fullBody ?? '(no content)' }}
        />

        <SubclusterChart
          key={id}
          cluster={article.clusterLabel ?? ''}
          scId={article.scId ?? ''}
          currentArticleId={String(article.id)}
          currentArticleDate={article.date}
          onArticleClick={(targetId) =>
            navigate(
              { pathname: `/article/${targetId}`, search: searchParams.toString() },
              { state: { listSearch } },
            )
          }
          initialFact={initialFact}
          initialFilters={initialFilters}
          onStateChange={handleChartStateChange}
        />
      </div>
    </div>
  );
}

