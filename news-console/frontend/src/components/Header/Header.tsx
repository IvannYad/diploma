import "./Header.scss";
import { Link, useNavigate } from 'react-router-dom';
import { LOGIN_KEY, LOGIN_NAME_KEY, LOGIN_ROLE_KEY, PROCESSED_KEY, ADMIN_ROLE } from '../../lib/session';

export default function Header() {
  const navigate = useNavigate();
  const showNewsList = sessionStorage.getItem(PROCESSED_KEY) === '1';
  const loggedInUser = sessionStorage.getItem(LOGIN_KEY)
    ? sessionStorage.getItem(LOGIN_NAME_KEY)
    : null;
  const isAdmin = sessionStorage.getItem(LOGIN_ROLE_KEY) === ADMIN_ROLE;

  function handleLogout() {
    sessionStorage.clear();
    navigate('/login');
  }

  return (
    <nav className="topbar">
      <div className="topbar-left">
        <Link to="/" className="topbar-logo">
          News<span>Trend</span>
        </Link>
        {showNewsList && (
          <>
            <Link to="/news" className="topbar-link">
              News List
            </Link>
            <Link to="/olap-schemas" className="topbar-link">
              Edit OLAP Schemas
            </Link>
            <Link to="/help" className="topbar-link">
              Довідка
            </Link>
          </>
        )}
        {isAdmin && (
          <Link to="/admin" className="topbar-link topbar-link--admin">
            Admin Console
          </Link>
        )}
      </div>
      <div className="topbar-right">
        {loggedInUser ? (
          <>
            <div className="topbar-user">
              <Link to="/profile" className="topbar-user-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <span>Signed in as <strong>{loggedInUser}</strong></span>
              </Link>
            </div>
            <button className="topbar-logout-btn" onClick={handleLogout} type="button">
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login"    className="topbar-link">Sign In</Link>
            <Link to="/register" className="topbar-link topbar-link--accent">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
