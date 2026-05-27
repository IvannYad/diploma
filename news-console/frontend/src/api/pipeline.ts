import type {
  PipelineStatus,
  StartPipelineRequest,
  StartPipelineResponse,
} from '../types/pipeline';
import { API_BASE } from '../config/env';

export type { PipelineStatus, StartPipelineRequest, StartPipelineResponse };

export async function startPipeline(payload: StartPipelineRequest): Promise<StartPipelineResponse> {
  const res = await fetch(`${API_BASE}/api/pipeline/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (res.status === 409) {
    return data as StartPipelineResponse;
  }

  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }

  return data as StartPipelineResponse;
}

export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  const res = await fetch(`${API_BASE}/api/pipeline/status`);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }

  return data as PipelineStatus;
}
