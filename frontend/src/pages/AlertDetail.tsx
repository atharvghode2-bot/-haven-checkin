// Alert detail, status management, crisis triage, and authorized counselor notes.
import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  Lock,
  MessageSquare,
  Save,
  ShieldAlert,
  User as UserIcon,
} from "lucide-react";
import { api, type AlertRow } from "../api/client";
import { Button, Loading, Status } from "../components/Ui";

export function AlertDetail() {
  const { alertId } = useParams();
  const [alert, setAlert] = useState<AlertRow | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState("");

  async function loadAlert() {
    try {
      const data = await api<{ alert: AlertRow }>(`/alerts/${alertId}`);
      setAlert(data.alert);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Alert record could not be found.");
    }
  }

  useEffect(() => {
    void loadAlert();
  }, [alertId]);

  async function saveStatus(status: string) {
    setPending(true);
    setConfirm("");
    try {
      const data = await api<{ alert: AlertRow }>(`/alerts/${alertId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setAlert(data.alert);
      setConfirm("Alert status successfully updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update alert status.");
    } finally {
      setPending(false);
    }
  }

  async function addNote(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    setPending(true);
    setConfirm("");
    try {
      const data = await api<{ alert: AlertRow }>(`/alerts/${alertId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: note }),
      });
      setAlert(data.alert);
      setNote("");
      setConfirm("Counselor note saved to protected student file.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save counselor note.");
    } finally {
      setPending(false);
    }
  }

  if (error && !alert) {
    return (
      <div className="panel error-panel reveal">
        <h1>Alert Unavailable</h1>
        <p className="error">{error}</p>
        <Link className="btn btn-primary mt-3" to="/counselor">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Alerts List
        </Link>
      </div>
    );
  }

  if (!alert) return <Loading label="Loading alert record" />;

  return (
    <div className="alert-detail-page reveal">
      {/* Back button and Header */}
      <div className="detail-header-bar">
        <Link className="btn btn-ghost btn-sm" to="/counselor">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Alerts List
        </Link>
        <div className="flex-row items-center gap-2 mt-2">
          <span className="anon-badge">
            <UserIcon size={16} aria-hidden="true" />
            {alert.anonymous_code || "STU-ANON"}
          </span>
          <Status value={alert.band} />
          <Status value={alert.status} />
        </div>
      </div>

      {alert.crisis && (
        <section className="banner crisis my-4" role="alert">
          <div className="flex-row items-center gap-2">
            <ShieldAlert size={22} className="text-red-400" aria-hidden="true" />
            <div>
              <strong>Urgent Crisis Item or Phrase Flagged</strong>
              <p className="muted-xs">
                This student checked an explicit self-harm item on PHQ-9 or used high-risk keywords. Triage this case promptly.
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="grid-2 mt-4">
        {/* Left Column: Session Summary and Status Management */}
        <section className="panel static detail-summary-panel">
          <div className="panel-header-row">
            <h2>Session Screening Metrics</h2>
          </div>

          <div className="scores-table-mini my-3">
            <div className="score-row">
              <span>PHQ-9 Depression Score:</span>
              <strong>{alert.phq9} / 27</strong>
            </div>
            <div className="score-row">
              <span>GAD-7 Anxiety Score:</span>
              <strong>{alert.gad7} / 21</strong>
            </div>
            <div className="score-row">
              <span>Combined Multimodal Load:</span>
              <strong>{Math.round(alert.final_risk)} / 100</strong>
            </div>
            <div className="score-row">
              <span>Recorded Timestamp:</span>
              <span>{new Date(alert.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
            </div>
            {alert.updated_at && (
              <div className="score-row">
                <span>Last Updated:</span>
                <span>{new Date(alert.updated_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>
            )}
          </div>

          {/* Status Changer */}
          <div className="status-changer-card panel mt-3">
            <label htmlFor="alert-status-select" className="field-label">
              Update Case Status:
            </label>
            <div className="flex-row gap-2 items-center">
              <select
                id="alert-status-select"
                className="select"
                value={alert.status}
                disabled={pending}
                onChange={(e) => void saveStatus(e.target.value)}
              >
                <option value="open">Open (Unacknowledged)</option>
                <option value="acknowledged">Acknowledged (Review in progress)</option>
                <option value="in_review">In Review (Active Case)</option>
                <option value="resolved">Resolved (Case Closed)</option>
              </select>
            </div>
            <p className="help-text mt-1">Status changes are recorded in the institutional audit log.</p>
          </div>

          <div className="privacy-card-compact mt-3">
            <Lock size={16} className="text-accent" aria-hidden="true" />
            <p className="muted-xs">
              Student anonymity is protected. Identifying records are held in a partitioned collection accessible only via authorized campus health protocol.
            </p>
          </div>
        </section>

        {/* Right Column: Protected Counselor Notes */}
        <section className="panel detail-notes-panel">
          <div className="panel-header-row">
            <h2>
              <MessageSquare size={18} className="text-accent inline-icon" aria-hidden="true" />
              Confidential Case Notes
            </h2>
            <span className="muted-xs">Counselor Access Only</span>
          </div>

          <div className="notes-stream my-3">
            {(alert.notes || []).length === 0 ? (
              <p className="empty">No counselor notes recorded yet for this alert.</p>
            ) : (
              <ul className="notes-list">
                {(alert.notes || []).map((item) => (
                  <li key={item.id} className="note-item">
                    <div className="note-header">
                      <strong>{item.author_name}</strong>
                      <span className="note-date">
                        {new Date(item.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    <p className="note-body">{item.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Add Note Form */}
          <form className="add-note-form" onSubmit={addNote}>
            <label htmlFor="new-note-body" className="field-label">
              Add Clinical or Follow-up Note:
            </label>
            <textarea
              id="new-note-body"
              className="textarea"
              rows={4}
              placeholder="Record follow-up actions, outreach attempts, or clinical impressions..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="action-button-row mt-2">
              <Button type="submit" variant="primary" disabled={pending || !note.trim()}>
                <Save size={16} aria-hidden="true" />
                {pending ? "Saving..." : "Save Note"}
              </Button>
            </div>
          </form>

          {confirm && (
            <div className="confirmation-toast mt-2" role="status">
              <CheckCircle size={16} className="text-accent" aria-hidden="true" />
              <span>{confirm}</span>
            </div>
          )}
          {error && <p className="error mt-2">{error}</p>}
        </section>
      </div>
    </div>
  );
}
