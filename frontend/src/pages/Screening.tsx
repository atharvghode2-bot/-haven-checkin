import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Camera,
  CameraOff,
  Check,
  Mic,
  MicOff,
  PhoneCall,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { api, type Item, type Result } from "../api/client";
import { Button, Dialog } from "../components/Ui";
import {
  startFaceSampler,
  type CameraStatus,
  type EmotionMap,
  type FacePresence,
  type FaceSamplerHandle,
} from "../lib/face";
import { createRecognizer } from "../lib/voice";

type Message = {
  id: string;
  who: "bot" | "user";
  text: string;
  acknowledgement?: string;
  timestamp: string;
};

function generateSafeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "fin_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now().toString(36);
}

export function Screening() {
  const navigate = useNavigate();
  const [consentOpen, setConsentOpen] = useState(true);
  const [camera, setCamera] = useState(false);
  const [voice, setVoice] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [interimCrisisTriggered, setInterimCrisisTriggered] = useState(false);

  // Minimal Camera Status & Emotion States
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("off");
  const [, setCameraStatusText] = useState("Camera off");
  const [facePresence, setFacePresence] = useState<FacePresence>("no_face");
  const [currentEmotions, setCurrentEmotions] = useState<EmotionMap | null>(null);
  const [dominantEmotion, setDominantEmotion] = useState<string | null>(null);
  const [sampleCount, setSampleCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const sampler = useRef<FaceSamplerHandle | null>(null);
  const rec = useRef<ReturnType<typeof createRecognizer>>(null);
  const finishKey = useRef(generateSafeId());
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat to bottom when messages update
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Keyboard shortcut support (1, 2, 3, 4 for Likert options)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (item && item.kind === "likert" && !busy && !submitting) {
        if (["1", "2", "3", "4"].includes(event.key)) {
          const val = parseInt(event.key, 10) - 1;
          setChoice(val);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item, busy, submitting]);

  async function begin(cameraConsent: boolean, voiceConsent: boolean) {
    setBusy(true);
    setError("");
    try {
      await api("/auth/consent", {
        method: "POST",
        body: JSON.stringify({ camera: cameraConsent, voice: voiceConsent, data_processing: true }),
      });
      const data = await api<{ session_id: string; item: Item }>("/sessions", {
        method: "POST",
        body: JSON.stringify({ camera_consent: cameraConsent, voice_consent: voiceConsent }),
      });
      setCamera(cameraConsent);
      setVoice(voiceConsent);
      setSessionId(data.session_id);
      setItem(data.item);
      setMessages([
        {
          id: "intro-1",
          who: "bot",
          text: "Hello! Welcome to your Haven Check-in. I am here to guide you through a private, structured screening. Take all the time you need.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
        {
          id: "item-0",
          who: "bot",
          text: data.item.prompt,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setConsentOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the check-in session.");
    } finally {
      setBusy(false);
    }
  }

  // Camera sampler initialization and lifecycle
  useEffect(() => {
    if (!sessionId || !camera || !videoRef.current) {
      if (!camera && sampler.current) {
        sampler.current.stop();
        sampler.current = null;
        setCameraStatus("off");
        setCameraStatusText("Camera off");
        setFacePresence("no_face");
        setCurrentEmotions(null);
        setDominantEmotion(null);
      }
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
      setCurrentEmotions(state.currentEmotions);
      setDominantEmotion(state.dominantEmotion);
      setSampleCount(state.sampleCount);
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
    };
  }, [sessionId, camera]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => rec.current?.stop();
  }, []);

  async function sendAnswer(event?: FormEvent) {
    event?.preventDefault();
    if (!sessionId || !item || busy || submitting) return;

    if (item.kind === "likert" && choice === null) {
      setError("Please select one of the response options below to continue.");
      return;
    }

    setBusy(true);
    setError("");

    // Check if safety phrase is detected locally in text
    if (item.kind === "text" && text) {
      const lower = text.toLowerCase();
      if (
        lower.includes("suicide") ||
        lower.includes("kill myself") ||
        lower.includes("want to die") ||
        lower.includes("self harm") ||
        lower.includes("end my life")
      ) {
        setInterimCrisisTriggered(true);
      }
    }
    // Also check PHQ9 item 9
    if (item.id === "phq9_9" && choice !== null && choice > 0) {
      setInterimCrisisTriggered(true);
    }

    const spokenAnswer =
      item.kind === "likert"
        ? item.options?.find((o) => o.value === choice)?.label || `Option ${choice}`
        : text.trim() || "(No additional text provided)";

    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        who: "user",
        text: spokenAnswer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);

    setChoice(null);
    setText("");
    setIsTyping(true);

    try {
      const data = await api<{
        done: boolean;
        item: Item | null;
        acknowledgement?: string;
        progress: { current: number; total: number };
      }>(`/sessions/${sessionId}/answer`, {
        method: "POST",
        body: JSON.stringify({
          item_id: item.id,
          value: item.kind === "likert" ? choice : null,
          text: item.kind === "text" ? text : null,
          face_emotion_scores: currentEmotions || null,
          face_sample_count: sampleCount,
        }),
      });

      // Brief conversational delay to simulate empathetic chatbot cadence
      await new Promise((resolve) => setTimeout(resolve, 350));
      setIsTyping(false);

      if (data.done || !data.item) {
        setItem(null);
        await finish();
      } else {
        setItem(data.item);
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            who: "bot",
            text: data.item!.prompt,
            acknowledgement: data.acknowledgement,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (err) {
      setIsTyping(false);
      setError(err instanceof Error ? err.message : "Could not save that response. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function back() {
    if (!sessionId || busy || submitting) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<{ item: Item }>(`/sessions/${sessionId}/back`, { method: "POST" });
      setItem(data.item);
      setMessages((prev) => {
        const copy = [...prev];
        if (copy.at(-1)?.who === "bot") copy.pop();
        if (copy.at(-1)?.who === "user") copy.pop();
        copy.push({
          id: `bot-back-${Date.now()}`,
          who: "bot",
          text: data.item.prompt,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
        return copy;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not navigate back.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!sessionId || submitting) return;
    setSubmitting(true);
    const faceResult = sampler.current?.stop();
    sampler.current = null;
    setCamera(false);
    setCameraStatus("off");

    try {
      const data = await api<{ result: Result }>(`/sessions/${sessionId}/finish`, {
        method: "POST",
        body: JSON.stringify({
          face_emotions: faceResult?.emotions || null,
          face_sample_count: faceResult?.sampleCount || 0,
          face_model_version: faceResult?.model || null,
          idempotency_key: finishKey.current,
        }),
      });
      sessionStorage.setItem(`haven_result_${sessionId}`, JSON.stringify(data.result));
      navigate(`/results/${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finalize your check-in. Please retry.");
      setSubmitting(false);
    }
  }

  function toggleVoice() {
    if (!voice) return;
    if (!rec.current) {
      rec.current = createRecognizer((heard) => {
        setText((prev) => `${prev} ${heard}`.trim());
      });
    }
    if (!rec.current) {
      setError("Speech recognition is not supported in this browser. Please use keyboard typing instead.");
      return;
    }
    if (listening) {
      rec.current.stop();
      setListening(false);
    } else {
      rec.current.start();
      setListening(true);
    }
  }

  function toggleCamera() {
    if (camera) {
      sampler.current?.stop();
      sampler.current = null;
      setCamera(false);
      setCameraStatus("off");
      setCameraStatusText("Camera off");
      setFacePresence("no_face");
      setCurrentEmotions(null);
      setDominantEmotion(null);
    } else {
      setCamera(true);
    }
  }

  const progress = item ? Math.round((item.index / item.total) * 100) : submitting ? 100 : 0;
  const instrumentBadge = item
    ? item.instrument === "phq9"
      ? "Depression Screening (PHQ-9)"
      : item.instrument === "gad7"
      ? "Anxiety Screening (GAD-7)"
      : "Personal Reflection"
    : "Review";

  return (
    <div className="screening-page reveal">
      {/* Hidden video element for local browser inference with 0 layout disruption */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          position: "fixed",
          top: "-9999px",
          left: "-9999px",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      />

      {/* Top Header & Progress */}
      <div className="screening-header-bar">
        <div>
          <p className="eyebrow">
            <Sparkles size={14} className="inline-icon" aria-hidden="true" />
            Confidential Screening Chatbot
          </p>
          <h1>Check-in Session</h1>
        </div>
        {item && (
          <div className="progress-info">
            <span className="question-count">
              Question <strong>{item.index + 1}</strong> of {item.total}
            </span>
            <span className="instrument-badge">{instrumentBadge}</span>
          </div>
        )}
      </div>

      <div className="progress-wrapper" aria-label={`Progress: ${progress}%`}>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="progress-percentage">{progress}%</span>
      </div>

      {/* Minimal Camera Status Indicator & Accessible Controls */}
      <div className="camera-minimal-bar" role="region" aria-label="Camera Status and Local Privacy">
        <div className="camera-indicator-group">
          <span
            className={`camera-dot ${cameraStatus}`}
            aria-hidden="true"
            title={`Camera status: ${cameraStatus}`}
          />
          <span className="camera-status-pill">
            {cameraStatus === "active"
              ? "Camera active"
              : cameraStatus === "connecting"
              ? "Connecting..."
              : cameraStatus === "denied"
              ? "Permission denied"
              : cameraStatus === "unavailable"
              ? "Camera unavailable"
              : cameraStatus === "error"
              ? "Camera error"
              : "Camera off"}
          </span>

          {cameraStatus === "active" && facePresence === "detected" && (
            <span className="camera-face-pill detected">
              <Check size={12} aria-hidden="true" />
              Face detected
            </span>
          )}
          {cameraStatus === "active" && facePresence === "no_face" && (
            <span className="camera-face-pill searching">Looking for face</span>
          )}
          {dominantEmotion && (
            <span
              className="camera-emotion-pill"
              title="Real-time estimated facial cues (experimental supplementary signal)"
            >
              {dominantEmotion}
            </span>
          )}
        </div>

        <div className="camera-action-group">
          <button
            type="button"
            className="camera-toggle-btn"
            onClick={toggleCamera}
            title={camera ? "Turn camera off" : "Enable camera for expression cues"}
            aria-pressed={camera}
          >
            {camera ? (
              <>
                <CameraOff size={14} aria-hidden="true" />
                <span>Stop Camera</span>
              </>
            ) : (
              <>
                <Camera size={14} aria-hidden="true" />
                <span>Enable Camera</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interim safety warning banner if crisis answer triggered */}
      {interimCrisisTriggered && (
        <div className="banner crisis mb-4" role="alert">
          <div className="flex-row items-center gap-2">
            <ShieldAlert size={20} className="text-red-400" aria-hidden="true" />
            <div>
              <strong>Safety Support Notice:</strong> We noticed your response mentions significant distress or thoughts of harm.
              Help is available right now: call Tele-MANAS at <strong>14416</strong> (Toll-free 24/7) or <strong>112</strong>.
              You do not have to wait to complete this session to receive support.
            </div>
          </div>
        </div>
      )}

      {/* Balanced 2-Column Layout: Chat on Left, Companion Sidebar on Right */}
      <div className="screening-grid">
        <section className="panel chat-panel">
          <div className="chat-stream" aria-live="polite">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message-row ${msg.who}`}>
                <div className="avatar-icon" aria-hidden="true">
                  {msg.who === "bot" ? <Bot size={18} /> : <UserIcon size={18} />}
                </div>
                <div className="bubble-wrapper">
                  {msg.acknowledgement && <div className="acknowledgement-note">{msg.acknowledgement}</div>}
                  <div className={`bubble ${msg.who}`}>{msg.text}</div>
                  <span className="timestamp">{msg.timestamp}</span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="chat-message-row bot" aria-label="Haven is preparing next question">
                <div className="avatar-icon">
                  <Bot size={18} />
                </div>
                <div className="bubble bot typing-bubble">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {error && <p className="error my-2">{error}</p>}

          {/* Answer Controls: Likert Chips or Free Text Input */}
          {item && (
            <form onSubmit={sendAnswer} className="screening-controls mt-2">
              {item.kind === "likert" && item.options && (
                <div className="likert-group">
                  <p className="likert-hint">
                    Select your answer below (or press keyboard keys 1&ndash;{item.options.length}):
                  </p>
                  <div className="chip-row">
                    {item.options.map((opt, i) => {
                      const selected = choice === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={`chip ${selected ? "selected" : ""}`}
                          onClick={() => setChoice(opt.value)}
                          aria-pressed={selected}
                        >
                          <span className="chip-number">{i + 1}</span>
                          <span className="chip-label">{opt.label}</span>
                          {selected && <Check size={16} className="chip-check" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {item.kind === "text" && (
                <div className="free-text-group">
                  <label htmlFor="screening-text-input" className="sr-only">
                    Your reflection
                  </label>
                  <textarea
                    id="screening-text-input"
                    className="textarea"
                    rows={4}
                    placeholder="Share any thoughts, feelings, or recent events you'd like to reflect on... (optional)"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>
              )}

              <div className="action-button-row">
                <div className="flex-row items-center gap-2">
                  {item.index > 0 && (
                    <Button type="button" variant="secondary" onClick={back} disabled={busy || submitting}>
                      <ArrowLeft size={16} aria-hidden="true" />
                      Back
                    </Button>
                  )}
                </div>

                {voice && item.kind === "text" && (
                  <Button
                    type="button"
                    variant={listening ? "danger" : "secondary"}
                    onClick={toggleVoice}
                    className={listening ? "voice-active-pulse" : ""}
                  >
                    {listening ? <MicOff size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
                    {listening ? "Stop voice" : "Voice input"}
                  </Button>
                )}

                <Button type="submit" variant="primary" disabled={busy || submitting} className="submit-answer-btn">
                  {submitting ? (
                    "Finalizing..."
                  ) : item.kind === "text" ? (
                    <>
                      Complete Check-in
                      <Send size={16} aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      Continue
                      <Send size={16} aria-hidden="true" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {submitting && (
            <div className="submitting-overlay" role="status">
              <Sparkles size={24} className="spinning text-accent" aria-hidden="true" />
              <p>Analyzing results and calculating wellness indices...</p>
            </div>
          )}
        </section>

        {/* Right Column: Clean Wellness & Privacy Companion Sidebar */}
        <aside className="wellness-sidebar">
          {/* Live Expression Breakdown card (only shown while camera is active) */}
          {cameraStatus === "active" && currentEmotions && (
            <div className="sidebar-emotion-card reveal">
              <div className="sidebar-emotion-title">
                <span>Facial Cues Breakdown</span>
                <span className="muted-xs">{sampleCount} samples</span>
              </div>
              <p className="muted-xs mb-2">
                On-device classification. Supplementary experimental signal only, not a clinical measurement.
              </p>
              <div className="emotion-bars-list">
                {Object.entries(currentEmotions).map(([emotion, score]) => (
                  <div key={emotion} className="emotion-bar-row">
                    <span className="emotion-bar-label">{emotion}</span>
                    <div className="emotion-bar-track">
                      <div className="emotion-bar-fill" style={{ width: `${Math.round(score * 100)}%` }} />
                    </div>
                    <span className="emotion-bar-pct">{Math.round(score * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Privacy Reassurance Card */}
          <div className="privacy-note-card">
            <h4>
              <ShieldCheck size={16} className="text-accent inline-icon" aria-hidden="true" />
              Local Privacy Guarantee
            </h4>
            <p className="muted-xs">
              Facial expression estimation runs strictly on your device via WebAssembly. Video is{" "}
              <strong>never recorded, stored, or transmitted</strong> to any server.
            </p>
          </div>

          {/* Emergency helpline pill in sidebar */}
          <div className="sidebar-emergency-card">
            <PhoneCall size={16} className="text-accent" aria-hidden="true" />
            <div>
              <strong>Emergency Crisis Line:</strong>
              <p className="muted-xs">Tele-MANAS: 14416 &bull; Emergency: 112</p>
            </div>
          </div>
        </aside>
      </div>

      {/* Consent Dialog on Check-in Start */}
      {consentOpen && (
        <Dialog title="Before You Begin Your Check-in" onClose={() => navigate("/app")}>
          <div className="dialog-content">
            <p className="muted mb-3">
              Haven Check-in is a private, confidential screening tool. You can complete all questions using your keyboard
              alone. Voice typing and local facial expression detection are entirely optional.
            </p>

            <div className="consent-options-list">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={voice}
                  onChange={(e) => setVoice(e.target.checked)}
                />
                <div>
                  <strong>Enable Microphone (Optional)</strong>
                  <p className="muted-xs">Transcribes your spoken thoughts locally into the text box.</p>
                </div>
              </label>

              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={camera}
                  onChange={(e) => setCamera(e.target.checked)}
                />
                <div>
                  <strong>Enable Local Camera Cues (Optional)</strong>
                  <p className="muted-xs">
                    Detects facial expressions in your browser. <em>No images or video ever leave your device.</em>
                  </p>
                </div>
              </label>
            </div>

            <div className="consent-disclaimer-box">
              <ShieldCheck size={18} className="text-accent" aria-hidden="true" />
              <p className="muted-xs">
                This is a mental wellness screening aid, not a clinical diagnosis. In case of immediate crisis, contact
                Tele-MANAS (14416) or 112.
              </p>
            </div>

            {error && <p className="error mt-2">{error}</p>}

            <div className="dialog-actions">
              <Button type="button" variant="secondary" onClick={() => navigate("/app")}>
                Return to Dashboard
              </Button>
              <Button type="button" variant="primary" onClick={() => void begin(camera, voice)} disabled={busy}>
                {busy ? "Starting..." : camera || voice ? "Continue with Selected Options" : "Continue with Text Only"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
