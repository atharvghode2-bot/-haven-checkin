// Editorial Landing page: warm ivory surface, terracotta serif headlines, lifestyle visual, and clear multimodal methodology.
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  FileText,
  Lock,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export function Landing() {
  const { user } = useAuth();
  const startTo = user ? (user.role === "counselor" ? "/counselor" : "/check-in") : "/login?next=/check-in";

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "Is this a clinical diagnosis?",
      a: "No. Haven Check-in is strictly an educational wellness screening aid and academic prototype. It calculates provisional load indicators to help students and campus counselors spot distress early, but it does not replace a licensed clinical psychologist or psychiatrist.",
    },
    {
      q: "Does anyone see my face or video recording?",
      a: "Never. Camera analysis runs 100% locally on your own machine using WebAssembly. Only high-level mathematical probabilities (e.g., calm, smiling) are calculated in your browser memory. No photographs, video files, or raw frames are ever saved, uploaded, or transmitted.",
    },
    {
      q: "Can I take the check-in without using the camera or microphone?",
      a: "Yes, completely. Voice input and camera analysis are entirely optional. The entire screening works smoothly using just your keyboard or mouse.",
    },
    {
      q: "What does my campus counselor see?",
      a: "Counselors only see an anonymous student code (such as STU-4C91) and screening score trends when an elevated threshold or safety alert is reached. Your personal contact information is protected.",
    },
  ];

  return (
    <div className="landing-page reveal">
      {/* Editorial Hero Section */}
      <section className="hero editorial-hero">
        <div className="hero-text-block">
          <p className="eyebrow terracotta-eyebrow">
            <Sparkles size={13} className="inline-icon" aria-hidden="true" />
            YOUR SPACE TO CHECK IN
          </p>
          <h1 className="hero-headline">Make Space for How You Feel.</h1>
          <p className="hero-lede">
            Haven Check-in provides college students with a quiet, confidential screening experience.
            Private reflections, standard validated assessments, and supportive guidance at your own pace.
          </p>

          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" to={startTo}>
              Start Your Check-in
            </Link>
            <a className="btn btn-secondary" href="#how-it-works">
              How it works <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>

          <div className="hero-guarantee">
            <ShieldCheck size={16} className="text-terracotta" aria-hidden="true" />
            <span>Confidential &bull; On-device privacy &bull; Academic wellness prototype</span>
          </div>
        </div>

        {/* Hero Right Column: Warm Editorial Lifestyle Image */}
        <div className="hero-visual-block">
          <div className="editorial-image-frame">
            <img
              src="/images/wellness-hero.jpg"
              alt="Peaceful morning wellness setting with a warm cup of tea, open journal, and dried flowers in soft sunlight"
              className="editorial-image"
              loading="eager"
            />
            <div className="editorial-caption">
              <span>A quiet moment of reflection</span>
              <span className="caption-dot">&bull;</span>
              <span>Private, unhurried, and confidential</span>
            </div>
          </div>
        </div>
      </section>

      <hr className="editorial-divider" />

      {/* 3-Step Rhythm Section */}
      <section id="how-it-works" className="section-block">
        <div className="section-heading-centered">
          <p className="eyebrow terracotta-eyebrow">HOW IT WORKS</p>
          <h2>A Thoughtful, Three-Step Rhythm</h2>
          <p className="section-desc">
            Designed to fit naturally into a student's busy schedule, taking only three to four unhurried minutes.
          </p>
        </div>

        <div className="grid-3 editorial-steps-grid">
          <div className="editorial-step-card">
            <span className="step-numeral">01</span>
            <h3>A Quiet Space</h3>
            <p>
              Answer standard 9-item PHQ-9 (Depression) and 7-item GAD-7 (Anxiety) self-report inventories one gentle question at a time.
            </p>
          </div>

          <div className="editorial-step-card">
            <span className="step-numeral">02</span>
            <h3>Optional Multimodal Cues</h3>
            <p>
              Express your feelings via text or speech, and optionally enable on-device facial cues. Analysis is 100% local—no video ever leaves your computer.
            </p>
          </div>

          <div className="editorial-step-card">
            <span className="step-numeral">03</span>
            <h3>Private Insights &amp; Care</h3>
            <p>
              Receive an immediate plain-language summary of your wellness load, track trends across semesters, and connect with campus counselors when extra support is helpful.
            </p>
          </div>
        </div>
      </section>

      <hr className="editorial-divider" />

      {/* Multimodal Architecture Section */}
      <section id="signals" className="section-block">
        <div className="section-heading-centered">
          <p className="eyebrow terracotta-eyebrow">BALANCED SCREENING SIGNALS</p>
          <h2>Combining Evidence with Context</h2>
          <p className="section-desc">
            Rather than relying solely on a single quiz or an unexplainable AI model, Haven calculates an integrated wellness index using clinical benchmarks and transparent weights.
          </p>
        </div>

        <div className="grid-3">
          <article className="panel editorial-feature-card static">
            <div className="feature-card-header">
              <div className="icon-wrapper terracotta-icon">
                <FileText size={22} aria-hidden="true" />
              </div>
              <span className="weight-pill">50% Primary Weight</span>
            </div>
            <h3>Validated Self-Report</h3>
            <p className="muted">
              Built upon the clinically validated PHQ-9 and GAD-7 standards. Deterministically scored, never hallucinated or altered by an LLM.
            </p>
          </article>

          <article className="panel editorial-feature-card static">
            <div className="feature-card-header">
              <div className="icon-wrapper terracotta-icon">
                <MessageSquare size={22} aria-hidden="true" />
              </div>
              <span className="weight-pill">30% Contextual Weight</span>
            </div>
            <h3>Conversational Reflections</h3>
            <p className="muted">
              Optional open reflections scored via Hugging Face sentiment analysis and contextual lexicons, providing nuanced emotional context.
            </p>
          </article>

          <article className="panel editorial-feature-card static">
            <div className="feature-card-header">
              <div className="icon-wrapper terracotta-icon">
                <Camera size={22} aria-hidden="true" />
              </div>
              <span className="weight-pill">20% Advisory Weight</span>
            </div>
            <h3>On-Device Facial Cues</h3>
            <p className="muted">
              Optional local expression estimation running MediaPipe WebAssembly. Supplementary signal only—cannot independently flag elevated risk.
            </p>
          </article>
        </div>
      </section>

      <hr className="editorial-divider" />

      {/* Privacy Guarantee Section */}
      <section className="section-block privacy-feature-section">
        <div className="editorial-split-layout">
          <div className="split-text">
            <p className="eyebrow terracotta-eyebrow">CONFIDENTIALITY &amp; ETHICS</p>
            <h2>Privacy Protected at Every Layer</h2>
            <p className="lede-sm">
              We know that mental health check-ins require absolute trust. Haven is designed with zero-knowledge architectural principles:
            </p>

            <ul className="safety-points-editorial">
              <li>
                <CheckCircle2 size={18} className="text-terracotta flex-shrink-0" aria-hidden="true" />
                <div>
                  <strong>Zero Camera Transmission:</strong> Video analysis operates exclusively in browser WebAssembly memory. Zero frames are uploaded.
                </div>
              </li>
              <li>
                <CheckCircle2 size={18} className="text-terracotta flex-shrink-0" aria-hidden="true" />
                <div>
                  <strong>Anonymous Student Aliases:</strong> When counselor triage is necessary, alerts display pseudo-identifiers (e.g. <code>STU-4C91</code>), safeguarding your academic identity.
                </div>
              </li>
              <li>
                <CheckCircle2 size={18} className="text-terracotta flex-shrink-0" aria-hidden="true" />
                <div>
                  <strong>Complete Sensor Control:</strong> Camera and microphone are strictly opt-in. You can disable them at any second with immediate hardware track release.
                </div>
              </li>
            </ul>

            <div className="mt-3">
              <Link to="/privacy" className="btn btn-secondary">
                Read Full Data Governance Policy
              </Link>
            </div>
          </div>

          <div className="split-aside">
            <div className="panel blush-callout-card static">
              <div className="flex-row items-center gap-2 mb-2">
                <Lock size={18} className="text-terracotta" aria-hidden="true" />
                <h3 className="text-terracotta">Our Data Promise</h3>
              </div>
              <p className="muted-sm">
                No advertising trackers, no selling of student data, and no automated diagnostic labels. Haven is built to support students, not profile them.
              </p>
              <div className="divider-subtle my-3" />
              <div className="small-security-stat">
                <strong>PBKDF2-SHA256</strong> password hashing &bull; <strong>JWT</strong> session tokens
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr className="editorial-divider" />

      {/* Wellness & 24/7 Crisis Support Section */}
      <section id="resources" className="section-block">
        <div className="section-heading-centered">
          <p className="eyebrow terracotta-eyebrow">CAMPUS &amp; NATIONAL SUPPORT</p>
          <h2>Help Is Always Within Reach</h2>
          <p className="section-desc">
            You do not need to complete a check-in to access care. If you or someone you know is struggling, compassionate humans are available 24 hours a day.
          </p>
        </div>

        <div className="grid-3">
          <div className="panel editorial-resource-card featured static">
            <span className="resource-tag terracotta-tag">National 24/7 Helpline</span>
            <h3>Tele-MANAS</h3>
            <p className="resource-contact">14416</p>
            <p className="resource-alt-contact">Toll-Free: 1800-891-4416</p>
            <p className="resource-detail">
              Government of India comprehensive mental health counseling service. Free, confidential, and available in over 20 languages.
            </p>
          </div>

          <div className="panel editorial-resource-card static">
            <span className="resource-tag">Rehabilitation &amp; Hope</span>
            <h3>KIRAN Helpline</h3>
            <p className="resource-contact">1800-599-0019</p>
            <p className="resource-alt-contact">Dept. of Empowerment of Persons with Disabilities</p>
            <p className="resource-detail">
              Trained mental health professionals offering psychological first aid, panic de-escalation, and referral support.
            </p>
          </div>

          <div className="panel editorial-resource-card static">
            <span className="resource-tag">Immediate Emergency</span>
            <h3>National Emergency</h3>
            <p className="resource-contact">112</p>
            <p className="resource-alt-contact">Single Emergency Dispatch</p>
            <p className="resource-detail">
              Direct connection to medical emergency teams, police, and safety first-responders anywhere in India.
            </p>
          </div>
        </div>
      </section>

      <hr className="editorial-divider" />

      {/* Frequently Asked Questions */}
      <section className="section-block">
        <div className="section-heading-centered">
          <p className="eyebrow terracotta-eyebrow">COMMON QUESTIONS</p>
          <h2>Everything You Need to Know</h2>
        </div>

        <div className="faq-editorial-list">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={faq.q} className="faq-editorial-item">
                <button
                  type="button"
                  className="faq-question-btn"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  aria-expanded={isOpen}
                >
                  <span className="faq-question-text">{faq.q}</span>
                  <ChevronDown
                    size={18}
                    className={`faq-icon ${isOpen ? "rotated" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                {isOpen && (
                  <div className="faq-answer-content">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Final Warm Editorial Invitation Banner */}
      <section className="cta-invitation-section">
        <div className="cta-invitation-box">
          <p className="eyebrow terracotta-eyebrow">A MOMENT FOR YOURSELF</p>
          <h2 className="cta-invitation-heading">Make a habit of gentle reflection.</h2>
          <p className="cta-invitation-desc">
            Your responses remain private, your pace is entirely your own, and help is always within reach.
          </p>
          <div className="row justify-center mt-3 gap-2">
            <Link className="btn btn-primary btn-lg" to={startTo}>
              Begin Your Check-in
            </Link>
            <Link className="btn btn-secondary" to="/login">
              Explore Demo Accounts
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
