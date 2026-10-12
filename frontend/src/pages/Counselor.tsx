// Counselor dashboard: alerts list, crisis triage, rich filters, student trend charts, and notes management.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle,
  Clock,
  Eye,
  LineChart as ChartIcon,
  MessageSquare,
  Search,
  Shield,
  ShieldAlert,
  TrendingUp,
  User as UserIcon,
  X,
} from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type AlertRow, type TrendPoint } from "../api/client";
import { Button, Loading, Status } from "../components/Ui";

export function CounselorHome() {
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const [overview, setOverview] = useState({ open: 0, crisis_open: 0, total: 0 });
  const [status, setStatus] = useState("");
  const [band, setBand] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [error, setError] = useState("");

  // Selected student for trend preview
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentCode, setSelectedStudentCode] = useState<string | null>(null);
  const [studentTrends, setStudentTrends] = useState<TrendPoint[] | null>(null);
  const [loadingTrends, setLoadingTrends] = useState(false);

  async function loadAlerts() {
    setError("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (query) params.set("q", query);
      params.set("sort", sort);
      const data = await api<{ alerts: AlertRow[]; overview: typeof overview }>(`/alerts?${params.toString()}`);
      let filtered = data.alerts;
      if (band) {
        filtered = filtered.filter((row) => row.band === band);
      }
      setAlerts(filtered);
      setOverview(data.overview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not retrieve counselor alerts.");
    }
  }

  useEffect(() => {
    void loadAlerts();
  }, [status, sort, band]);

  async function showStudentTrend(studentId: string, anonCode: string) {
    setSelectedStudentId(studentId);
    setSelectedStudentCode(anonCode);
    setLoadingTrends(true);
    try {
      const data = await api<{ points: TrendPoint[] }>(`/students/${studentId}/trends`);
      setStudentTrends(data.points);
    } catch {
      setStudentTrends([]);
    } finally {
      setLoadingTrends(false);
    }
  }

  const chartData = (studentTrends || []).map((row) => ({
    date: new Date(row.completed_at).toLocaleDateString([], { month: "short", day: "numeric" }),
    load: Math.round(row.final_risk),
    anxiety: row.gad7,
  }));

  return (
    <div className="counselor-dashboard reveal">
      {/* Workspace Banner */}
      <div className="dashboard-welcome-banner">
        <div>
          <div className="flex-row items-center gap-2 mb-1">
            <span className="privacy-pill">
              <Shield size={14} aria-hidden="true" />
              Role-Restricted Counselor Portal
            </span>
          </div>
          <h1>Counselor Triage Workspace</h1>
          <p className="lede">
            Monitor screening alerts, track anonymous student distress trends, and document authorized clinical notes.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-3 mt-4">
        <article className="panel static metric-kpi-card">
          <p className="kicker">Open Alerts Requiring Review</p>
          <div className="flex-row items-center gap-2">
            <p className="stat text-amber-400">{overview.open}</p>
            <Clock size={20} className="muted" aria-hidden="true" />
          </div>
          <p className="muted-xs">Unresolved check-in alerts</p>
        </article>

        <article className="panel static metric-kpi-card">
          <p className="kicker">Crisis-Flagged (Urgent)</p>
          <div className="flex-row items-center gap-2">
            <p className="stat text-red-400">{overview.crisis_open}</p>
            <ShieldAlert size={20} className="text-red-400" aria-hidden="true" />
          </div>
          <p className="muted-xs">Self-harm or death items flagged</p>
        </article>

        <article className="panel static metric-kpi-card">
          <p className="kicker">Total Historical Alerts</p>
          <div className="flex-row items-center gap-2">
            <p className="stat">{overview.total}</p>
            <CheckCircle size={20} className="muted" aria-hidden="true" />
          </div>
          <p className="muted-xs">All records under policy</p>
        </article>
      </div>

      {/* Filters and Search Bar */}
      <div className="panel static filters-card mt-4">
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            void loadAlerts();
          }}
        >
          <div className="search-field-wrapper">
            <label htmlFor="search-student" className="sr-only">
              Search by Anonymous Code or Keyword
            </label>
            <div className="input-with-icon">
              <Search size={16} className="search-icon" aria-hidden="true" />
              <input
                id="search-student"
                className="input"
                placeholder="Search code (e.g. STU-4C91)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <label className="filter-label">
            <span>Status:</span>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="in_review">In Review</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>

          <label className="filter-label">
            <span>Risk Band:</span>
            <select className="select" value={band} onChange={(e) => setBand(e.target.value)}>
              <option value="">All Bands</option>
              <option value="elevated">Elevated</option>
              <option value="moderate">Moderate</option>
              <option value="lower">Lower</option>
            </select>
          </label>

          <label className="filter-label">
            <span>Sort By:</span>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="risk">Highest Load (0-100)</option>
            </select>
          </label>

          <Button variant="secondary" type="submit">
            Apply Filters
          </Button>
        </form>
      </div>

      {error && <p className="error mt-3">{error}</p>}
      {!alerts && <Loading label="Loading counselor alerts" />}

      {/* Alerts Table */}
      {alerts && alerts.length === 0 ? (
        <div className="panel static empty-state-block mt-4">
          <CheckCircle size={36} className="text-accent mb-2" aria-hidden="true" />
          <p className="muted">No alerts match the selected criteria.</p>
        </div>
      ) : null}

      {alerts && alerts.length > 0 && (
        <div className="panel static table-wrap mt-4">
          <table>
            <thead>
              <tr>
                <th>Anonymous Student ID</th>
                <th>Screening Band</th>
                <th>Alert Status</th>
                <th>PHQ-9</th>
                <th>GAD-7</th>
                <th>Combined Load</th>
                <th>Recorded At</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/counselor/alerts/${row.id}`} className="student-anon-link">
                      <UserIcon size={14} aria-hidden="true" />
                      <strong>{row.anonymous_code || "STU-ANON"}</strong>
                    </Link>
                  </td>
                  <td>
                    <Status value={row.band} />
                    {row.crisis && (
                      <span className="crisis-mini-pill" title="Triggered crisis item / keyword">
                        <ShieldAlert size={12} aria-hidden="true" /> Crisis
                      </span>
                    )}
                  </td>
                  <td>
                    <Status value={row.status} />
                  </td>
                  <td>
                    <strong>{row.phq9}</strong> / 27
                  </td>
                  <td>
                    <strong>{row.gad7}</strong> / 21
                  </td>
                  <td>
                    <strong>{Math.round(row.final_risk)}</strong> / 100
                  </td>
                  <td className="muted-xs">
                    {new Date(row.created_at).toLocaleString([], {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td>
                    <span className="notes-badge" title="Counselor notes on file">
                      <MessageSquare size={12} aria-hidden="true" />
                      {row.note_count}
                    </span>
                  </td>
                  <td>
                    <div className="flex-row gap-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => void showStudentTrend(row.student_id, row.anonymous_code)}
                        title="Inspect student longitudinal trend"
                      >
                        <ChartIcon size={14} aria-hidden="true" />
                        Trend
                      </button>
                      <Link className="btn btn-secondary btn-xs" to={`/counselor/alerts/${row.id}`}>
                        <Eye size={14} aria-hidden="true" />
                        Manage
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected Student Trend Drawer / Section */}
      {selectedStudentId && (
        <section className="panel static selected-trend-panel mt-4">
          <div className="panel-header-row">
            <div>
              <h2>
                <TrendingUp size={18} className="text-accent inline-icon" aria-hidden="true" />
                Distress &amp; Mood Trend for {selectedStudentCode || "Student"}
              </h2>
              <p className="muted-xs">Showing anonymous session progression over time</p>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedStudentId(null)}
              title="Close trend view"
            >
              <X size={16} aria-hidden="true" /> Close
            </button>
          </div>

          {loadingTrends && <Loading label="Loading trend data" />}

          {!loadingTrends && (!studentTrends || studentTrends.length < 2) ? (
            <p className="muted my-3">
              This student has only completed 1 recorded check-in session. Longitudinal trend graphs require at least two sessions.
            </p>
          ) : null}

          {!loadingTrends && studentTrends && studentTrends.length >= 2 ? (
            <div className="mt-3">
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ background: "#192134", borderColor: "rgba(255,255,255,0.1)", borderRadius: 8 }}
                      labelStyle={{ color: "#ffffff" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="load"
                      stroke="#f87171"
                      strokeWidth={3}
                      name="Combined Risk Load (0-100)"
                      dot={{ r: 4, fill: "#f87171" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="anxiety"
                      stroke="#fbbf24"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      name="GAD-7 Anxiety"
                      dot={{ r: 3, fill: "#fbbf24" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="help-text mt-2">
                Red line: Combined Screening Load (0-100). Dashed yellow line: GAD-7 Anxiety Score (0-21).
              </p>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
