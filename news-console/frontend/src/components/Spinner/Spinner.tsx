import './Spinner.scss';

export default function Spinner() {
  return (
    <div className="loading">
      <div className="spinner" />
      <span>Loading from MongoDB…</span>
    </div>
  );
}
