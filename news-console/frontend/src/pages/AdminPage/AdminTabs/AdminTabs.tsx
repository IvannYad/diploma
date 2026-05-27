import './AdminTabs.scss';
import type { Tab } from '../shared/types';

interface AdminTabsProps {
  tab: Tab;
  onChange: (tab: Tab) => void;
}

export default function AdminTabs({ tab, onChange }: AdminTabsProps) {
  return (
    <div className="admin-tabs">
      <button
        className={`admin-tab${tab === 'users' ? ' admin-tab--active' : ''}`}
        data-testid="admin-users-tab"
        onClick={() => onChange('users')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        User Management
      </button>
      <button
        className={`admin-tab${tab === 'servers' ? ' admin-tab--active' : ''}`}
        data-testid="admin-servers-tab"
        onClick={() => onChange('servers')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
        Processing Servers
      </button>
      <button
        className={`admin-tab${tab === 'processing' ? ' admin-tab--active' : ''}`}
        data-testid="admin-processing-tab"
        onClick={() => onChange('processing')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        Intellectual Processing
      </button>
    </div>
  );
}
