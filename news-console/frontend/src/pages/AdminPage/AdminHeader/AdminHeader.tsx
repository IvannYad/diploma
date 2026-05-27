import './AdminHeader.scss';

export default function AdminHeader() {
  return (
    <header className="admin-header">
      <div className="admin-header-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>
      <div>
        <div className="admin-header-title">Admin Console</div>
        <div className="admin-header-sub">System management</div>
      </div>
    </header>
  );
}
