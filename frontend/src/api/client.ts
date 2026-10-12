// API client for the Haven Check-in FastAPI backend.
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function token(): string | null {
  return localStorage.getItem("haven_token");
}

export function setToken(value: string | null) {
  if (value) localStorage.setItem("haven_token", value);
  else localStorage.removeItem("haven_token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const current = token();
  if (current) headers.set("Authorization", `Bearer ${current}`);
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Confirm the backend is running on port 8000.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const raw = (data as { detail?: unknown }).detail;
    const detail =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw)
          ? raw.map((item) => (typeof item === "object" && item && "msg" in item ? String(item.msg) : String(item))).join(" ")
          : "Request failed.";
    throw new ApiError(response.status, detail);
  }
  return data as T;
}

export type Role = "student" | "counselor";
export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  anonymous_code?: string | null;
  consent?: { camera?: boolean; voice?: boolean; data_processing?: boolean };
};

export type Item = {
  id: string;
  prompt: string;
  instrument: string;
  optional?: boolean;
  index: number;
  total: number;
  kind: "likert" | "text";
  options?: { value: number; label: string }[];
};

export type CrisisResource = {
  name: string;
  contact: string;
  alt_contact?: string;
  hours?: string;
  description: string;
  type?: string;
};

export type Result = {
  phq9: number;
  gad7: number;
  questionnaire_score: number;
  text_sentiment_score: number | null;
  face_emotion_score: number | null;
  face_emotions_breakdown?: Record<string, number> | null;
  face_sample_count?: number | null;
  final_risk: number;
  band: "lower" | "moderate" | "elevated";
  crisis: boolean;
  counselor_notified: boolean;
  weights_used: Record<string, number>;
  nlp_source: string;
  recommendations?: { title: string; body: string }[];
  crisis_resources?: CrisisResource[];
  disclaimer: string;
  completed_at?: string;
};

export type SessionSummary = {
  id: string;
  created_at: string;
  completed_at?: string | null;
  status: string;
  result?: Result | null;
};

export type TrendPoint = {
  session_id: string;
  completed_at: string;
  phq9: number;
  gad7: number;
  final_risk: number;
  band: string;
  crisis: boolean;
};

export type AlertRow = {
  id: string;
  session_id: string;
  anonymous_code: string;
  student_id: string;
  status: string;
  band: string;
  final_risk: number;
  phq9: number;
  gad7: number;
  crisis: boolean;
  counselor_notified: boolean;
  created_at: string;
  updated_at?: string;
  note_count: number;
  notes?: { id: string; author_name: string; body: string; created_at: string }[];
};
