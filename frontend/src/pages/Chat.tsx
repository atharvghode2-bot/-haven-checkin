// Haven AI Wellness Companion: redesigned private chat interface powered by local open-source LLM.
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Camera,
  CameraOff,
  Check,
  CheckCircle,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  PhoneCall,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smile,
  Sparkles,
  Terminal,
  Trash2,
  TrendingUp,
  User as UserIcon,
} from "lucide-react";
import {
  type ChatEmotionContext,
  type ChatResponse,
  type ChatStatus,
  type CrisisResource,
  type EmotionalInsightsReport,
  clearConversationAnalysis,
  getChatStatus,
  getEmotionalReport,
  resetChatSession,
  sendChatMessage,
} from "../api/client";
import { Arrow, Button, Dialog, Loading, Spark } from "../components/Ui";
import {
  startFaceSampler,
  type CameraStatus,
  type EmotionMap,
  type FacePresence,
  type FaceSamplerHandle,
} from "../lib/face";
import { useAuth } from "../auth/AuthContext";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  safetyStatus?: "ok" | "crisis_intercepted";
  crisisResources?: CrisisResource[] | null;
  provider?: string;
  model?: string;
  isError?: boolean;
};

const STARTER_PROMPTS = [
  {
    title: "Exam & Deadline Pressure",
    prompt: "I have been feeling really stressed about my upcoming exams and deadlines.",
  },
  {
    title: "Sleep & Evening Wind-Down",
    prompt: "I've been having trouble switching off my racing thoughts and falling asleep.",
  },
  {
    title: "Quick Grounding Exercise",
    prompt: "Can you guide me through a 2-minute calming grounding or breathing exercise?",
  },
  {
    title: "Understanding Screening",
    prompt: "How should I interpret the results from my mental wellness screening check-in?",
  },
  {
    title: "Mental Fatigue & Focus",
    prompt: "I feel mentally drained and can't seem to stay focused on studying today.",
  },
];

const INITIAL_WELCOME_MESSAGE: Message = {
  id: "welcome-0",
  role: "assistant",
  content:
    "Hello and welcome. I'm Haven Companion, your private wellness assistant. " +
    "Whether you're navigating academic stress, trouble sleeping, or simply need an unhurried space " +
    "to sort through your thoughts, I'm here to listen. How has your day felt so far?",
  createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  safetyStatus: "ok",
};

function getEmotionColor(emotion: string): string {
  const norm = emotion.toLowerCase();
  if (["positive", "joy", "happy"].includes(norm)) return "#15803d";
  if (["neutral", "steady"].includes(norm)) return "#475569";
  if (["negative", "sadness", "sad", "anger", "angry", "disgust"].includes(norm)) return "#be123c";
  if (["fear", "anxious", "stress"].includes(norm)) return "#b45309";
  if (["surprised", "surprise"].includes(norm)) return "#0284c7";
  return "var(--wine)";
}

