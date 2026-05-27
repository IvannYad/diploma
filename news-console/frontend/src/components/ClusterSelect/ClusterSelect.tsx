import './ClusterSelect.scss';
import { useState, useRef, useEffect } from 'react';
import type { ClusterInfo } from '../../types/pipeline';

interface Props {
  clusters: ClusterInfo[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

const formatLabel = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function ClusterSelect({ clusters, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((c) => c !== value)
        : [...selected, value],
    );
  };

  const triggerLabel =
    selected.length === 0
      ? 'All clusters'
      : selected.length === 1
      ? formatLabel(selected[0])
      : `${selected.length} clusters selected`;

  return (
    <div className="cs-wrap" ref={containerRef}>
      <button
        className={`cs-trigger${open ? ' open' : ''}${selected.length > 0 ? ' has-value' : ''}`}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="cs-trigger-label">{triggerLabel}</span>
        {selected.length > 0 && (
          <span
            className="cs-clear"
            role="button"
            aria-label="Clear"
            onClick={(e) => { e.stopPropagation(); onChange([]); }}
          >
            ×
          </span>
        )}
        <svg className="cs-chevron" width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="cs-dropdown">
          {clusters.map(({ label, count }) => (
            <label key={label} className={`cs-option${selected.includes(label) ? ' checked' : ''}`}>
              <input
                type="checkbox"
                checked={selected.includes(label)}
                onChange={() => toggle(label)}
              />
              <span className="cs-option-name">{formatLabel(label)}</span>
              <span className="cs-option-count">{count.toLocaleString()}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
