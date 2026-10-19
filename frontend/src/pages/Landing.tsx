// Editorial Landing Page: Warm Ivory surface, wine typography, Playfair Display & DM Sans,
// glassmorphism cards, halo glow, and interactive accordion matching the new redesign.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Arrow, Spark } from "../components/Ui";

interface StepItem {
  num: string;
  title: string;
  text: string;
  getUrl: (user: { role: "student" | "counselor" } | null) => string;
}

const steps: StepItem[] = [
  {
    num: "01",
    title: "Pause & check in",
    text: "Begin with a few gentle questions about what’s present for you right now.",
    getUrl: (user) =>
      user ? (user.role === "counselor" ? "/counselor" : "/check-in") : "/login?next=/check-in",
  },
  {
    num: "02",
    title: "Reflect with support",
    text: "Put your experience into words with calm, AI-supported conversation.",
    getUrl: () => "/chat",
  },
  {
    num: "03",
    title: "Notice your patterns",
    text: "See thoughtful summaries that help you understand, never define, how you feel.",
    getUrl: (user) =>
      user ? (user.role === "counselor" ? "/counselor" : "/app") : "/login?next=/app",
  },
];

const faqs = [
  ["Is Haven a replacement for therapy?", "No. Haven is a private reflection and mental wellness screening aid, strictly non-diagnostic and not a medical service."],
  ["How is my privacy protected?", "You stay in complete control of what you share. Haven asks for explicit consent before any optional feature, and camera tracking runs 100% locally on your device."],
  ["What happens during a check-in?", "You’ll answer a few standard self-reflection questions (PHQ-9 and GAD-7) at your own pace, and receive a supportive, non-stigmatizing summary."],
  ["Do I have to enable my camera?", "No, camera tracking is entirely optional and disabled by default. If enabled, facial cues are processed purely in your browser memory and video is never recorded or sent."],
  ["Can I use Haven when I’m in crisis?", "Haven is not an emergency response service. If you are experiencing distress, please reach out to free 24/7 services like Tele-MANAS at 14416 or Emergency Services at 112."],
];

