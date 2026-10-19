// Screening results with transparent multimodal breakdown, crisis resources, and non-stigmatizing self-care guidance.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Camera,
  CheckCircle2,
  FileText,
  MessageSquare,
  PhoneCall,
  Printer,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api, type Result } from "../api/client";
import { Loading, Status } from "../components/Ui";

function bandExplanation(band: Result["band"]) {
  if (band === "elevated") {
    return {
      title: "Elevated Load Detected",
      summary:
        "Your responses reflect higher recent levels of distress or load. Extra support from a campus counselor or trusted human is strongly encouraged. Remember, this screening is not a clinical diagnosis.",
      colorClass: "elevated",
    };
  }
  if (band === "moderate") {
    return {
      title: "Moderate Load Detected",
      summary:
        "Your responses suggest a moderate recent load with noticeable fatigue or worry. Taking proactive grounding steps and protecting sleep routines can prevent stress from compounding.",
      colorClass: "moderate",
    };
  }
  return {
    title: "Lower Current Load",
    summary:
      "Your responses suggest lower current load. Continue the routines and restorative habits that are supporting your energy and balance.",
    colorClass: "lower",
  };
}

export function Results() {
  const { sessionId } = useParams();
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const cached = sessionStorage.getItem(`haven_result_${sessionId}`);
    if (cached) {
      try {
        setResult(JSON.parse(cached) as Result);
        return;
      } catch {
        // Fall back to server fetch
      }
    }
    api<{ result: Result | null }>(`/sessions/${sessionId}`)
      .then((data) => {
        if (!data.result) throw new Error("That check-in session has no results recorded yet.");
        setResult(data.result);
      })
      .catch((err) => setError(err.message));
  }, [sessionId]);

  if (error) {
    return (
      <div className="panel error-panel reveal">
        <h1>Results Unavailable</h1>
        <p className="error">{error}</p>
        <Link className="btn btn-primary mt-3" to="/app">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!result) return <Loading label="Calculating wellness screening summary" />;

  const bandInfo = bandExplanation(result.band);

  return (
    <div className="results-page reveal">
      {/* Header Banner */}
      <div className="results-header-block">
        <p className="eyebrow">
          <Sparkles size={14} className="inline-icon" aria-hidden="true" />
          Screening Summary Completed
        </p>
        <h1>Your Check-in Summary</h1>
        <p className="lede">{bandInfo.summary}</p>
      </div>

      {/* Urgent Crisis Alert Banner if crisis flagged */}
      {result.crisis && (
        <section className="banner crisis results-crisis-banner" role="alert">
          <div className="crisis-banner-top">
            <ShieldAlert size={26} className="text-red-400" aria-hidden="true" />
            <div>
              <h2>Immediate Support is Available 24/7</h2>
              <p>
                One or more of your responses indicated severe distress, thoughts of death, or self-harm. Please know that
                you do not have to carry this alone. You can speak with a caring, trained counselor right now for free.
              </p>
            </div>
          </div>

          <div className="crisis-hotlines-inline">
            <div className="hotline-chip featured">
              <PhoneCall size={16} aria-hidden="true" />
              <span>
                <strong>Tele-MANAS (India):</strong> 14416 (or 1800-891-4416) &bull; Free &bull; 24/7
              </span>
            </div>
            <div className="hotline-chip">
              <PhoneCall size={16} aria-hidden="true" />
              <span>
                <strong>Emergency Services:</strong> 112 (Immediate Help)
              </span>
            </div>
            <div className="hotline-chip">
              <PhoneCall size={16} aria-hidden="true" />
              <span>
                <strong>KIRAN Helpline:</strong> 1800-599-0019
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Overall Risk & Score Cards */}
      <div className="grid-2 mt-4">
        <div className={`panel risk-score-card static ${bandInfo.colorClass}`}>
          <div className="flex-row justify-between items-center mb-2">
            <span className="card-kicker">Overall Screening Load</span>
            <Status value={result.band} />
          </div>
          <div className="big-score-display">
            <span className="score-number">{Math.round(result.final_risk)}</span>
            <span className="score-max">/ 100</span>
          </div>
          <p className="score-subtitle">{bandInfo.title}</p>
          <p className="muted-sm">
            Combines questionnaire totals with optional reflections. Scores above 60 or crisis flags indicate elevated recent load.
          </p>
        </div>

        <div className="panel counselor-status-card static">
          <div className="card-kicker">Counselor Notification State</div>
          {result.counselor_notified ? (
            <div className="notified-state">
              <CheckCircle2 size={24} className="text-accent" aria-hidden="true" />
              <div>
                <h3>Confidential Alert Created</h3>
                <p className="muted-sm">
                  An alert with your anonymous code was logged for campus counselor review. Your personal email remains protected.
                  A counselor may initiate outreach through official campus channels.
                </p>
              </div>
            </div>
          ) : (
            <div className="unnotified-state">
              <ShieldCheck size={24} className="text-accent" aria-hidden="true" />
              <div>
                <h3>No Alert Triggered</h3>
                <p className="muted-sm">
                  Your screening indicators did not meet the threshold for automatic counselor notification. You are always welcome
                  to reach out directly to campus health or crisis resources at any time.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Multimodal Score Breakdown */}
      <section className="mt-4">
        <h2>Multimodal Signal Breakdown</h2>
        <p className="muted-sm mb-3">
          Calculated using the documented architecture formula: <code>0.5 &times; Questionnaire + 0.3 &times; Text + 0.2 &times; Face</code> (normalized to 0&ndash;100).
        </p>

        <div className="grid-3">
          <div className="panel static metric-card">
            <div className="metric-header">
              <FileText size={20} className="text-accent" aria-hidden="true" />
              <h4>Questionnaire (50%)</h4>
            </div>
            <div className="metric-scores">
              <div>
                <span className="metric-label">PHQ-9 Depression:</span>
                <strong>{result.phq9} / 27</strong>
              </div>
              <div>
                <span className="metric-label">GAD-7 Anxiety:</span>
                <strong>{result.gad7} / 21</strong>
              </div>
              <div>
                <span className="metric-label">Normalized Score:</span>
                <strong>{result.questionnaire_score} / 100</strong>
              </div>
            </div>
          </div>

          <div className="panel static metric-card">
            <div className="metric-header">
              <MessageSquare size={20} className="text-accent" aria-hidden="true" />
              <h4>Text Sentiment (30%)</h4>
            </div>
            <div className="metric-scores">
              <div>
                <span className="metric-label">Sentiment Load:</span>
                <strong>
                  {result.text_sentiment_score !== null ? `${result.text_sentiment_score} / 100` : "Skipped / None"}
                </strong>
              </div>
              <div>
                <span className="metric-label">NLP Model:</span>
                <span className="badge-pill">{result.nlp_source || "lexicon"}</span>
              </div>
            </div>
          </div>

          <div className="panel static metric-card">
            <div className="metric-header">
              <Camera size={20} className="text-accent" aria-hidden="true" />
              <h4>Face Expressions (20%)</h4>
            </div>
            <div className="metric-scores">
              <div>
                <span className="metric-label">Estimated Cue:</span>
                <strong>
                  {result.face_emotion_score !== null ? `${result.face_emotion_score} / 100` : "Camera Opted-Out"}
                </strong>
              </div>
              <div>
                <span className="metric-label">Frame Depth:</span>
                <span>
                  {result.face_sample_count ? `${result.face_sample_count} valid frames` : "Omitted / None"}
                </span>
              </div>
              <div>
                <span className="metric-label">Signal Status:</span>
                <span className="badge-pill">
                  {result.face_emotion_score !== null ? "Experimental Supplementary Cue" : "Omitted from Fusion"}
                </span>
              </div>
              {result.face_emotions_breakdown && (
                <div className="mt-2 pt-2 border-t border-lavender">
                  <span className="muted-xs block mb-1">Observed Categories:</span>
                  <div className="flex-row flex-wrap gap-1">
                    {Object.entries(result.face_emotions_breakdown).map(([k, v]) => (
                      <span key={k} className="badge-pill text-xs">
                        {k}: {Math.round(v * 100)}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Self-Help Recommendations */}
      <section className="mt-4">
        <h2>Evidence-Based Self-Help Suggestions</h2>
        <div className="grid-3">
          {(result.recommendations || []).map((item) => (
            <article className="panel static tip-card" key={item.title}>
              <h3>{item.title}</h3>
              <p className="muted-sm">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Crisis Contacts List (Tele-MANAS & Verified Resources) */}
      <section className="mt-4">
        <h2>Helplines &amp; Immediate Contacts</h2>
        <div className="grid-3">
          {(result.crisis_resources || []).map((resource) => (
            <div className="panel static helpline-item-card" key={resource.name}>
              <div className="helpline-header">
                <PhoneCall size={18} className="text-accent" aria-hidden="true" />
                <h4>{resource.name}</h4>
              </div>
              <p className="helpline-number">
                <a href={`tel:${resource.contact.split(" ")[0]}`}>{resource.contact}</a>
              </p>
              {resource.hours && <p className="helpline-hours">{resource.hours}</p>}
              <p className="muted-xs">{resource.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Mandatory Disclaimer */}
      <div className="panel disclaimer-panel static mt-4">
        <Shield size={20} className="text-accent inline-icon" aria-hidden="true" />
        <strong>Clinical Screening Disclaimer:</strong>
        <p className="muted-sm mt-1">{result.disclaimer}</p>
      </div>

      {/* AI Emotional Insights Companion Link Section */}
      <section className="panel static mt-4">
        <div className="flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="mb-1 flex-row items-center gap-2">
              <Sparkles size={18} className="text-accent" aria-hidden="true" />
              Conversational Emotional Insights &amp; Reflection
            </h3>
            <p className="muted-sm mb-0">
              Chat with Haven AI Companion to evaluate message sentiment and optional camera cues, generating a private Combined Emotional Insights Report.
            </p>
          </div>
          <Link className="btn btn-secondary" to="/chat">
            <Bot size={16} aria-hidden="true" />
            Open AI Companion
          </Link>
        </div>
      </section>

      {/* Actions */}
      <div className="results-actions-bar mt-4">
        <Link className="btn btn-primary" to="/app">
          Return to Student Dashboard
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link className="btn btn-secondary" to="/chat">
          <Bot size={16} aria-hidden="true" />
          Reflect With AI Companion
        </Link>
        <button className="btn btn-secondary" type="button" onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" />
          Print / Save Summary
        </button>
      </div>

    </div>
  );
}
