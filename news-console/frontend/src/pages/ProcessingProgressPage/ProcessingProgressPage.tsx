import './ProcessingProgressPage.scss';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getProcess,
  initiateProcess,
} from '../../api/intellectualProcessingController';
import { PROCESSED_KEY } from '../../lib/session';
import type { ProcessingProcess } from '../AdminPage/shared/types';

const PROCESS_ID_STORAGE_KEY = 'nc_processing_process_id';

type LocationState = {
  mongoUri?: string;
  newsCount?: number;
  autoStart?: boolean;
  processId?: string;
};

function normalizeMongoUri(uri: string | null | undefined): string {
  if (!uri) return '';
  return uri.trim().replace(/\/+$/, '').toLowerCase();
}

/**
 * Stage bar matches the "Stage N of M" label: N/M of the pipeline (not article count).
 * Stage 3 of 4 → 75%. Optional fill within the current stage's slice before the next stage starts.
 */
function computeStagePercent(
  stageIndex: number,
  totalStages: number,
  processedInStage: number,
  totalInStage: number,
  isCompleted: boolean,
): number {
  if (isCompleted) return 100;
  if (totalStages <= 0 || stageIndex <= 0) return 0;

  const slice = 100 / totalStages;
  const throughCurrentStage = ((stageIndex - 1) / totalStages) * 100;
  const withinSlice =
    totalInStage > 0 && stageIndex < totalStages
      ? Math.min(1, processedInStage / totalInStage) * slice
      : 0;

  // At stage 3/4 with no extra slice: 75%. While working in stage 3, bar can grow toward 100%.
  if (withinSlice === 0) {
    return Math.round(throughCurrentStage);
  }

  const fromPreviousStages = ((stageIndex - 1) / totalStages) * 100;
  return Math.round(Math.min(100, fromPreviousStages + withinSlice));
}

