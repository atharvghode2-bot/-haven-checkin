// API client for the Haven Check-in FastAPI backend.
const API = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

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
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const current = token();
  if (current) headers.set("Authorization", `Bearer ${current}`);
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, `Cannot reach the server at ${API}. Confirm the backend is running.`);
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

export type ChatResponse = {
  conversation_id: string;
  reply: string;
  provider: string;
  model: string;
  safety_status: "ok" | "crisis_intercepted";
  crisis_resources?: CrisisResource[] | null;
};

export type ChatStatus = {
  available: boolean;
  provider: string;
  model: string;
  installed_models: string[];
  message: string;
};

export type ChatEmotionContext = {
  dominant_emotion?: string | null;
  dominant_score?: number | null;
  emotions?: Record<string, number> | null;
  sample_count?: number | null;
  timestamp?: number | null;
  is_active?: boolean;
};

export async function sendChatMessage(
  message: string,
  conversationId?: string | null,
  emotionContext?: ChatEmotionContext | null,
): Promise<ChatResponse> {
  return api<ChatResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      conversation_id: conversationId || undefined,
      emotion_context: emotionContext || undefined,
    }),
  });
}

export async function getChatStatus(): Promise<ChatStatus> {
  return api<ChatStatus>("/api/chat/status");
}

export async function resetChatSession(conversationId: string): Promise<{ ok: boolean; message: string }> {
  return api<{ ok: boolean; message: string }>("/api/chat/reset", {
    method: "POST",
    body: JSON.stringify({ conversation_id: conversationId }),
  });
}

export type EmotionalInsightsReport = {
  session_summary: {
    conversation_id: string;
    generated_at: number;
    duration_seconds: number;
    user_messages_analyzed: number;
    facial_frames_analyzed: number;
    sources_enabled: {
      nlp_analysis: boolean;
      facial_analysis: boolean;
    };
    sources_status: {
      nlp: string;
      facial: string;
    };
  };
  nlp_insights: {
    available: boolean;
    reason?: string | null;
    message_count: number;
    period_seconds: number;
    distribution: Record<string, number>;
    mean_scores: Record<string, number>;
    dominant_sentiment?: string | null;
    average_confidence: number;
    trajectory: string;
    recurring_themes: string[];
    source: string;
    is_trained_model: boolean;
    limitations: string;
  };
  facial_insights: {
    available: boolean;
    reason?: string | null;
    sample_count: number;
    dominant_emotion?: string | null;
    distribution: Record<string, number>;
    mean_scores: Record<string, number>;
    trajectory: string;
    source: string;
    limitations: string;
  };
  cross_source_comparison: {
    concordance_status: string;
    title: string;
    description: string;
    divergence_explanation?: string | null;
    user_vs_model_fact_note: string;
  };
  reflection_and_resources: {
    reflection_questions: string[];
    wellness_resources: { title: string; contact?: string; description: string; category?: string }[];
    disclaimer: string;
  };
};

export async function getEmotionalReport(
  conversationId: string,
  clientFaceSummary?: any,
): Promise<EmotionalInsightsReport> {
  if (clientFaceSummary) {
    const payload = {
      sample_count: clientFaceSummary.sampleCount ?? clientFaceSummary.sample_count ?? 0,
      dominant_emotion: clientFaceSummary.dominantEmotion ?? clientFaceSummary.dominant_emotion ?? null,
      dominant_score: clientFaceSummary.dominantScore ?? clientFaceSummary.dominant_score ?? null,
      distribution: clientFaceSummary.distribution ?? null,
      mean_scores: clientFaceSummary.meanScores ?? clientFaceSummary.mean_scores ?? null,
      trajectory: clientFaceSummary.trajectory ?? null,
      timestamp: clientFaceSummary.timestamp
        ? clientFaceSummary.timestamp > 1e11
          ? clientFaceSummary.timestamp / 1000
          : clientFaceSummary.timestamp
        : null,
      is_active: clientFaceSummary.isActive ?? clientFaceSummary.is_active ?? true,
      is_stale: clientFaceSummary.isStale ?? clientFaceSummary.is_stale ?? false,
    };
    return api<EmotionalInsightsReport>("/api/chat/report", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: conversationId,
        face_summary: payload,
      }),
    });
  }
  return api<EmotionalInsightsReport>(`/api/chat/${conversationId}/report`);
}

export async function clearConversationAnalysis(
  conversationId: string,
): Promise<{ ok: boolean; message: string }> {
  return api<{ ok: boolean; message: string }>(`/api/chat/${conversationId}/clear-analysis`, {
    method: "POST",
  });
}

