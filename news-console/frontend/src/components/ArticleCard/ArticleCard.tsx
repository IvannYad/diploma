import './ArticleCard.scss';
import type { Article } from '../../types/news';
import Highlight from '../Highlight/Highlight';

interface Props {
  article: Article;
  index: number;
  query: string;
  onClick: () => void;
}

const stripHtml = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export default function ArticleCard({ article, index, query, onClick }: Props) {
  const excerpt = stripHtml(article.bodyPreview ?? article.fullBody ?? '').slice(0, 220);

  return (
    <div className="card" onClick={onClick}>
      <div className="card-content">
        <div className="card-category">{article.clusterLabel}</div>
        <h2><Highlight text={article.title || '(no title)'} term={query} /></h2>
        <p className="card-excerpt">
          <Highlight text={excerpt + (excerpt.length === 220 ? '…' : '')} term={query} />
        </p>
        <div className="card-meta">
          {article.date && <span>{article.date}</span>}
          {article.date && article.time && <span className="dot" />}
          {article.time && <span>{article.time}</span>}
        </div>
      </div>
      <div className="card-index">{String(index).padStart(2, '0')}</div>
    </div>
  );
}
