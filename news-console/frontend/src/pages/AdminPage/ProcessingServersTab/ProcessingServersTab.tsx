import './ProcessingServersTab.scss';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { LOGIN_KEY } from '../../../lib/session';
import { API_BASE } from '../shared/constants';
import type { Server } from '../shared/types';

const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export default function ProcessingServersTab() {
  const token = sessionStorage.getItem(LOGIN_KEY) ?? '';
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newIp, setNewIp] = useState('');
  const [newCap, setNewCap] = useState('');
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState('');
  const [ipFormatErr, setIpFormatErr] = useState('');

  const [editing, setEditing] = useState<Record<number, { ip: string; cap: string }>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/admin/servers`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((data: Server[]) => {
        setServers(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load servers.');
        setLoading(false);
      });
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function addServer(e: FormEvent) {
    e.preventDefault();
    const ipAddress = newIp.trim();

    if (!IPV4_REGEX.test(ipAddress)) {
      setIpFormatErr('Enter a valid IPv4 address (e.g. 192.168.1.10).');
      return;
    }

    setIpFormatErr('');
    setAddErr('');
    setAdding(true);
    const res = await fetch(`${API_BASE}/api/admin/servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ipAddress, maxCapacity: Number(newCap) }),
    });
    setAdding(false);

    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setAddErr(d.error ?? 'Failed to add server.');
      return;
    }

    setNewIp('');
    setNewCap('');
    load();
  }

  async function saveEdit(id: number) {
    const e = editing[id];
    if (!e) return;

    const ipAddress = e.ip.trim();
    const maxCapacity = Number(e.cap);

    const res = await fetch(`${API_BASE}/api/admin/servers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ipAddress, maxCapacity }),
    });

    if (!res.ok) {
      load();
      return;
    }

    setEditing(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setServers(prev =>
      prev.map(s =>
        s.id === id ? { ...s, ipAddress, maxCapacity } : s,
      ),
    );
  }

  async function deleteServer(id: number) {
    await fetch(`${API_BASE}/api/admin/servers/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  if (loading) return <div className="admin-empty">Loading...</div>;
  if (error) return <div className="admin-empty admin-empty--error">{error}</div>;

  return (
    <div data-testid="admin-servers-panel">
      <form className="admin-server-form" data-testid="add-server-form" onSubmit={addServer}>
        <div className="admin-server-form-row">
          <div className="admin-server-field">
            <input
              className={`admin-input${ipFormatErr ? ' admin-input--error' : ''}`}
              data-testid="server-ip-input"
              type="text"
              placeholder="IP address (e.g. 192.168.1.10)"
              value={newIp}
              onChange={e => {
                setNewIp(e.target.value);
                if (ipFormatErr) {
                  setIpFormatErr('');
                }
              }}
              required
            />
            {ipFormatErr && <span className="admin-inline-err admin-inline-err--field">{ipFormatErr}</span>}
          </div>
          <input
            className="admin-input admin-input--short"
            data-testid="server-capacity-input"
            type="number"
            min={1}
            placeholder="Max capacity"
            value={newCap}
            onChange={e => setNewCap(e.target.value)}
            required
          />
          <button className="admin-btn admin-btn--primary" data-testid="add-server-submit" type="submit" disabled={adding}>
            {adding ? 'Adding...' : '+ Add Server'}
          </button>
        </div>
        {addErr && <span className="admin-inline-err">{addErr}</span>}
      </form>

      {servers.length === 0 ? (
        <div className="admin-empty">No servers added yet.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>IP Address</th>
                <th>Max Capacity</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {servers.map(s => {
                const ed = editing[s.id];
                return (
                  <tr key={s.id} data-testid={`server-row-${s.ipAddress}`}>
                    <td>
                      {ed ? (
                        <input
                          className="admin-input admin-input--inline"
                          value={ed.ip}
                          onChange={e => setEditing(prev => ({ ...prev, [s.id]: { ...prev[s.id], ip: e.target.value } }))}
                        />
                      ) : (
                        <span className="admin-cell--mono">{s.ipAddress}</span>
                      )}
                    </td>
                    <td data-testid={`server-capacity-${s.ipAddress}`}>
                      {ed ? (
                        <input
                          className="admin-input admin-input--short admin-input--inline"
                          type="number"
                          min={1}
                          value={ed.cap}
                          onChange={e => setEditing(prev => ({ ...prev, [s.id]: { ...prev[s.id], cap: e.target.value } }))}
                        />
                      ) : (
                        <span>{s.maxCapacity}</span>
                      )}
                    </td>
                    <td>{new Date(s.addedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td className="admin-actions">
                      {ed ? (
                        <>
                          <button className="admin-btn admin-btn--sm admin-btn--ok" data-testid={`save-server-${s.ipAddress}`} onClick={() => saveEdit(s.id)}>Save</button>
                          <button
                            className="admin-btn admin-btn--sm"
                            onClick={() => setEditing(prev => {
                              const next = { ...prev };
                              delete next[s.id];
                              return next;
                            })}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="admin-btn admin-btn--sm"
                            data-testid={`edit-server-${s.ipAddress}`}
                            onClick={() => setEditing(prev => ({ ...prev, [s.id]: { ip: s.ipAddress, cap: String(s.maxCapacity) } }))}
                          >
                            Edit
                          </button>
                          <button
                            className="admin-btn admin-btn--sm admin-btn--danger"
                            data-testid={`delete-server-${s.ipAddress}`}
                            onClick={() => deleteServer(s.id)}
                          >
                            Remove
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
