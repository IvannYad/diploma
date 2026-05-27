import './ChartPlaceholder.scss';

export default function ChartPlaceholder() {
  return (
    <div className="chart-section">
      <div className="chart-section-label">Data Visualisation</div>
      <div className="chart-placeholder">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <p>Chart will appear here</p>
      </div>
    </div>
  );
}
