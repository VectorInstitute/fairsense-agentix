/** In dev, default to same-origin + Vite proxy unless VITE_API_BASE is set explicitly. */
export const API_BASE = (
  import.meta.env.VITE_API_BASE ??
  (import.meta.env.DEV ? "" : "http://localhost:8000")
).replace(/\/$/, "");

export function apiUrl(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path;
}

function wsBase(): string {
  return API_BASE || (typeof window !== "undefined" ? window.location.origin : "http://localhost:5173");
}

export type WorkflowID = "bias_text" | "bias_image" | "risk";

export interface HealthResponse {
  status: string;
  software_version?: string;
  llm_provider: string;
  mock_mode: boolean;
  mit_risk_repository_version?: string;
  mit_risk_snapshot_date?: string;
  indexed_risk_count?: number;
}

export async function health(): Promise<HealthResponse> {
  const res = await fetch(apiUrl("/v1/health"));
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.statusText}`);
  }
  return res.json();
}

export interface AnalyzePayload {
  content: string;
  input_type?: WorkflowID;
  options?: Record<string, unknown>;
}

export interface AnalyzeStartResponse {
  run_id: string;
  status: string;
  message: string;
}

export async function analyze(payload: AnalyzePayload) {
  const res = await fetch(apiUrl("/v1/analyze"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.statusText}`);
  }
  return res.json();
}

export async function analyzeStart(payload: AnalyzePayload): Promise<AnalyzeStartResponse> {
  const res = await fetch(apiUrl("/v1/analyze/start"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.statusText}`);
  }
  return res.json();
}

export async function analyzeFile(file: File, inputType?: WorkflowID) {
  const form = new FormData();
  form.append("file", file);
  if (inputType) {
    form.append("input_type", inputType);
  }
  const res = await fetch(apiUrl("/v1/analyze/upload"), {
    method: "POST",
    body: form
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.statusText}`);
  }
  return res.json();
}

export async function analyzeFileStart(file: File, inputType?: WorkflowID): Promise<AnalyzeStartResponse> {
  const form = new FormData();
  form.append("file", file);
  if (inputType) {
    form.append("input_type", inputType);
  }
  const res = await fetch(apiUrl("/v1/analyze/upload/start"), {
    method: "POST",
    body: form
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.statusText}`);
  }
  return res.json();
}

export function connectToStream(runId: string, onEvent: (event: MessageEvent) => void) {
  const url = new URL(`/v1/stream/${runId}`, wsBase());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(url.toString());
  ws.onmessage = onEvent;
  return ws;
}