export function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([INITIAL_WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);

  // Combined Emotional Insights Report State
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<EmotionalInsightsReport | null>(null);
  const [clearFeedback, setClearFeedback] = useState<string | null>(null);

  // Camera & Face Expression Tracking
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("off");
  const [, setCameraStatusText] = useState("Camera off");
  const [facePresence, setFacePresence] = useState<FacePresence>("no_face");
  const [cameraConsentOpen, setCameraConsentOpen] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const [dominantEmotion, setDominantEmotion] = useState<string | null>(null);
  const [currentEmotions, setCurrentEmotions] = useState<EmotionMap | null>(null);
  const [showVideoPreview, setShowVideoPreview] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const sampler = useRef<FaceSamplerHandle | null>(null);

  const chatThreadRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const prevMessagesLengthRef = useRef<number>(messages.length);
  const lastAssistantMessageRef = useRef<HTMLElement | null>(null);

  // Camera sampler lifecycle
  useEffect(() => {
    if (!cameraEnabled || !videoRef.current) {
      if (sampler.current) {
        sampler.current.stop();
        sampler.current = null;
      }
      setCameraStatus("off");
      setCameraStatusText("Camera off");
      setFacePresence("no_face");
      setSampleCount(0);
      setDominantEmotion(null);
      setCurrentEmotions(null);
      return;
    }

    let cancelled = false;
    setCameraStatus("connecting");
    setCameraStatusText("Connecting...");

    void startFaceSampler(videoRef.current, (state) => {
      if (cancelled) return;
      setCameraStatus(state.status);
      setCameraStatusText(state.statusText);
      setFacePresence(state.facePresence);
      setSampleCount(state.sampleCount);
      setDominantEmotion(state.dominantEmotion);
      setCurrentEmotions(state.currentEmotions);
    }).then((handle) => {
      if (cancelled) {
        handle.stop();
      } else {
        sampler.current = handle;
      }
    });

    return () => {
      cancelled = true;
      if (sampler.current) {
        sampler.current.stop();
        sampler.current = null;
      }
      setCameraStatus("off");
      setCameraStatusText("Camera off");
      setFacePresence("no_face");
      setSampleCount(0);
      setDominantEmotion(null);
      setCurrentEmotions(null);
    };
  }, [cameraEnabled]);

  const handleToggleCamera = () => {
    if (cameraEnabled) {
      setCameraEnabled(false);
    } else {
      setCameraConsentOpen(true);
    }
  };

  const handleConfirmEnableCamera = () => {
    setCameraConsentOpen(false);
    setCameraEnabled(true);
  };

  // Poll Ollama status
  useEffect(() => {
    let active = true;
    const checkRuntime = async () => {
      try {
        const res = await getChatStatus();
        if (active) {
          setStatus(res);
          setStatusLoading(false);
        }
      } catch {
        if (active) {
          setStatus({
            available: false,
            provider: "offline",
            model: "",
            installed_models: [],
            message: "Cannot connect to the Haven backend server.",
          });
          setStatusLoading(false);
        }
      }
    };

    checkRuntime();
    const interval = setInterval(checkRuntime, 20000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Monitor scroll position
  const handleScroll = () => {
    const el = chatThreadRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    isNearBottomRef.current = distanceFromBottom <= 100;
  };

  // Predictable auto-scroll logic
  useEffect(() => {
    const container = chatThreadRef.current;
    if (!container) return;

    const prevCount = prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;

    if (messages.length <= prevCount) return;

    const latestMessage = messages[messages.length - 1];

    if (latestMessage.role === "user") {
      isNearBottomRef.current = true;
      requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth",
        });
      });
    } else if (latestMessage.role === "assistant") {
      if (!isNearBottomRef.current) return;

      requestAnimationFrame(() => {
        const lastMsgEl = lastAssistantMessageRef.current;
        if (lastMsgEl) {
          const targetTop = Math.max(0, lastMsgEl.offsetTop - 16);
          const maxScroll = container.scrollHeight - container.clientHeight;
          const scrollTarget = Math.min(targetTop, maxScroll);
          container.scrollTo({
            top: scrollTarget,
            behavior: "smooth",
          });
        } else {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
          });
        }
      });
    }
  }, [messages]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleNewConversation = async () => {
    if (conversationId) {
      try {
        await resetChatSession(conversationId);
      } catch {
        // proceed
      }
    }
    sampler.current?.reset();
    setSampleCount(0);
    setDominantEmotion(null);
    setCurrentEmotions(null);
    setReportData(null);
    setReportError(null);
    setClearFeedback(null);
    setConversationId(null);
    setMessages([
      {
        ...INITIAL_WELCOME_MESSAGE,
        id: `welcome-${Date.now()}`,
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setInput("");
    setLastUserMessage(null);
    isNearBottomRef.current = true;
    prevMessagesLengthRef.current = 1;
    if (chatThreadRef.current) {
      chatThreadRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
    textareaRef.current?.focus({ preventScroll: true });
  };

  const submitMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setLastUserMessage(trimmed);

    // Aggregate camera emotion summary if active
    let emotionPayload: ChatEmotionContext | null = null;
    if (cameraEnabled && sampler.current) {
      const summary = sampler.current.getRecentSummary?.(6);
      if (summary && Date.now() - summary.lastUpdated <= 12000 && summary.sampleCount >= 3) {
        emotionPayload = {
          dominant_emotion: summary.dominantEmotion,
          dominant_score: summary.dominantScore,
          emotions: summary.emotions,
          sample_count: summary.sampleCount,
          timestamp: summary.lastUpdated / 1000,
          is_active: true,
        };
      }
    }

    try {
      const response: ChatResponse = await sendChatMessage(trimmed, conversationId, emotionPayload);
      setConversationId(response.conversation_id);

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.reply,
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        safetyStatus: response.safety_status,
        crisisResources: response.crisis_resources,
        provider: response.provider,
        model: response.model,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMsg =
        err?.message ||
        "I'm having trouble reaching the local AI model. Please confirm Ollama is active on your device.";
      const errorResponse: Message = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: errorMsg,
        createdAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus({ preventScroll: true }), 50);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submitMessage(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitMessage(input);
    }
  };

  const handleRetry = () => {
    if (lastUserMessage) {
      setMessages((prev) => (prev[prev.length - 1]?.isError ? prev.slice(0, -1) : prev));
      submitMessage(lastUserMessage);
    }
  };

  const handleOpenReport = async () => {
    setReportOpen(true);
    setReportLoading(true);
    setReportError(null);
    setClearFeedback(null);

    const faceSummary = sampler.current?.getSessionSummary();
    const frames = faceSummary?.sampleCount || 0;

    if (!conversationId) {
      setReportLoading(false);
      setReportData({
        session_summary: {
          conversation_id: "current-session",
          generated_at: Date.now() / 1000,
          duration_seconds: 0,
          user_messages_analyzed: 0,
          facial_frames_analyzed: frames,
          sources_enabled: {
            nlp_analysis: false,
            facial_analysis: Boolean(frames >= 3),
          },
          sources_status: {
            nlp: "No user messages submitted yet in this session",
            facial:
              frames >= 3
                ? `Active (${frames} frames collected)`
                : frames > 0
                ? `Insufficient observations (${frames} frame${frames !== 1 ? "s" : ""}; minimum 3 required)`
                : cameraEnabled
                ? "Camera active • Looking for face"
                : "Camera was not enabled by the user",
          },
        },
        nlp_insights: {
          available: false,
          reason: "No user messages submitted yet. Send a message to start emotional tone analysis.",
          message_count: 0,
          period_seconds: 0,
          distribution: { negative: 0, neutral: 0, positive: 0 },
          mean_scores: { negative: 0, neutral: 0, positive: 0 },
          dominant_sentiment: null,
          average_confidence: 0,
          trajectory: "No conversation history yet.",
          recurring_themes: [],
          source: "cardiffnlp/twitter-roberta-base-sentiment-latest",
          is_trained_model: false,
          limitations: "No messages to analyze.",
        },
        facial_insights:
          frames >= 3 && faceSummary
            ? {
                available: true,
                sample_count: frames,
                dominant_emotion: faceSummary.dominantEmotion,
                distribution: faceSummary.distribution,
                mean_scores: faceSummary.meanScores,
                trajectory: faceSummary.trajectory,
                source: "MediaPipe-FaceLandmarker-FACS-v1",
                limitations: faceSummary.limitations,
              }
            : {
                available: false,
                reason:
                  frames > 0
                    ? `Insufficient observations collected (${frames} frame${frames !== 1 ? "s" : ""}; minimum 3 required for stability).`
                    : cameraEnabled
                    ? "Camera is active but looking for a centered face in the frame."
                    : "Camera tracking was not enabled by the user.",
                sample_count: frames,
                dominant_emotion: null,
                distribution: faceSummary?.distribution || {},
                mean_scores: faceSummary?.meanScores || {},
                trajectory: "No camera tracking data recorded.",
                source: "MediaPipe-FaceLandmarker-FACS-v1",
                limitations: "Camera tracking was inactive or insufficient.",
              },
        cross_source_comparison: {
          concordance_status: frames >= 3 ? "single_source_face" : "unavailable",
          title:
            frames >= 3
              ? "Single-Source: Facial Landmark Cues"
              : "Data Unavailable",
          description:
            frames >= 3
              ? `Analysis based exclusively on ${frames} facial observation frames. Submit chat messages to enable conversational text analysis.`
              : "Submit messages in the chat and enable camera cues to generate full multimodal emotional insights.",
          user_vs_model_fact_note:
            "Model predictions are statistical estimates. User words represent personal self-reports.",
        },
        reflection_and_resources: {
          reflection_questions: [
            "What topics or thoughts are currently occupying your attention today?",
            "How does your energy feel right now compared to earlier in the day?",
            "What is one small restorative practice you could try right now?",
          ],
          wellness_resources: [
            {
              title: "Tele-MANAS",
              contact: "14416 (or 1800-891-4416)",
              description: "24/7 free mental health counseling across India.",
            },
            {
              title: "KIRAN Helpline",
              contact: "1800-599-0019",
              description: "Free psychological first-aid and support.",
            },
            {
              title: "National Emergency Number",
              contact: "112",
              description: "Immediate life-safety response.",
            },
          ],
          disclaimer: "Observational reflection aid only. Strictly non-diagnostic.",
        },
      });
      return;
    }

    try {
      const res = await getEmotionalReport(conversationId, faceSummary);
      setReportData(res);
    } catch (err: any) {
      setReportError(err?.message || "Failed to load emotional insights report.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleClearAnalysis = async () => {
    sampler.current?.reset();
    setSampleCount(0);
    setDominantEmotion(null);
    setCurrentEmotions(null);

    if (!conversationId) {
      setReportData(null);
      setClearFeedback("Session analysis cleared.");
      return;
    }
    try {
      const res = await clearConversationAnalysis(conversationId);
      setClearFeedback(res.message || "Derived analysis cleared.");
      const faceSummary = sampler.current?.getSessionSummary();
      const updated = await getEmotionalReport(conversationId, faceSummary);
      setReportData(updated);
    } catch (err: any) {
      setReportError(err?.message || "Failed to clear analysis data.");
    }
  };

  return (
    <div className="chat-page-shell">
      {/* On-device camera video element and floating mirror preview */}
      <div
        className="camera-mirror-box"
        style={{
          display: cameraEnabled && cameraStatus === "active" ? "flex" : "none",
          flexDirection: "column",
          width: showVideoPreview ? "170px" : "auto",
        }}
        aria-label="Facial tracking self-view"
      >
        <div
          style={{
            position: "relative",
            width: "170px",
            height: showVideoPreview ? "125px" : "0px",
            overflow: "hidden",
            background: "#120e14",
            display: showVideoPreview ? "block" : "none",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)",
              display: "block",
            }}
            aria-label="On-device facial analysis webcam stream"
          />
          {facePresence === "detected" ? (
            <span
              style={{
                position: "absolute",
                top: "6px",
                left: "6px",
                fontSize: "10px",
                fontWeight: 600,
                background: "rgba(34, 197, 94, 0.9)",
                color: "#fff",
                padding: "2px 7px",
                borderRadius: "999px",
                letterSpacing: "0.2px",
              }}
            >
              Face in frame
            </span>
          ) : (
            <span
              style={{
                position: "absolute",
                top: "6px",
                left: "6px",
                fontSize: "10px",
                fontWeight: 500,
                background: "rgba(234, 88, 12, 0.9)",
                color: "#fff",
                padding: "2px 7px",
                borderRadius: "999px",
              }}
            >
              Looking for face
            </span>
          )}

          {dominantEmotion && (
            <span
              style={{
                position: "absolute",
                bottom: "6px",
                left: "6px",
                fontSize: "10px",
                fontWeight: 500,
                background: "rgba(0, 0, 0, 0.65)",
                color: "#fff",
                padding: "2px 6px",
                borderRadius: "6px",
                maxWidth: "158px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {dominantEmotion}
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "5px 8px",
            fontSize: "11px",
            color: "var(--wine)",
            background: "var(--blush)",
            borderTop: showVideoPreview ? "1px solid var(--line)" : "none",
          }}
        >
          <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
            <span className="camera-dot active" style={{ width: "6px", height: "6px" }} />
            {sampleCount} frame{sampleCount !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={() => setShowVideoPreview((v) => !v)}
            style={{
              background: "none",
              border: 0,
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: "10px",
              padding: "2px 4px",
            }}
            title={showVideoPreview ? "Hide preview mirror" : "Show preview mirror"}
          >
            {showVideoPreview ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
        </div>
      </div>

      {/* Hidden fallback video node if mirror is not rendered */}
      {(!cameraEnabled || cameraStatus !== "active") && (
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            position: "fixed",
            bottom: "0",
            right: "0",
            width: "320px",
            height: "240px",
            opacity: 0.0001,
            pointerEvents: "none",
            zIndex: -99,
          }}
          aria-hidden="true"
        />
      )}

      <div className="container" style={{ position: "relative" }}>
        {/* Ambient Halo Radial Glow */}
        <div
          className="halo"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "680px",
            height: "680px",
            zIndex: 0,
          }}
        />

        <div className="chat-room-container" style={{ zIndex: 1 }}>
          {/* Header Bar */}
          <header className="chat-room-header">
            <div className="chat-title-area">
              <div className="companion-avatar">
                <Spark />
              </div>
              <div className="companion-info">
                <h2>Haven Companion</h2>
                <p>
                  {status?.provider === "groq"
                    ? "AI Reflection Companion • Private • Confidential"
                    : "Local AI Reflection Companion • Private • On-Device"}
                </p>
              </div>
            </div>

            <div className="chat-room-controls">
              {/* Minimal Camera Status Indicator & Toggle */}
              <button
                type="button"
                className={`camera-toggle-btn ${cameraStatus}`}
                onClick={handleToggleCamera}
                title={
                  cameraEnabled
                    ? `Camera enabled (${sampleCount} frames collected). Click to turn off.`
                    : "Enable camera for private on-device facial cues (no video is saved or sent)."
                }
                aria-label={`Camera cues: ${cameraStatus}. Click to toggle.`}
                aria-pressed={cameraEnabled}
              >
                <span className={`camera-dot ${cameraStatus}`} aria-hidden="true" />
                <span>
                  {cameraStatus === "active"
                    ? `Camera Active${sampleCount > 0 ? ` (${sampleCount}f)` : ""}`
                    : cameraStatus === "connecting"
                    ? "Connecting..."
                    : cameraStatus === "denied"
                    ? "Permission Denied"
                    : cameraStatus === "unavailable"
                    ? "No Camera"
                    : cameraStatus === "error"
                    ? "Model Error"
                    : "Camera Off"}
                </span>
                {cameraEnabled ? (
                  <CameraOff size={13} aria-hidden="true" />
                ) : (
                  <Camera size={13} aria-hidden="true" />
                )}
              </button>

              {/* AI Runtime Status Pill */}
              <div
                className="status-pill"
                onClick={() => setShowSetupGuide((v) => !v)}
                title={status?.message || "Checking AI runtime..."}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && setShowSetupGuide((v) => !v)}
                aria-label="Toggle AI runtime information"
              >
                <span
                  className={`status-dot ${status?.available ? "online" : "offline"}`}
                  aria-hidden="true"
                />
                <span>
                  {statusLoading
                    ? "Connecting..."
                    : status?.available
                    ? `AI Online: ${status.model}`
                    : status?.provider === "groq"
                    ? "Groq AI Offline"
                    : status?.provider === "ollama"
                    ? "Local AI Offline"
                    : "AI Offline"}
                </span>
                <HelpCircle size={13} aria-hidden="true" style={{ color: "var(--muted)" }} />
              </div>

              {/* Emotional Insights Report Button */}
              <button
                type="button"
                className="button secondary sm"
                onClick={handleOpenReport}
                title="View Combined Emotional Insights Report"
              >
                <BarChart3 size={13} aria-hidden="true" />
                <span>Insights Report</span>
              </button>

              {/* New Conversation Button */}
              <button
                type="button"
                className="button secondary sm"
                onClick={handleNewConversation}
                title="Clear conversation history and start fresh"
              >
                <Trash2 size={13} aria-hidden="true" />
                <span>New Chat</span>
              </button>
            </div>
          </header>

          {/* Setup / Privacy Guide (expandable) */}
          {showSetupGuide && (
            <div
              style={{
                padding: "16px 24px",
                background: "var(--blush)",
                borderBottom: "1px solid var(--line)",
                fontSize: "13px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>
                  <Terminal size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                  {status?.provider === "groq"
                    ? "GroqCloud AI Runtime"
                    : status?.provider === "ollama"
                    ? "Local Inference Setup (Ollama)"
                    : "AI Runtime Status"}
                </strong>
                <button
                  type="button"
                  style={{ background: "none", border: 0, color: "var(--wine)", cursor: "pointer" }}
                  onClick={() => setShowSetupGuide(false)}
                >
                  Close
                </button>
              </div>
              {status?.provider === "groq" ? (
                <>
                  <p style={{ margin: "6px 0 10px", color: "var(--muted)" }}>
                    Haven Companion is configured to use GroqCloud hosted inference:
                  </p>
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "12px" }}>
                    <span>Provider: <strong>GroqCloud</strong></span>
                    <span>Model: <strong>{status?.model || "openai/gpt-oss-20b"}</strong></span>
                    <span>
                      Status: <strong>{status?.available ? "Online & Ready" : "Offline"}</strong> ({status?.message})
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ margin: "6px 0 10px", color: "var(--muted)" }}>
                    Haven runs open-weight models locally. Ensure Ollama is active with <code>{status?.model || "qwen2.5:3b"}</code>:
                  </p>
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "12px" }}>
                    <span>1. <code>ollama serve</code></span>
                    <span>2. <code>ollama pull {status?.model || "qwen2.5:3b"}</code></span>
                    <span>
                      Status: <strong>{status?.available ? "Online & Ready" : "Unreachable"}</strong> ({status?.message})
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Message History Thread */}
          <div
            ref={chatThreadRef}
            onScroll={handleScroll}
            className="chat-messages-container"
            aria-live="polite"
            aria-label="Wellness chat history"
          >
            {messages.map((msg, index) => {
              const isLatestAssistant = msg.role === "assistant" && index === messages.length - 1;
              return (
                <div
                  key={msg.id}
                  ref={isLatestAssistant ? (el) => { lastAssistantMessageRef.current = el; } : undefined}
                  className={`msg-wrapper ${msg.role === "user" ? "user" : "assistant"}`}
                >
                  <div className="msg-meta">
                    {msg.role === "user" ? (
                      <>
                        <UserIcon size={11} aria-hidden="true" />
                        <span>You</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={11} aria-hidden="true" />
                        <span>Haven Companion</span>
                      </>
                    )}
                    <span>&bull;</span>
                    <span>{msg.createdAt}</span>
                  </div>

                  <div
                    className={`msg-bubble ${
                      msg.role === "user"
                        ? "user"
                        : msg.isError
                        ? "error"
                        : msg.safetyStatus === "crisis_intercepted"
                        ? "crisis"
                        : "assistant"
                    }`}
                  >
                    {msg.content.split("\n\n").map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}

                    {/* Crisis Escalation Card */}
                    {msg.safetyStatus === "crisis_intercepted" && (
                      <div className="crisis-escalation-card">
                        <div className="crisis-card-header">
                          <PhoneCall size={16} aria-hidden="true" />
                          <span>Immediate 24/7 Verified Support</span>
                        </div>
                        <p style={{ fontSize: "12px", margin: "6px 0", color: "var(--muted)" }}>
                          If you are going through a difficult moment, free and confidential support is available right now:
                        </p>
                        <div className="crisis-helplines-grid">
                          {(msg.crisisResources || []).map((res) => (
                            <div className="crisis-helpline-row" key={res.name}>
                              <span>
                                <strong>{res.name}</strong> ({res.hours || "24/7"}):
                              </span>
                              <a href={`tel:${res.contact.split(" ")[0]}`}>
                                {res.contact}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bubble Footer */}
                    {msg.role === "assistant" && !msg.isError && (
                      <div className="bubble-footer">
                        <button
                          type="button"
                          className="copy-button"
                          onClick={() => handleCopy(msg.id, msg.content)}
                          aria-label="Copy message text"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check size={11} aria-hidden="true" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} aria-hidden="true" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        {msg.model && (
                          <span className="model-tag">
                            {msg.provider} / {msg.model}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Retry CTA on Error */}
                    {msg.isError && (
                      <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
                        <Button variant="primary" className="sm" onClick={handleRetry}>
                          <RefreshCw size={12} aria-hidden="true" />
                          <span>Retry</span>
                        </Button>
                        <Button variant="secondary" className="sm" onClick={() => setShowSetupGuide(true)}>
                          Setup Guide
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {loading && (
              <div className="msg-wrapper assistant">
                <div className="msg-meta">
                  <Sparkles size={11} aria-hidden="true" />
                  <span>Haven Companion</span>
                </div>
                <div className="typing-dots">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span style={{ fontSize: "12px", color: "var(--muted)", marginLeft: "8px" }}>
                    Reflecting with care...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Starter Chips (on fresh session) */}
          {messages.length <= 1 && !loading && (
            <div className="starter-prompts" aria-label="Suggested reflection topics">
              <div className="starter-prompts-label">
                <Sparkles size={11} aria-hidden="true" />
                <span>Suggested reflections &bull; Click to ask</span>
              </div>
              <div className="starter-prompts-grid">
                {STARTER_PROMPTS.map((starter) => (
                  <button
                    type="button"
                    key={starter.title}
                    className="starter-chip"
                    onClick={() => submitMessage(starter.prompt)}
                  >
                    <span>{starter.title}</span>
                    <Arrow />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Composer Input Bar */}
          <footer className="chat-composer-bar">
            <form className="chat-composer-form" onSubmit={handleSubmit}>
              <div className="chat-input-wrapper">
                <textarea
                  ref={textareaRef}
                  className="chat-textarea"
                  placeholder="Share what is on your mind... (Press Enter to send, Shift+Enter for newline)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  maxLength={1500}
                  rows={2}
                  aria-label="Your reflection message"
                />
                <div className="chat-input-footer">
                  <span>{input.length} / 1500</span>
                  <span>
                    <Shield size={10} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                    {status?.provider === "groq"
                      ? "Private AI Reflection • Confidential"
                      : "100% On-Device AI • No Cloud Tracking"}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="chat-send-button"
                disabled={!input.trim() || loading}
                aria-label="Send message"
              >
                {loading ? <RefreshCw size={18} className="spin" /> : <Arrow />}
              </button>
            </form>
          </footer>
        </div>
      </div>

      {/* Camera Consent Dialog */}
      {cameraConsentOpen && (
        <Dialog
          open={cameraConsentOpen}
          onClose={() => setCameraConsentOpen(false)}
          title="Enable Local Camera Cues"
        >
          <div style={{ lineHeight: 1.6 }}>
            <p style={{ color: "var(--muted)", marginBottom: "16px" }}>
              Haven can observe facial expressions locally in your browser using MediaPipe. This provides gentle,
              non-clinical emotional cues to help Haven communicate with more empathy.
            </p>
            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
                padding: "16px",
                background: "var(--blush)",
                borderRadius: "16px",
                marginBottom: "24px",
              }}
            >
              <ShieldCheck size={20} style={{ color: "var(--wine)", flexShrink: 0, marginTop: "2px" }} />
              <div style={{ fontSize: "13px" }}>
                <strong>100% On-Device Privacy Guaranteed:</strong>
                <p style={{ margin: "4px 0 0", color: "var(--ink)" }}>
                  No photos or video streams are ever stored, uploaded, or transmitted. Inference runs locally in browser memory via WebAssembly.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <Button variant="secondary" onClick={() => setCameraConsentOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmEnableCamera}>
                Enable Camera Cues
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Combined Emotional Insights Report Dialog */}
      {reportOpen && (
        <Dialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          title="Combined Emotional Insights Report"
          className="report-dialog"
        >
          {reportLoading ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <Loading label="Synthesizing conversational NLP reflections and on-device facial tracking..." />
            </div>
          ) : reportError ? (
            <div style={{ padding: "20px 0" }}>
              <div
                style={{
                  padding: "16px",
                  background: "rgba(225, 29, 72, 0.08)",
                  borderRadius: "14px",
                  border: "1px solid rgba(225, 29, 72, 0.2)",
                  color: "#be123c",
                  marginBottom: "20px",
                  fontSize: "14px",
                }}
              >
                <AlertCircle size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: "8px" }} />
                {reportError}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <Button variant="secondary" onClick={() => setReportOpen(false)}>
                  Close
                </Button>
                <Button variant="primary" onClick={handleOpenReport}>
                  Retry Analysis
                </Button>
              </div>
            </div>
          ) : reportData ? (
            <div className="report-dialog-shell">
              {/* Top Synthesis Mode Banner */}
              <div className="report-mode-banner">
                <div>
                  <span
                    className={`report-mode-tag ${
                      reportData.session_summary.sources_enabled.nlp_analysis &&
                      reportData.session_summary.sources_enabled.facial_analysis
                        ? "multimodal"
                        : reportData.session_summary.sources_enabled.nlp_analysis
                        ? "single-nlp"
                        : reportData.session_summary.sources_enabled.facial_analysis
                        ? "single-face"
                        : "preliminary"
                    }`}
                  >
                    {reportData.session_summary.sources_enabled.nlp_analysis &&
                    reportData.session_summary.sources_enabled.facial_analysis ? (
                      <>
                        <Sparkles size={12} />
                        Multimodal Synthesis Active
                      </>
                    ) : reportData.session_summary.sources_enabled.nlp_analysis ? (
                      <>
                        <Sparkles size={12} />
                        Single-Source: Written Reflections
                      </>
                    ) : reportData.session_summary.sources_enabled.facial_analysis ? (
                      <>
                        <Camera size={12} />
                        Single-Source: Facial Landmark Cues
                      </>
                    ) : (
                      <>
                        <Info size={12} />
                        Preliminary Overview
                      </>
                    )}
                  </span>
                  <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--ink)", lineHeight: 1.5 }}>
                    {reportData.cross_source_comparison.description}
                  </p>
                </div>
              </div>

              {clearFeedback && (
                <div
                  style={{
                    padding: "10px 16px",
                    background: "var(--blush)",
                    borderRadius: "12px",
                    color: "var(--wine)",
                    fontSize: "13px",
                  }}
                >
                  <CheckCircle size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
                  {clearFeedback}
                </div>
              )}

              {/* 4-Metric Overview Grid */}
              <div className="report-metrics-grid">
                <div className="report-metric-card">
                  <span className="report-metric-label">Messages Analyzed</span>
                  <p className="report-metric-val">{reportData.session_summary.user_messages_analyzed}</p>
                  <span className="report-metric-sub">
                    {reportData.session_summary.sources_enabled.nlp_analysis ? "Conversational NLP" : "None sent yet"}
                  </span>
                </div>
                <div className="report-metric-card">
                  <span className="report-metric-label">Camera Frames</span>
                  <p className="report-metric-val">{reportData.session_summary.facial_frames_analyzed}</p>
                  <span className="report-metric-sub">
                    {reportData.session_summary.facial_frames_analyzed >= 3
                      ? "Stable baseline (≥3)"
                      : reportData.session_summary.facial_frames_analyzed > 0
                      ? "Insufficient (<3 req.)"
                      : "No frames captured"}
                  </span>
                </div>
                <div className="report-metric-card">
                  <span className="report-metric-label">Session Duration</span>
                  <p className="report-metric-val">{Math.round(reportData.session_summary.duration_seconds)}s</p>
                  <span className="report-metric-sub">Active check-in time</span>
                </div>
                <div className="report-metric-card">
                  <span className="report-metric-label">Synthesis Status</span>
                  <p className="report-metric-val" style={{ fontSize: "15px", textTransform: "capitalize" }}>
                    {reportData.cross_source_comparison.concordance_status.replace(/_/g, " ")}
                  </p>
                  <span className="report-metric-sub" title={reportData.cross_source_comparison.title}>
                    {reportData.cross_source_comparison.title.slice(0, 24)}...
                  </span>
                </div>
              </div>

              {/* Card 1: Written Language Analysis */}
              <div className="report-card">
                <div className="report-card-header">
                  <h4 className="report-card-title">
                    <Sparkles size={16} style={{ color: "var(--wine)" }} />
                    Conversational Written Language Analysis
                  </h4>
                  <span
                    style={{
                      fontSize: "12px",
                      padding: "3px 10px",
                      borderRadius: "999px",
                      background: reportData.nlp_insights.available ? "var(--blush)" : "#f1f5f9",
                      color: reportData.nlp_insights.available ? "var(--wine)" : "var(--muted)",
                      fontWeight: 600,
                      textTransform: "capitalize",
                    }}
                  >
                    {reportData.nlp_insights.available
                      ? `Dominant: ${reportData.nlp_insights.dominant_sentiment || "Neutral"}`
                      : "Unavailable"}
                  </span>
                </div>

                {reportData.nlp_insights.available ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {reportData.nlp_insights.distribution &&
                      Object.keys(reportData.nlp_insights.distribution).length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>
                            Sentiment Breakdown
                          </span>
                          {Object.entries(reportData.nlp_insights.distribution).map(([tone, score]) => (
                            <div key={tone} className="emotion-bar-row">
                              <span style={{ textTransform: "capitalize", color: "var(--ink)" }}>{tone}</span>
                              <div className="emotion-bar-track">
                                <div
                                  className="emotion-bar-fill"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, typeof score === "number" ? (score <= 1 ? score * 100 : score) : 0))}%`,
                                    background: getEmotionColor(tone),
                                  }}
                                />
                              </div>
                              <span style={{ textAlign: "right", color: "var(--muted)", fontWeight: 500 }}>
                                {typeof score === "number" ? Math.round(score <= 1 ? score * 100 : score) : 0}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: "12px",
                        padding: "12px",
                        background: "var(--ivory)",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    >
                      <div>
                        <strong style={{ color: "var(--muted)" }}>Trajectory: </strong>
                        <span style={{ color: "var(--ink)", textTransform: "capitalize" }}>
                          {reportData.nlp_insights.trajectory || "Stable"}
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: "var(--muted)" }}>Analysis Model: </strong>
                        <span style={{ color: "var(--ink)" }}>{reportData.nlp_insights.source || "NLP Classifier"}</span>
                      </div>
                    </div>

                    {reportData.nlp_insights.recurring_themes && reportData.nlp_insights.recurring_themes.length > 0 && (
                      <div>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "6px" }}>
                          Recurring Context Themes
                        </span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {reportData.nlp_insights.recurring_themes.map((theme, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: "11px",
                                padding: "3px 8px",
                                background: "var(--blush)",
                                color: "var(--wine)",
                                borderRadius: "8px",
                                fontWeight: 500,
                              }}
                            >
                              #{theme}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)", lineHeight: 1.4 }}>
                      {reportData.nlp_insights.limitations}
                    </p>
                  </div>
                ) : (
                  <div style={{ padding: "12px 16px", background: "var(--ivory)", borderRadius: "12px", fontSize: "13px", color: "var(--muted)" }}>
                    <p style={{ margin: 0 }}>
                      {reportData.nlp_insights.reason || "No typed reflections have been analyzed in this session yet."}
                    </p>
                  </div>
                )}
              </div>

              {/* Card 2: On-Device Facial-Expression Analysis */}
              <div className="report-card">
                <div className="report-card-header">
                  <h4 className="report-card-title">
                    <Camera size={16} style={{ color: "var(--wine)" }} />
                    On-Device Facial-Expression Tracking (MediaPipe FACS)
                  </h4>
                  <span
                    style={{
                      fontSize: "12px",
                      padding: "3px 10px",
                      borderRadius: "999px",
                      background: reportData.facial_insights.available ? "var(--blush)" : "#f1f5f9",
                      color: reportData.facial_insights.available ? "var(--wine)" : "var(--muted)",
                      fontWeight: 600,
                      textTransform: "capitalize",
                    }}
                  >
                    {reportData.facial_insights.available
                      ? `Dominant: ${reportData.facial_insights.dominant_emotion || "Neutral"}`
                      : reportData.session_summary.facial_frames_analyzed > 0
                      ? `${reportData.session_summary.facial_frames_analyzed} frames (Insufficient)`
                      : "Camera Unavailable"}
                  </span>
                </div>

                {reportData.facial_insights.available ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {reportData.facial_insights.distribution &&
                      Object.keys(reportData.facial_insights.distribution).length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)" }}>
                            Facial Blendshape Distribution
                          </span>
                          {Object.entries(reportData.facial_insights.distribution).map(([emotion, score]) => (
                            <div key={emotion} className="emotion-bar-row">
                              <span style={{ textTransform: "capitalize", color: "var(--ink)" }}>{emotion}</span>
                              <div className="emotion-bar-track">
                                <div
                                  className="emotion-bar-fill"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, typeof score === "number" ? (score <= 1 ? score * 100 : score) : 0))}%`,
                                    background: getEmotionColor(emotion),
                                  }}
                                />
                              </div>
                              <span style={{ textAlign: "right", color: "var(--muted)", fontWeight: 500 }}>
                                {typeof score === "number" ? Math.round(score <= 1 ? score * 100 : score) : 0}%
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: "12px",
                        padding: "12px",
                        background: "var(--ivory)",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    >
                      <div>
                        <strong style={{ color: "var(--muted)" }}>Sampled Frames: </strong>
                        <span style={{ color: "var(--ink)" }}>{reportData.facial_insights.sample_count} observations</span>
                      </div>
                      <div>
                        <strong style={{ color: "var(--muted)" }}>Privacy Isolation: </strong>
                        <span style={{ color: "var(--ink)" }}>Client WebAssembly Only (Zero Uploads)</span>
                      </div>
                    </div>

                    <p style={{ margin: 0, fontSize: "11px", color: "var(--muted)", lineHeight: 1.4 }}>
                      {reportData.facial_insights.limitations}
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "16px",
                      background: "var(--ivory)",
                      borderRadius: "14px",
                      border: "1px dashed var(--line)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--wine)", fontWeight: 600, fontSize: "13px" }}>
                      <CameraOff size={16} />
                      <span>Facial Tracking Observations Unavailable</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--ink)", lineHeight: 1.5 }}>
                      {reportData.facial_insights.reason ||
                        "Facial observations were not recorded during this session. Either camera permissions were not granted, or fewer than 3 frames were captured."}
                    </p>
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                      <strong>Strict Quality Guarantee:</strong> Haven never fabricates facial-expression data. A minimum of 3 consistent frames is strictly required to prevent erratic visual artifacts.
                    </div>
                  </div>
                )}
              </div>

              {/* Card 3: Cross-Source Concordance / Divergence */}
              <div
                style={{
                  padding: "20px",
                  background: "var(--blush)",
                  borderRadius: "20px",
                  border: "1px solid var(--line)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Activity size={18} style={{ color: "var(--wine)" }} />
                  <h4 style={{ margin: 0, color: "var(--wine)", font: "600 17px var(--serif)" }}>
                    {reportData.cross_source_comparison.title}
                  </h4>
                </div>

                <p style={{ margin: 0, fontSize: "13px", color: "var(--ink)", lineHeight: 1.6 }}>
                  {reportData.cross_source_comparison.description}
                </p>

                {reportData.cross_source_comparison.divergence_explanation && (
                  <div
                    style={{
                      padding: "12px 14px",
                      background: "rgba(255, 255, 255, 0.8)",
                      borderRadius: "12px",
                      border: "1px solid var(--line)",
                      fontSize: "12px",
                      color: "var(--ink)",
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Context on Cues: </strong>
                    {reportData.cross_source_comparison.divergence_explanation}
                  </div>
                )}

                <small style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                  {reportData.cross_source_comparison.user_vs_model_fact_note}
                </small>
              </div>

              {/* Card 4: Reflection Prompts & Helplines */}
              <div className="report-card">
                <div className="report-card-header">
                  <h4 className="report-card-title">
                    <Sparkles size={16} style={{ color: "var(--wine)" }} />
                    Gentle Reflection Prompts
                  </h4>
                </div>
                <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "var(--ink)", lineHeight: 1.7 }}>
                  {reportData.reflection_and_resources.reflection_questions.map((q, idx) => (
                    <li key={idx} style={{ marginBottom: "6px" }}>{q}</li>
                  ))}
                </ul>

                {reportData.reflection_and_resources.wellness_resources &&
                  reportData.reflection_and_resources.wellness_resources.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--line)", paddingTop: "14px", marginTop: "6px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "8px" }}>
                        Confidential Student Helplines (24/7 Free)
                      </span>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                        {reportData.reflection_and_resources.wellness_resources.map((res, i) => (
                          <div
                            key={i}
                            style={{
                              padding: "10px 12px",
                              background: "var(--ivory)",
                              borderRadius: "10px",
                              border: "1px solid var(--line)",
                              fontSize: "12px",
                            }}
                          >
                            <div style={{ fontWeight: 600, color: "var(--wine)" }}>{res.title}</div>
                            {res.contact && (
                              <a
                                href={`tel:${res.contact}`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  color: "var(--wine)",
                                  fontWeight: 700,
                                  textDecoration: "none",
                                  marginTop: "2px",
                                }}
                              >
                                <PhoneCall size={11} />
                                {res.contact}
                              </a>
                            )}
                            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "11px" }}>
                              {res.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              {/* Disclaimer & Actions */}
              <div
                style={{
                  borderTop: "1px solid var(--line)",
                  paddingTop: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "14px",
                }}
              >
                <small style={{ fontSize: "11px", color: "var(--muted)", maxWidth: "420px", lineHeight: 1.4 }}>
                  {reportData.reflection_and_resources.disclaimer}
                </small>
                <div style={{ display: "flex", gap: "10px" }}>
                  <Button variant="secondary" className="sm" onClick={handleClearAnalysis}>
                    <Trash2 size={13} style={{ marginRight: "4px" }} />
                    Clear Session Analysis
                  </Button>
                  <Button variant="primary" className="sm" onClick={() => setReportOpen(false)}>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </Dialog>
      )}
    </div>
  );
}
