import { API_BASE } from '../config/env';
import { LOGIN_KEY } from '../lib/session';

import type { ProcessingProcess } from '../pages/AdminPage/shared/types';

export interface CreateProcessingProcessRequest {
  type: 'IntellectualProcessing' | 'OlapSchemaRebuild';
  mongoDbServerUrl: string;
  assignedServer?: string;
}

export interface ProcessingInitiationResponse {
  processId: string;
  process: ProcessingProcess;
  progressEndpoint: string;
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? response.statusText;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem(LOGIN_KEY) ?? '';
  const headers = new Headers(init?.headers ?? {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return await response.json() as T;
}

export async function getActiveProcesses(): Promise<ProcessingProcess[]> {
  return await getJson<ProcessingProcess[]>(`${API_BASE}/api/admin/processing/active`);
}

export async function getAllProcesses(): Promise<ProcessingProcess[]> {
  return await getJson<ProcessingProcess[]>(`${API_BASE}/api/admin/processing/all`);
}

export async function getProcess(processId: string): Promise<ProcessingProcess | null> {
  const token = sessionStorage.getItem(LOGIN_KEY) ?? '';
  const response = await fetch(`${API_BASE}/api/admin/processing/${encodeURIComponent(processId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return await response.json() as ProcessingProcess;
}

export async function initiateProcess(
  request: CreateProcessingProcessRequest,
): Promise<ProcessingInitiationResponse> {
  return await getJson<ProcessingInitiationResponse>(`${API_BASE}/api/admin/processing/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
}

export const IntellectualProcessingController = {
  getActiveProcesses,
  getAllProcesses,
  getProcess,
  initiateProcess,
};