export function Landing() {
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const startCheckInUrl = user
    ? user.role === "counselor"
      ? "/counselor"
      : "/check-in"
    : "/login?next=/check-in";

  return (
    <div className="landing-editorial reveal">
      {/* 1. Hero Section */}
      <section className="hero container" aria-label="Haven Check-in Introduction">
        <div className="hero-copy reveal">
          <p className="eyebrow">
            <i /> Your space to check in
          </p>
          <h1>
            Make space for
            <br />
            <em>how you feel.</em>
          </h1>
          <p className="intro">
            A gentle place to reflect, understand your emotional patterns, and take your next step toward well-being.
          </p>
          <div className="actions">
            <Link className="button primary" to={startCheckInUrl}>
              <span>Start your check-in</span>
              <Arrow />
            </Link>
            <Link className="button secondary" to="/chat">
              <span>Chat with AI Companion</span>
              <Arrow />
            </Link>
            <a className="button glass" href="#how">
              <span>Discover how it works</span>
              <Arrow />
            </a>
          </div>
          <small>Private by design &nbsp;&bull;&nbsp; You’re always in control &nbsp;&bull;&nbsp; Confidential</small>
        </div>

        <div className="hero-wellness-panel reveal">
          <div className="wellness-card glass">
            <div className="wellness-card-top">
              <span className="spark-badge">
                <Spark />
              </span>
              <span className="wellness-badge-tag">Gentle Reflection</span>
            </div>

            <div className="wellness-quote-block">
              <p className="wellness-quote-text">“There’s no right way to feel.”</p>
              <p className="wellness-quote-sub">Just a place to begin.</p>
            </div>

            <div className="wellness-divider" />

            <div className="wellness-pillars">
              <div className="wellness-pillar">
                <i className="pillar-bullet" />
                <div>
                  <strong>Confidential &amp; Anonymous</strong>
                  <p>Screening responses linked only to student code STU-XXXX.</p>
                </div>
              </div>
              <div className="wellness-pillar">
                <i className="pillar-bullet" />
                <div>
                  <strong>On-Device Privacy</strong>
                  <p>Optional facial cues run 100% locally in your browser memory.</p>
                </div>
              </div>
              <div className="wellness-pillar">
                <i className="pillar-bullet" />
                <div>
                  <strong>At Your Own Pace</strong>
                  <p>Self-paced reflection with verified campus resources.</p>
                </div>
              </div>
            </div>

            <div className="wellness-card-status">
              <span className="status-dot-active" />
              <span>Safe academic space &bull; Free &amp; confidential</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. How it works */}
      <section className="how" id="how">
        <div className="container">
          <div className="title">
            <p className="eyebrow">
              <i /> A gentler process
            </p>
            <h2>
              A moment for you,
              <br />
              <em>in three simple steps.</em>
            </h2>
            <p>Haven meets you where you are—with curiosity, care, and no judgment.</p>
          </div>

          <div className="steps">
            {steps.map((step) => {
              const destination = step.getUrl(user);
              return (
                <Link
                  key={step.num}
                  to={destination}
                  className="step-card"
                  aria-label={`Step ${step.num}: ${step.title}. ${step.text}`}
                >
                  <div className="step-num">
                    <span>{step.num}</span>
                    <i aria-hidden="true" />
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                  <div className="step-arrow" aria-hidden="true">
                    <Arrow />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. AI-Supported Reflection / Chat Section */}
      <section className="reflection container" id="check-in">
        <div className="chat-wrap">
          <div className="halo" />
          <div className="chat glass">
            <div className="chat-head">
              <span>
                <Spark />
              </span>
              <div>
                <strong>Haven Companion</strong>
                <small>Local AI Reflection Companion</small>
              </div>
              <div className="chat-head-status">
                <i />
                <small>Here with you</small>
              </div>
            </div>

            <div className="messages">
              <p>Take your time. What’s been taking up the most space in your mind lately?</p>
              <p className="user">I’ve been feeling stretched thin, even when I’m getting things done.</p>
              <p>It sounds like you’ve been carrying a lot. Would it help to explore what feels heaviest?</p>
            </div>

            <div className="composer">
              <span>Share what’s on your mind…</span>
              <button type="button" disabled aria-label="Send message preview">
                <Arrow />
              </button>
            </div>
            <small className="preview">Live AI companion powered by local Qwen 2.5 — ready whenever you are.</small>

            <Link
              to="/chat"
              className="button primary"
              style={{ width: "100%", marginTop: "14px", minHeight: "44px" }}
            >
              <span>Begin a Real Conversation</span>
              <Arrow />
            </Link>
          </div>
        </div>

        <div className="reflection-copy">
          <p className="eyebrow lavender">
            <i /> AI-supported reflection
          </p>
          <h2>
            Talk it through,
            <br />
            <em>at your own pace.</em>
          </h2>
          <p>
            Sometimes the first step is finding the words. Haven offers thoughtful prompts and helps you notice what matters—without judgment.
          </p>

          <ul>
            <li>
              <span>
                <Spark />
              </span>
              <div>
                <strong>Thoughtful, not clinical</strong>
                <small>Supportive, empathetic dialogue designed for reflection, never diagnosis.</small>
              </div>
            </li>
            <li>
              <span>
                <Spark />
              </span>
              <div>
                <strong>You lead the conversation</strong>
                <small>Pause, skip, explore grounding exercises, or stop whenever you need.</small>
              </div>
            </li>
            <li>
              <span>
                <Spark />
              </span>
              <div>
                <strong>100% On-Device AI</strong>
                <small>Runs privately on your machine using Ollama with zero commercial cloud logging.</small>
              </div>
            </li>
          </ul>

          <Link to="/chat" className="button glass">
            <span>Open AI Companion</span>
            <Arrow />
          </Link>
        </div>
      </section>

      {/* 4. Privacy & Consent */}
      <section className="privacy" id="privacy">
        <div className="container privacy-grid">
          <div>
            <p className="eyebrow light">
              <i /> Privacy &amp; consent
            </p>
            <h2>
              Your inner world
              <br />
              <em>belongs to you.</em>
            </h2>
          </div>

          <div className="privacy-copy">
            <p>
              Trust begins with clarity. Haven is designed to give you meaningful control over your experience and your information.
            </p>
            <dl>
              <div>
                <dt>Clear consent</dt>
                <dd>Nothing optional happens without your explicit say.</dd>
              </div>
              <div>
                <dt>Camera off by default</dt>
                <dd>
                  <i className="camera-dot" /> Off &mdash; enable only if you choose for on-device cues.
                </dd>
              </div>
              <div>
                <dt>On-device processing</dt>
                <dd>Facial cues run 100% locally via WebAssembly. No video or photos are saved or uploaded.</dd>
              </div>
              <div>
                <dt>Non-diagnostic</dt>
                <dd>Insights support self-reflection and campus resource discovery, not medical conclusions.</dd>
              </div>
            </dl>
            <Link to="/privacy">
              <span>Read our privacy approach</span>
              <Arrow />
            </Link>
          </div>
        </div>
      </section>

      {/* 5. Resources */}
      <section className="resources container" id="resources">
        <div className="title">
          <p className="eyebrow">
            <i /> Small ways forward
          </p>
          <h2>
            Support for the moment
            <br />
            <em>you’re in.</em>
          </h2>
        </div>

        <div className="resource-grid">
          <article className="featured">
            <span className="featured-tag">Guided practice &bull; 3 min</span>
            <div className="featured-body">
              <h3>A soft reset for an overwhelmed mind</h3>
              <p>Come back to the present with a quiet grounding exercise you can do anywhere, anytime.</p>
            </div>
            <Link to="/chat" className="featured-action">
              <span>Try the practice</span>
              <Arrow />
            </Link>
          </article>
          <article>
            <span>01</span>
            <div>
              <small>Reflection</small>
              <h3>When your thoughts feel too loud</h3>
              <Link to="/chat">
                <span>Explore prompts</span>
                <Arrow />
              </Link>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <small>Understanding</small>
              <h3>Naming what you need today</h3>
              <Link to={startCheckInUrl}>
                <span>Check in</span>
                <Arrow />
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* 6. FAQ Section */}
      <section className="faq" id="faq">
        <div className="container faq-grid">
          <div>
            <p className="eyebrow">
              <i /> Questions, answered
            </p>
            <h2>
              A little more
              <br />
              <em>clarity.</em>
            </h2>
            <p>Can’t find what you need? We’re here to help you feel supported and informed.</p>
          </div>

          <div className="faq-list">
            {faqs.map(([q, a], i) => (
              <div className={`faq-item ${openFaq === i ? "active" : ""}`} key={q}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  <span>{q}</span>
                  <i>{openFaq === i ? "−" : "+"}</i>
                </button>
                <div>
                  <p>{a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Closing Section */}
      <section className="closing">
        <p className="eyebrow light">
          <i /> Begin when you’re ready
        </p>
        <h2>
          You don’t have to have
          <br />
          <em>it all figured out.</em>
        </h2>
        <p>Take a quiet moment to check in with yourself.</p>
        <Link className="button glass" to={startCheckInUrl} style={{ marginTop: "24px" }}>
          <span>Start your check-in</span>
          <Arrow />
        </Link>
      </section>
    </div>
  );
}
