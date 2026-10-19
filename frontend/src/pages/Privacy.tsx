// Privacy, consent architecture, data flows, and camera off-by-default assurances.
import { Link } from "react-router-dom";
import { Arrow, Spark } from "../components/Ui";

export function Privacy() {
  return (
    <div className="privacy-page reveal">
      <article>
        <p className="eyebrow">
          <i /> Trust, Consent &amp; Safety
        </p>
        <h1>Privacy &amp; Data Protection</h1>
        <p>
          Haven Check-in is designed around a fundamental premise: <strong>your inner world belongs to you</strong>.
          We believe mental wellness tools must earn trust through radical transparency, strict data minimization,
          and zero-cloud biometric tracking.
        </p>

        <h2 id="camera">1. Camera Off by Default &bull; 100% On-Device WebAssembly</h2>
        <p>
          Camera access is entirely optional and disabled by default. If you choose to enable camera cues during your
          check-in or while speaking with Haven Companion:
        </p>
        <ul>
          <li>
            <strong>Zero Video Transmission:</strong> Video streams and frames are evaluated strictly in your browser’s volatile
            RAM using Google MediaPipe FaceLandmarker compiled to WebAssembly.
          </li>
          <li>
            <strong>Zero Photos Stored:</strong> No images, screenshots, or recordings are ever saved to disk, uploaded to the
            cloud, or transmitted across the network.
          </li>
          <li>
            <strong>Only Derived High-Level Cues:</strong> Only transient mathematical blendshape averages (e.g., probability of a smile or brow furrow)
            are optionally used to inform dialogue empathy.
          </li>
        </ul>

        <h2 id="consent">2. Data Flow Summary</h2>
        <table className="privacy-table">
          <thead>
            <tr>
              <th>Data Category</th>
              <th>Processing Location</th>
              <th>Storage &amp; Retention</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Facial Video &amp; Images</strong></td>
              <td>Browser RAM only (WebAssembly)</td>
              <td>Never saved or transmitted (0ms retention)</td>
            </tr>
            <tr>
              <td><strong>Microphone / Speech</strong></td>
              <td>Local Web Speech API</td>
              <td>Transcribed locally to text; no audio saved</td>
            </tr>
            <tr>
              <td><strong>AI Chat Conversations</strong></td>
              <td>Local Ollama runtime on your machine</td>
              <td>Stored in local memory session; never sent to third-party commercial APIs</td>
            </tr>
            <tr>
              <td><strong>Questionnaire Scores (PHQ-9/GAD-7)</strong></td>
              <td>Local backend server</td>
              <td>Indexed under your private student alias for longitudinal trends</td>
            </tr>
            <tr>
              <td><strong>Counselor Alerts</strong></td>
              <td>Local campus database</td>
              <td>Displays only anonymous code (e.g. STU-4C91) when elevated load is detected</td>
            </tr>
          </tbody>
        </table>

        <h2>3. Academic &amp; Non-Diagnostic Scope</h2>
        <p>
          Haven Check-in is strictly an educational wellness screening aid and academic prototype. It does not establish
          a medical diagnosis and cannot replace a licensed psychologist, psychiatrist, or emergency service.
        </p>

        <h2>4. Free 24/7 Verified Crisis Resources</h2>
        <p>
          You do not need to complete a screening or reflection to seek help. Free, confidential support is available 24/7:
        </p>
        <ul>
          <li><strong>Tele-MANAS (Govt. of India):</strong> <a href="tel:14416" style={{ color: "var(--wine)", fontWeight: 600 }}>14416</a> or 1800-891-4416 (Toll-Free, 24/7, Multi-lingual)</li>
          <li><strong>National Emergency Number:</strong> <a href="tel:112" style={{ color: "var(--wine)", fontWeight: 600 }}>112</a> (Ambulance, Life-Safety)</li>
          <li><strong>KIRAN Mental Health Helpline:</strong> <a href="tel:18005990019" style={{ color: "var(--wine)", fontWeight: 600 }}>1800-599-0019</a> (Psychological first aid)</li>
        </ul>

        <div style={{ marginTop: "32px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link to="/" className="button secondary">
            <span>Back to Home</span>
            <Arrow />
          </Link>
          <Link to="/chat" className="button primary">
            <span>Open AI Companion</span>
            <Arrow />
          </Link>
        </div>
      </article>
    </div>
  );
}
