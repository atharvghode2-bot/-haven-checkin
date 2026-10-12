// Data protection, retention, and optional-sensor limitations.
export function Privacy() {
  return (
    <article className="panel static" style={{ maxWidth: "46rem" }}>
      <h1>Privacy and data protection</h1>
      <p>
        Haven Check-in is an academic screening prototype. It stores account details, questionnaire answers, optional
        text notes, aggregated on-device expression scores (never images), and counselor notes.
      </p>
      <h2>What we do not store</h2>
      <ul>
        <li>Facial images or video</li>
        <li>Raw microphone recordings</li>
        <li>Payment data</li>
      </ul>
      <h2>Retention and deletion</h2>
      <p>
        Local demo deployments keep data until the process restarts (in-memory mode) or until an administrator deletes
        MongoDB collections. There is no automatic production-grade erasure workflow in this academic build. Ask a
        supervisor to wipe the database after a demonstration.
      </p>
      <h2>Access control</h2>
      <p>
        Students can read only their own history. Counselors see anonymous codes and authorized alerts. Changing another
        student’s ID in the URL is rejected.
      </p>
      <h2>Limitations</h2>
      <p>
        Optional Hugging Face text analysis, voice typing, and camera cues fail closed. The questionnaire still works.
        Fusion weights are provisional until clinically reviewed. This is not HIPAA-certified production software.
      </p>
    </article>
  );
}
