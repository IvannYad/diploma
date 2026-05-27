import './ProcessingProcessesTab.scss';
import { useState, useEffect } from 'react';
import { getActiveProcesses, getAllProcesses } from '../../../api/intellectualProcessingController';
import type { ProcessingProcess } from '../shared/types';

export default function ProcessingProcessesTab() {
  const [processes, setProcesses] = useState<ProcessingProcess[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProcesses();
    const interval = setInterval(loadProcesses, 3000);
    return () => clearInterval(interval);
  }, [showAll]);

  async function loadProcesses() {
    try {
      setError(null);
      const data = showAll ? await getAllProcesses() : await getActiveProcesses();
      setProcesses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load processes');
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'running': return '#0ea5e9';
      case 'success': return '#10b981';
      case 'failed': return '#ef4444';
      case 'cancelled': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'running': return '⟳';
      case 'success': return '✓';
      case 'failed': return '✕';
      case 'cancelled': return '—';
      default: return '○';
    }
  };

  const formatStatusLabel = (status: string): string =>
    status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div className="processing-tab" data-testid="processing-history-tab">
      <div className="processing-header">
        <h2>Intellectual Processing</h2>
      </div>

      {error && (
        <div className="processing-error">
          <span>✕</span>
          <span>{error}</span>
        </div>
      )}

      <div className="processing-toggle">
        <label>
          <input
            type="checkbox"
            data-testid="show-all-processes-checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          Show all processes (including completed)
        </label>
      </div>

      {loading ? (
        <div className="processing-loading">Loading processes...</div>
      ) : processes.length === 0 ? (
        <div className="processing-empty">
          {showAll ? 'No processing history found' : 'No active processes'}
        </div>
      ) : (
        <div className="processing-table">
          <div className="processing-table-header">
            <div className="col-id">Process ID</div>
            <div className="col-type">Type</div>
            <div className="col-status">Status</div>
            <div className="col-server">Server</div>
            <div className="col-message">Message</div>
            <div className="col-time">Created</div>
          </div>
          {processes.map((process) => (
            <div
              key={process.id}
              className="processing-table-row"
              data-testid={`processing-row-${process.resultStatus}`}
              data-process-type={process.type}
            >
              <div className="col-id">
                <code>{process.id.slice(0, 8)}...</code>
              </div>
              <div className="col-type">
                {process.type === 'IntellectualProcessing' ? 'Intellectual processing' : 'OLAP schema rebuild'}
              </div>
              <div className="col-status">
                <span
                  className="status-badge"
                  style={{ color: getStatusColor(process.resultStatus) }}
                >
                  <span className="status-icon">{getStatusIcon(process.resultStatus)}</span>
                  {formatStatusLabel(process.resultStatus)}
                </span>
              </div>
              <div className="col-server">
                {process.assignedServer ? (
                  <code>{process.assignedServer}</code>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>
              <div className="col-message">
                {process.resultMessage ? (
                  <span title={process.resultMessage}>
                    {process.resultMessage.length > 40
                      ? `${process.resultMessage.slice(0, 40)}...`
                      : process.resultMessage}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>
              <div className="col-time">
                <span title={process.createdAt}>
                  {new Date(process.createdAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