export default function ProcessingProgressPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const locationState = (state as LocationState | null) ?? null;

  const [process, setProcess] = useState<ProcessingProcess | null>(null);
  const [activeProcessId, setActiveProcessId] = useState<string | null>(
    locationState?.processId ?? sessionStorage.getItem(PROCESS_ID_STORAGE_KEY) ?? null,
  );
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(true);

  const hasInitiatedRef = useRef(false);
  // Keep a ref in sync with state so the polling interval always reads the latest processId.
  const activeProcessIdRef = useRef<string | null>(activeProcessId);
  activeProcessIdRef.current = activeProcessId;

  const mongoUri = locationState?.mongoUri ?? sessionStorage.getItem('nc_mongo_uri') ?? '';
  const newsCount = locationState?.newsCount ?? null;
  const shouldAutoStart = locationState?.autoStart === true;

  useEffect(() => {
    let disposed = false;

    async function init() {
      setStartError(null);

      try {
        if (shouldAutoStart) {
          const existingProcessId = activeProcessIdRef.current
            ?? locationState?.processId
            ?? sessionStorage.getItem(PROCESS_ID_STORAGE_KEY)
            ?? null;

          if (existingProcessId) {
            const existingProcess = await getProcess(existingProcessId);
            if (disposed) return;

            const currentMongoUri = normalizeMongoUri(mongoUri);
            const existingMongoUri = normalizeMongoUri(existingProcess?.mongoDbServerUrl);

            // Reuse only an active process for the same MongoDB URI.
            // A different URI must start its own container/process.
            if (existingProcess?.isActive && existingMongoUri === currentMongoUri) {
              setActiveProcessId(existingProcessId);
              setProcess(existingProcess);
              return;
            }

            // Discard stale or mismatched process so the new URI does not inherit
            // progress from a different MongoDB server.
            sessionStorage.removeItem(PROCESS_ID_STORAGE_KEY);
            setActiveProcessId(null);
            setProcess(null);
          }

          if (hasInitiatedRef.current) return;

          if (!mongoUri) {
            setStartError('Missing Mongo URL. Please return to landing page and test the connection first.');
            return;
          }

          hasInitiatedRef.current = true;
          const startResponse = await initiateProcess({
            type: 'IntellectualProcessing',
            mongoDbServerUrl: mongoUri,
          });

          if (disposed) return;

          setActiveProcessId(startResponse.processId);
          sessionStorage.setItem(PROCESS_ID_STORAGE_KEY, startResponse.processId);
          return;
        }

        const existingProcessId = locationState?.processId
          ?? sessionStorage.getItem(PROCESS_ID_STORAGE_KEY)
          ?? null;

        if (existingProcessId) {
          const existingProcess = await getProcess(existingProcessId);
          if (disposed) return;

          setActiveProcessId(existingProcessId);
          setProcess(existingProcess);
          return;
        }

      } catch (e) {
        if (disposed) return;
        setStartError(String(e));
      } finally {
        if (!disposed) setIsStarting(false);
      }
    }

    init();

    return () => { disposed = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeProcessId) return;

    setIsStarting(false);

    const timer = window.setInterval(async () => {
      const id = activeProcessIdRef.current;
      if (!id) return;

      try {
        const next = await getProcess(id);
        setProcess(next);
        if (!next?.id) {
          setActiveProcessId(null);
          sessionStorage.removeItem(PROCESS_ID_STORAGE_KEY);
        }
      } catch {
        // Transient network errors should not stop the progress poller.
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [activeProcessId]);

  const resultStatus = (process?.resultStatus ?? 'running').toLowerCase();
  const isRunning = process?.isActive === true;
  const isCompleted = process !== null && !isRunning && resultStatus === 'success';
  const isFailed = process !== null && !isRunning && (resultStatus === 'failed' || resultStatus === 'cancelled');
  const progressStage = process?.currentStage ?? (isRunning ? 'running' : process ? 'finished' : 'waiting');
  const progressProcessed = process?.processed ?? 0;
  const progressTotal = process?.total ?? 0;
  const progressStageIndex = process?.stageIndex ?? 0;
  const progressTotalStages = process?.totalStages ?? 0;

  const stagePercent = computeStagePercent(
    progressStageIndex,
    progressTotalStages,
    progressProcessed,
    progressTotal,
    isCompleted,
  );
  const newsPercent = progressTotal > 0
    ? Math.round((progressProcessed / progressTotal) * 100)
    : 0;

  useEffect(() => {
    if (isCompleted) {
      sessionStorage.setItem(PROCESSED_KEY, '1');
    }
  }, [isCompleted]);

  const stageLabel = progressTotalStages > 0
    ? `Stage ${progressStageIndex} of ${progressTotalStages}`
    : progressStage;
  const newsLabel = progressTotal > 0
    ? `Processed ${progressProcessed} of ${progressTotal} news`
    : `Processed ${progressProcessed} news`;

  return (
    <div className="page processing-page" data-testid="processing-progress-page">
      <div className="section-label">
        <h2>Processing Progress</h2>
        {newsCount != null && <span className="count">{newsCount} news</span>}
      </div>

      <div className="processing-card">
        <h1 className="processing-title">Intellectual processing task</h1>

        {process?.id && (
          <div className="processing-progress-bottom" style={{ marginBottom: '10px' }}>
            <span>Process: {process.id.slice(0, 8)}...</span>
            <span>Server: {process.assignedServer ?? 'auto'}</span>
            <span>Status: {resultStatus}</span>
          </div>
        )}
        
        <div className="processing-progress-wrap" data-testid="processing-stage-progress">
          <div className="processing-progress-top">
            <span data-testid="processing-stage-label">{stageLabel}</span>
            <strong data-testid="processing-stage-percent">{stagePercent}%</strong>
          </div>
          <div className={`processing-bar processing-bar--stages${isRunning ? ' processing-bar--running processing-bar--indeterminate' : ''}`}>
            <div className="processing-bar-fill" style={{ width: `${stagePercent}%` }} />
          </div>
        </div>

        <div className="processing-progress-wrap" data-testid="processing-news-progress" style={{ marginTop: '16px' }}>
          <div className="processing-progress-top">
            <span data-testid="processing-news-label">{newsLabel}</span>
            <strong data-testid="processing-news-percent">
              {progressTotal > 0 ? `${newsPercent}%` : '—'}
            </strong>
          </div>
          <div className={`processing-bar${isRunning ? ' processing-bar--running processing-bar--indeterminate' : ''}`}>
            <div
              className="processing-bar-fill"
              style={{ width: progressTotal > 0 ? `${newsPercent}%` : '0%' }}
            />
          </div>
        </div>

        {isStarting && (
          <div className="landing-status landing-status--info">
            <span className="landing-status-icon">i</span>
            <span>{shouldAutoStart ? 'Starting processing task...' : 'Loading task status...'}</span>
          </div>
        )}

        {startError && (
          <div className="landing-status landing-status--error">
            <span className="landing-status-icon">✕</span>
            <span>{startError}</span>
          </div>
        )}

        {isFailed && (
          <div className="landing-status landing-status--error">
            <span className="landing-status-icon">✕</span>
            <span>{process?.resultMessage ?? 'Processing task failed.'}</span>
          </div>
        )}

        {isCompleted && (
          <div className="landing-status landing-status--ok" data-testid="processing-completion-message">
            <span className="landing-status-icon">✓</span>
            <span>Processing task completed successfully.</span>
          </div>
        )}

        <div className="processing-actions">
          <button
            className="landing-btn landing-btn--secondary"
            data-testid="processing-open-news-button"
            onClick={() => navigate('/news')}
            disabled={!isCompleted}
          >
            Open News
          </button>
          <button
            className="landing-btn"
            onClick={() => navigate('/')}
          >
            Back to Landing
          </button>
        </div>
      </div>
    </div>
  );
}
