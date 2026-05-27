import './UserManagementTab.scss';
import { useCallback, useEffect, useState } from 'react';
import { LOGIN_EMAIL_KEY, LOGIN_KEY } from '../../../lib/session';
import { API_BASE } from '../shared/constants';
import type { UserRow } from '../shared/types';

export default function UserManagementTab() {
  const token = sessionStorage.getItem(LOGIN_KEY) ?? '';
  const currentEmail = sessionStorage.getItem(LOGIN_EMAIL_KEY) ?? '';
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: UserRow[]) => {
        setUsers(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load users.');
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(id: number, role: string) {
    await fetch(`${API_BASE}/api/users/${id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role }),
    });
    load();
  }

  async function toggleBlocked(id: number, isBlocked: boolean) {
    await fetch(`${API_BASE}/api/users/${id}/blocked`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isBlocked }),
    });
    load();
  }

  if (loading) return <div className="admin-empty">Loading...</div>;
  if (error) return <div className="admin-empty admin-empty--error">{error}</div>;

  const me = users.find(u => u.email === currentEmail);
  const others = users.filter(u => u.email !== currentEmail);

  const renderRow = (u: UserRow, isSelf = false) => (
    <tr
      key={u.id}
      data-testid={`user-row-${u.email}`}
      data-user-email={u.email}
      className={[u.isBlocked ? 'admin-row--blocked' : '', isSelf ? 'admin-row--self' : ''].filter(Boolean).join(' ')}
    >
      <td>
        {u.name}
        {u.surname ? ` ${u.surname}` : ''}
        {isSelf && <span className="admin-self-tag">you</span>}
      </td>
      <td className="admin-cell--mono">{u.email}</td>
      <td>
        <span className={`admin-badge admin-badge--${u.role.toLowerCase()}`}>{u.role}</span>
      </td>
      <td>
        <span className={`admin-badge admin-badge--${u.isBlocked ? 'blocked' : 'active'}`}>
          {u.isBlocked ? 'Blocked' : 'Active'}
        </span>
      </td>
      <td>{new Date(u.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
      <td className={isSelf || u.role === 'Admin' ? '' : 'admin-actions'}>
        {!isSelf && u.role !== 'Admin' && (
          <>
            <button
              className="admin-btn admin-btn--sm"
              data-testid="promote-user"
              onClick={() => changeRole(u.id, u.role === 'Admin' ? 'User' : 'Admin')}
              title={u.role === 'Admin' ? 'Demote to User' : 'Promote to Admin'}
            >
              {u.role === 'Admin' ? 'Make User' : 'Make Admin'}
            </button>
            <button
              className={`admin-btn admin-btn--sm ${u.isBlocked ? 'admin-btn--ok' : 'admin-btn--danger'}`}
              data-testid="block-user"
              onClick={() => toggleBlocked(u.id, !u.isBlocked)}
            >
              {u.isBlocked ? 'Unblock' : 'Block'}
            </button>
          </>
        )}
      </td>
    </tr>
  );

  return (
    <div className="admin-table-wrap" data-testid="users-management-tab">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {me && renderRow(me, true)}
          {others.map(u => renderRow(u))}
        </tbody>
      </table>
    </div>
  );
}
