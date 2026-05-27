import './LandingPage.scss';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatConnectionError } from '../../lib/formatConnectionError';
import { withMongoUri } from '../../lib/mongoHeaders';
import { CONNECTION_KEY, LOGIN_KEY, MONGO_URI_KEY, PROCESSED_KEY } from '../../lib/session';

const API_BASE = 'http://localhost:5000';

type TestStatus = 'idle' | 'testing' | 'connection_failed' | 'bad_format' | 'needs_processing' | 'ready';
type ImportStatus = 'idle' | 'validating' | 'uploading' | 'done' | 'error';

const REQUIRED_FIELDS = ['id', 'body_preview', 'code', 'date', 'full_body', 'retrieved_at', 'time', 'title'];

const FORMAT_EXAMPLE = `[
  {
    "id": "article-001",
    "title": "Example headline",
    "code": "EX01",
    "date": "2024-01-15",
    "time": "10:30:00",
    "body_preview": "Short preview text…",
    "full_body": "Full article body with optional tables…",
    "retrieved_at": "2024-01-15T10:30:00Z"
  }
]`;

export default function LandingPage() {
  const navigate = useNavigate();
  const isLoggedIn = !!sessionStorage.getItem(LOGIN_KEY);

  const [mongoUri, setMongoUri] = useState('mongodb://localhost:27019/diploma');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [newsCount, setNewsCount] = useState<number | null>(null);
  const [activeProcessId, setActiveProcessId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [importError, setImportError] = useState('');
  const [importInserted, setImportInserted] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [showFormatModal, setShowFormatModal] = useState(false);

  async function handleTest() {
    const uri = mongoUri.trim();
    if (!uri) return;
    setTestStatus('testing');
    setTestMessage('');

    try {
      const res = await fetch(`${API_BASE}/api/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri }),
      });

      const data = await res.json() as {
        status: TestStatus;
        message?: string;
        count?: number;
        activeProcessId?: string;
      };
      if (data.status !== 'connection_failed') {
        sessionStorage.setItem(CONNECTION_KEY, '1');
        sessionStorage.setItem(MONGO_URI_KEY, uri);
      } else {
        sessionStorage.removeItem(CONNECTION_KEY);
        sessionStorage.removeItem(MONGO_URI_KEY);
      }

      if (data.status === 'ready') {
        sessionStorage.setItem(PROCESSED_KEY, '1');
      } else {
        sessionStorage.removeItem(PROCESSED_KEY);
      }

      setActiveProcessId(data.activeProcessId ?? null);

      if (data.activeProcessId) {
        setTestStatus(data.status);
        setTestMessage(data.message ?? 'A processing task is already running for this MongoDB server.');
        setNewsCount(data.count ?? null);
        return;
      }

      setTestStatus(data.status);
      setTestMessage(data.message ?? '');
      setNewsCount(data.count ?? null);
    } catch {
      sessionStorage.removeItem(CONNECTION_KEY);
      sessionStorage.removeItem(PROCESSED_KEY);
      sessionStorage.removeItem(MONGO_URI_KEY);
      setActiveProcessId(null);
      setTestStatus('connection_failed');
      setTestMessage('Could not reach the backend server.');
    }
  }

  function handleStartProcessing() {
    if (!isLoggedIn) {
      navigate('/login');
      return;
    }

    const uri = mongoUri.trim();
    if (uri) {
      sessionStorage.setItem(MONGO_URI_KEY, uri);
    }

    navigate('/processing-progress', {
      state: {
        mongoUri: uri,
        newsCount,
        autoStart: true,
      },
    });
  }

  function handleOpenNewsReader() {
    navigate(isLoggedIn ? '/news' : '/login');
  }

  function handleSeeProcessingProgress() {
    if (!activeProcessId) return;

    navigate('/processing-progress', {
      state: {
        processId: activeProcessId,
        autoStart: false,
        newsCount,
      },
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImportFile(file);
    setImportStatus('idle');
    setImportError('');
    setImportInserted(0);
    setImportTotal(0);
  }

  async function handleImport() {
    if (!importFile) return;
    setImportStatus('validating');
    setImportError('');

    let parsed: unknown;
    try {
      parsed = JSON.parse(await importFile.text());
    } catch {
      setImportStatus('error');
      setImportError('File is not valid JSON.');
      return;
    }

    const docs: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed];

    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      if (typeof doc !== 'object' || doc === null) {
        setImportStatus('error');
        setImportError(`Item at index ${i} is not an object.`);
        return;
      }
      const missing = REQUIRED_FIELDS.filter((f) => !(f in doc));
      if (missing.length > 0) {
        setImportStatus('error');
        setImportError(`Document at index ${i} is missing: ${missing.join(', ')}.`);
        return;
      }
    }

    setImportStatus('uploading');
    setImportTotal(docs.length);
    setImportInserted(0);

    try {
      const res = await fetch(`${API_BASE}/api/import-news`, {
        method: 'POST',
        headers: withMongoUri({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ documents: docs, batchSize: 100 }),
      });

      if (!res.ok || !res.body) {
        setImportStatus('error');
        setImportError(`Server error: ${res.statusText}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const chunk of lines) {
          const dataLine = chunk.replace(/^data:\s*/, '').trim();
          if (!dataLine) continue;
          try {
            const evt = JSON.parse(dataLine) as { inserted: number; total: number; done: boolean; error?: string };
            if (evt.error) {
              setImportStatus('error');
              setImportError(evt.error);
              return;
            }
            setImportInserted(evt.inserted);
            setImportTotal(evt.total);
            if (evt.done) {
              setImportStatus('done');
              return;
            }
          } catch {
            // SSE chunks may split mid-JSON; skip partial frames.
          }
        }
      }
      setImportStatus('done');
    } catch (e) {
      setImportStatus('error');
      setImportError(String(e));
    }
  }

  return (
    <div className="landing landing--with-header" data-testid="landing-page">
      <div className="landing-inner">
        <div className="landing-hero">
          <div className="landing-eyebrow">News Intelligence Platform</div>
          <h1 className="landing-title">
            News<span>Trend</span>
          </h1>
        </div>

        <div className="landing-feats">
          <div className="landing-feat-card">
            <span className="landing-feat-num">01</span>
            <div>
              <div className="landing-feat-title">Clustering</div>
              <div className="landing-feat-desc">AI-powered article grouping &amp; labelling</div>
            </div>
          </div>
          <div className="landing-feat-card">
            <span className="landing-feat-num">02</span>
            <div>
              <div className="landing-feat-title">Extraction</div>
              <div className="landing-feat-desc">Structured table data pulled from article bodies</div>
            </div>
          </div>
          <div className="landing-feat-card">
            <span className="landing-feat-num">03</span>
            <div>
              <div className="landing-feat-title">Search</div>
              <div className="landing-feat-desc">Full-text search with highlighted matches</div>
            </div>
          </div>
        </div>

        <div className="landing-card">
            <div className="landing-card-header">
              <div className="landing-card-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/>
                </svg>
              </div>
              <div>
                <div className="landing-card-title">Connect to MongoDB</div>
                <div className="landing-card-subtitle">Paste your connection string to get started</div>
              </div>
            </div>

            <label className="landing-connect-label" htmlFor="mongo-uri">
              Connection URL
            </label>
            <div className="landing-connect-row">
              <input
                id="mongo-uri"
                data-testid="mongo-uri-input"
                className="landing-connect-input"
                type="text"
                placeholder="mongodb+srv://user:pass@cluster.mongodb.net/diploma"
                value={mongoUri}
                onChange={(e) => {
                  setMongoUri(e.target.value);
                  setTestStatus('idle');
                  setTestMessage('');
                  setNewsCount(null);
                  setActiveProcessId(null);
                  sessionStorage.removeItem(CONNECTION_KEY);
                  sessionStorage.removeItem(PROCESSED_KEY);
                }}
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                className="landing-connect-test-btn"
                data-testid="mongo-test-button"
                onClick={handleTest}
                disabled={testStatus === 'testing' || !mongoUri.trim()}
              >
                {testStatus === 'testing' ? (
                  <span className="landing-spinner" />
                ) : (
                  'Test'
                )}
              </button>
            </div>

            {testStatus === 'testing' && (
              <div className="landing-status landing-status--info" data-testid="connection-testing-indicator" role="status">
                <span className="landing-spinner" />
                <span>Checking connection…</span>
              </div>
            )}

            {testStatus !== 'idle' && testStatus !== 'testing' && (
              <span data-testid="connection-test-complete" data-status={testStatus} hidden />
            )}

            {testStatus === 'connection_failed' && importStatus === 'idle' && (
              <div className="landing-status landing-status--error" data-testid="connection-error-message">
                <span className="landing-status-icon">✕</span>
                <span>{formatConnectionError(testMessage)}</span>
              </div>
            )}

            {!activeProcessId && testStatus === 'bad_format' && importStatus === 'idle' && (
              <div className="landing-status landing-status--warn" data-testid="empty-database-message">
                <span className="landing-status-icon">⚠</span>
                <span>
                  Connected, but no news articles were found in the database. Upload a JSON file to get started.
                </span>
              </div>
            )}

            {activeProcessId && testStatus !== 'idle' && testStatus !== 'testing' ? (
              <div className="landing-status landing-status--info">
                <span className="landing-status-icon">i</span>
                <span>
                  A processing task is already running for this MongoDB server.
                </span>
                <button
                  className="landing-btn landing-btn--secondary"
                  style={{ marginTop: '12px', width: '100%', justifyContent: 'center' }}
                  onClick={handleSeeProcessingProgress}
                >
                  See Processing Progress
                </button>
              </div>
            ) : testStatus === 'needs_processing' && (
              <div className="landing-status landing-status--warn" data-testid="needs-processing-message">
                <span className="landing-status-icon">⚠</span>
                <span>
                  Connected.{newsCount != null ? ` Found ${newsCount.toLocaleString()} articles` : ' Articles found'} — analytics data has not been generated yet.
                </span>
              </div>
            )}

            {!activeProcessId && testStatus === 'needs_processing' && (
              <button
                type="button"
                className="landing-btn landing-btn--secondary"
                data-testid="start-processing-button"
                style={{ marginTop: '12px', width: '100%', justifyContent: 'center' }}
                title={!isLoggedIn ? 'Sign in to start processing' : 'Start processing pipeline'}
                onClick={handleStartProcessing}
              >
                Start processing {newsCount != null ? newsCount.toLocaleString() : ''} news
              </button>
            )}

            {!activeProcessId && testStatus === 'ready' && (
              <>
                <div className="landing-status landing-status--ok" data-testid="connection-ready-message">
                  <span className="landing-status-icon">✓</span>
                  <span>
                    Connected. All collections present — you can open the news reader.
                  </span>
                </div>
                <button
                  type="button"
                  className="landing-btn landing-btn--secondary"
                  data-testid="open-news-reader-button"
                  style={{ marginTop: '12px', width: '100%', justifyContent: 'center' }}
                  onClick={handleOpenNewsReader}
                >
                  Open news reader
                </button>
              </>
            )}

            {testStatus === 'bad_format' && (
              <div className="landing-upload-section" data-testid="news-upload-section">
                {importStatus !== 'done' && (
                  <>
                    <div className="landing-upload-format-row">
                      <label className="landing-connect-label" htmlFor="news-file">
                        News JSON file
                      </label>
                      <button
                        type="button"
                        className="landing-format-link"
                        data-testid="view-format-button"
                        onClick={() => setShowFormatModal(true)}
                      >
                        View format
                      </button>
                    </div>
                    <div className="landing-upload-row">
                      <label className="landing-file-label" htmlFor="news-file" data-testid="news-file-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        {importFile ? importFile.name : 'Choose file…'}
                      </label>
                      <input
                        ref={fileInputRef}
                        id="news-file"
                        data-testid="news-file-input"
                        type="file"
                        accept=".json,application/json"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                      />
                      <button
                        type="button"
                        className="landing-connect-test-btn"
                        data-testid="load-news-button"
                        disabled={!importFile || importStatus === 'uploading' || importStatus === 'validating'}
                        onClick={handleImport}
                      >
                        {(importStatus === 'validating' || importStatus === 'uploading')
                          ? <span className="landing-spinner" />
                          : 'Load News'}
                      </button>
                    </div>
                  </>
                )}

                {importStatus === 'error' && (
                  <div className="landing-status landing-status--error" data-testid="import-error-message" style={{ marginTop: '10px' }}>
                    <span className="landing-status-icon">✕</span>
                    <span>{importError}</span>
                  </div>
                )}

                {importStatus === 'uploading' && importTotal > 0 && (
                  <div className="landing-upload-progress" data-testid="import-progress-indicator">
                    <div
                      className="landing-upload-bar"
                      style={{ width: `${Math.round((importInserted / importTotal) * 100)}%` }}
                    />
                    <span className="landing-upload-label">
                      Inserting {importInserted} / {importTotal} documents…
                    </span>
                  </div>
                )}

                {importStatus === 'done' && (
                  <>
                    <div className="landing-status landing-status--ok" data-testid="import-success-message" style={{ marginTop: '10px' }}>
                      <span className="landing-status-icon">✓</span>
                      <span>
                        {importTotal} documents inserted successfully.
                      </span>
                    </div>
                    <button
                      className="landing-btn landing-btn--secondary"
                      style={{ marginTop: '12px', width: '100%', justifyContent: 'center' }}
                      title={!isLoggedIn ? 'Sign in to start processing' : 'Start processing pipeline'}
                      onClick={handleStartProcessing}
                    >
                      Start processing
                    </button>
                  </>
                )}
              </div>
            )}

          </div>
      </div>

      {showFormatModal && (
        <div className="landing-modal-overlay" data-testid="format-modal" role="dialog" aria-modal="true">
          <div className="landing-modal">
            <div className="landing-modal-header">
              <h2 className="landing-modal-title">News JSON format</h2>
              <button
                type="button"
                className="landing-modal-close"
                aria-label="Close"
                onClick={() => setShowFormatModal(false)}
              >
                ✕
              </button>
            </div>
            <p className="landing-modal-text">
              Upload a JSON array (or a single object). Each article must include:
            </p>
            <ul className="landing-modal-fields">
              {REQUIRED_FIELDS.map((field) => (
                <li key={field}><code>{field}</code></li>
              ))}
            </ul>
            <pre className="landing-modal-example">{FORMAT_EXAMPLE}</pre>
          </div>
        </div>
      )}

      <footer className="landing-footer">
        News Trend &copy; {new Date().getFullYear()} &mdash; Diploma Project
      </footer>
    </div>
  );
}
