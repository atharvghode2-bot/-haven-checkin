// Student dashboard with refined editorial typography, previous check-ins, mood trends, and campus resources.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  ChevronRight,
  ExternalLink,
  History,
  LineChart as ChartIcon,
  PhoneCall,
  PlusCircle,
  Shield,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  User as UserIcon,
} from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type SessionSummary, type TrendPoint } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Loading, Status } from "../components/Ui";

const RESOURCES = [
  {
    title: "Campus Wellness Center",
    body: "Schedule a confidential consultation with a campus counseling professional through your student health portal.",
    linkText: "Health Portal",
    href: "https://haven.edu/wellness",
  },
  {
    title: "Sleep & Academic Rhythms",
    body: "Protect a regular 7–8 hour rest window during assignment deadlines; cognitive fatigue often manifests as elevated anxiety.",
    linkText: "Sleep Hygiene Guide",
    href: "#",
  },
  {
    title: "Box Breathing & Grounding",
    body: "A structured 4-4-4-4 autonomic reset practice to soothe heightened nervous system responses before exams.",
    linkText: "Grounding Practices",
    href: "#",
  },
];

export function StudentHome() {
  const { user } = useAuth();
  const [points, setPoints] = useState<TrendPoint[] | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;

    // Fetch trend points
    api<{ points: TrendPoint[] }>(`/students/${user.id}/trends`)
      .then((data) => setPoints(data.points))
      .catch((err) => setError(err.message));

    // Fetch full session history
    api<{ sessions: SessionSummary[] }>("/students/me/sessions")
      .then((data) => setSessions(data.sessions))
      .catch(() => undefined);
  }, [user?.id]);

  const latest = points?.[points.length - 1];
  const chartData = (points || []).map((row) => ({
    date: new Date(row.completed_at).toLocaleDateString([], { month: "short", day: "numeric" }),
    mood: Math.round(100 - row.final_risk),
    anxiety: row.gad7,
  }));

  const completedCount = sessions ? sessions.filter((s) => s.status === "completed").length : points?.length || 0;

  return (
    <div className="student-home reveal">
      {/* Student Welcome Header */}
      <section className="dashboard-welcome-banner">
        <div>
          <div className="flex-row items-center gap-2 mb-2">
            <span className="anon-badge">
              <UserIcon size={13} aria-hidden="true" />
              Alias: <strong>{user?.anonymous_code || "STU-DEMO"}</strong>
            </span>
            <span className="privacy-pill">
              <Shield size={12} aria-hidden="true" /> Confidential Student Record
            </span>
          </div>
          <h1 className="welcome-heading">Welcome back{user?.name ? `, ${user.name}` : ""}.</h1>
          <p className="welcome-lede">
            Here is your private wellness overview. Take an unhurried check-in whenever you want to track how you are feeling.
          </p>
        </div>

        <div className="welcome-actions">
          <Link className="btn btn-primary btn-lg" to="/check-in">
            <PlusCircle size={17} aria-hidden="true" />
            Take Your Check-in
          </Link>
          <Link className="btn btn-secondary" to="/privacy">
            Privacy Policy
          </Link>
        </div>
      </section>

      {error && <p className="error mt-3">{error}</p>}
      {!points && <Loading label="Loading your check-in records" />}

      {/* Overview Stat Cards */}
      <div className="grid-3 mt-4">
        <div className="panel static metric-kpi-card">
          <p className="kicker">Total Completed Check-ins</p>
          <p className="stat text-terracotta">{completedCount}</p>
          <p className="muted-xs">Confidential self-report sessions</p>
        </div>

        <div className="panel static metric-kpi-card">
          <p className="kicker">Current Screening Load</p>
          {latest ? (
            <div className="mt-1">
              <Status value={latest.band} />
              <p className="muted-xs mt-1">From your most recent check-in</p>
            </div>
          ) : (
            <p className="stat muted-sm">None yet</p>
          )}
        </div>

        <div className="panel static metric-kpi-card">
          <p className="kicker">Last Check-in Date</p>
          <p className="stat-date text-terracotta">
            {latest
              ? new Date(latest.completed_at).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "No check-ins yet"}
          </p>
          <p className="muted-xs">Frequency: As needed</p>
        </div>
      </div>

      {/* Main Grid: Latest Summary & Longitudinal Trend Chart */}
      <div className="grid-2 mt-4">
        {/* Latest Summary Card */}
        <section className="panel static dashboard-panel">
          <div className="panel-header-row">
            <h2>
              <Sparkles size={18} className="text-terracotta inline-icon" aria-hidden="true" />
              Latest Session Summary
            </h2>
            {latest && (
              <Link className="btn btn-secondary btn-xs" to={`/results/${latest.session_id}`}>
                View Details <ChevronRight size={14} aria-hidden="true" />
              </Link>
            )}
          </div>

          {!latest ? (
            <div className="empty-state-block">
              <History size={32} className="muted mb-2" aria-hidden="true" />
              <p className="muted">You have not completed any check-ins yet.</p>
              <Link className="btn btn-primary mt-2" to="/check-in">
                Start Your First Check-in
              </Link>
            </div>
          ) : (
            <div className="latest-summary-details">
              <div className="summary-date-line">
                <Calendar size={15} className="text-terracotta" aria-hidden="true" />
                <span>
                  {new Date(latest.completed_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>

              <div className="summary-chips-row my-2">
                <Status value={latest.band} />
                {latest.crisis && (
                  <span className="status elevated">
                    <ShieldAlert size={12} aria-hidden="true" /> Safety Alert Flagged
                  </span>
                )}
              </div>

              <div className="scores-table-mini">
                <div className="score-row">
                  <span>PHQ-9 Depression Index:</span>
                  <strong>{latest.phq9} / 27</strong>
                </div>
                <div className="score-row">
                  <span>GAD-7 Anxiety Index:</span>
                  <strong>{latest.gad7} / 21</strong>
                </div>
                <div className="score-row">
                  <span>Combined Screening Load:</span>
                  <strong>{Math.round(latest.final_risk)} / 100</strong>
                </div>
              </div>

              <p className="muted-xs mt-3">
                Provisional screening indicator based on recent self-reports. Does not represent a clinical diagnosis.
              </p>
            </div>
          )}
        </section>

        {/* Mood and Stress Trend Chart */}
        <section className="panel static dashboard-panel">
          <div className="panel-header-row">
            <h2>
              <TrendingUp size={18} className="text-terracotta inline-icon" aria-hidden="true" />
              Longitudinal Wellness Trend
            </h2>
          </div>

          {chartData.length < 2 ? (
            <div className="empty-state-block">
              <ChartIcon size={32} className="muted mb-2" aria-hidden="true" />
              <p className="muted">Longitudinal trend tracking requires at least two completed check-ins.</p>
              <p className="muted-xs">Check in over time to see trends appear here automatically.</p>
            </div>
          ) : (
            <div>
              <div style={{ height: 230 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="date" stroke="#8E8A99" fontSize={12} tickLine={false} />
                    <YAxis stroke="#8E8A99" domain={[0, 100]} fontSize={12} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "#FCF9F6",
                        borderColor: "#E7D6CD",
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(41,37,54,0.08)",
                        color: "#292536",
                        fontSize: "0.88rem",
                      }}
                      labelStyle={{ color: "#8A2D16", fontWeight: 600 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="mood"
                      stroke="#8A2D16"
                      strokeWidth={2.5}
                      name="Wellness Balance (0–100)"
                      dot={{ r: 4, fill: "#8A2D16" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="anxiety"
                      stroke="#8A7BB0"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      name="GAD-7 Anxiety Index"
                      dot={{ r: 3, fill: "#8A7BB0" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="help-text mt-2">
                Solid terracotta line: Wellness Balance (higher is better). Dashed lavender line: GAD-7 Anxiety.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Past Check-in Sessions History List */}
      <section className="panel static mt-4">
        <div className="panel-header-row">
          <h2>
            <History size={18} className="text-terracotta inline-icon" aria-hidden="true" />
            Check-in History
          </h2>
          <span className="muted-xs">Stored securely in your private profile</span>
        </div>

        {!sessions || sessions.length === 0 ? (
          <p className="muted py-3">No check-in history found.</p>
        ) : (
          <div className="table-wrap">
            <table className="editorial-table" aria-label="Past check-in records">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Status</th>
                  <th>PHQ-9</th>
                  <th>GAD-7</th>
                  <th>Combined Load</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((ses) => {
                  const res = ses.result;
                  const dateStr = ses.completed_at
                    ? new Date(ses.completed_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
                    : new Date(ses.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

                  return (
                    <tr key={ses.id}>
                      <td>
                        <strong>{dateStr}</strong>
                      </td>
                      <td>
                        <Status value={ses.status === "completed" && res ? res.band : ses.status} />
                      </td>
                      <td>{res ? `${res.phq9} / 27` : "—"}</td>
                      <td>{res ? `${res.gad7} / 21` : "—"}</td>
                      <td>{res ? `${Math.round(res.final_risk)} / 100` : "—"}</td>
                      <td>
                        {ses.status === "completed" ? (
                          <Link to={`/results/${ses.id}`} className="linkish text-terracotta">
                            View Summary &rarr;
                          </Link>
                        ) : (
                          <span className="muted-xs">In progress</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Wellness Suggestions & Campus Care */}
      <section className="mt-4">
        <div className="panel-header-row">
          <h2>
            <PhoneCall size={18} className="text-terracotta inline-icon" aria-hidden="true" />
            Helpful Campus Wellness Resources
          </h2>
        </div>

        <div className="grid-3 mt-2">
          {RESOURCES.map((r) => (
            <article className="panel static editorial-resource-card" key={r.title}>
              <h3>{r.title}</h3>
              <p className="muted-sm">{r.body}</p>
              <a href={r.href} className="resource-link text-terracotta">
                {r.linkText} <ExternalLink size={13} aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
