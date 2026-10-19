import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApiBaseUrl } from "../api/client";
import { Spark } from "../components/Ui";

type ProbeStatus = "checking" | "connected" | "sleeping" | "error";

export function Health() {
  const [apiUrl, setApiUrl] = useState<string>(getApiBaseUrl());
  const [probeStatus, setProbeStatus] = useState<ProbeStatus>("checking");
  const [backendData, setBackendData] = useState<Record<string, unknown> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  async function checkBackend(targetUrl: string) {
    setProbeStatus("checking");
    setErrorMessage(null);
    const start = performance.now();
    try {
      const res = await fetch(`${targetUrl}/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const end = performance.now();
      setLatencyMs(Math.round(end - start));
      if (res.ok) {
        const json = await res.json().catch(() => ({ ok: true }));
        setBackendData(json);
        setProbeStatus("connected");
      } else {
        setProbeStatus("error");
        setErrorMessage(`Backend returned HTTP status ${res.status} (${res.statusText})`);
      }
    } catch (err: unknown) {
      const end = performance.now();
      setLatencyMs(Math.round(end - start));
      setProbeStatus("error");
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setErrorMessage(
          "Network request failed. If your backend is deployed on Render free tier, it may be waking from sleep (takes 30-50s), or CORS may not yet allow this frontend domain.",
        );
      } else {
        setErrorMessage(msg);
      }
    }
  }

  useEffect(() => {
    checkBackend(apiUrl);
  }, [apiUrl]);

  return (
    <div className="privacy-page reveal" style={{ maxWidth: "760px", margin: "2rem auto", padding: "0 1.5rem" }}>
      <article>
        <p className="eyebrow">
          <i /> System Verification &amp; Diagnostics
        </p>
        <h1>System Health &amp; Connectivity</h1>
        <p>
          This diagnostics page validates communication between your deployed Haven Check-in frontend and the FastAPI
          backend service.
        </p>

        {/* Frontend Status Card */}
        <div
          style={{
            background: "var(--card-bg, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "12px",
            padding: "1.5rem",
            marginBottom: "1.5rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem" }}>Frontend Service</h3>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted, #64748b)" }}>
                React 19 + Vite Static Site (Client Browser)
              </p>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.35rem 0.75rem",
                borderRadius: "999px",
                fontSize: "0.85rem",
                fontWeight: 600,
                background: "#dcfce7",
                color: "#166534",
              }}
            >
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a" }} />
              Healthy &amp; Rendered
            </span>
          </div>
          <div style={{ marginTop: "1rem", fontSize: "0.875rem" }}>
            <strong>Origin:</strong>{" "}
            <code>{typeof window !== "undefined" ? window.location.origin : "SSR"}</code>
          </div>
        </div>

        {/* Backend Status Card */}
        <div
          style={{
            background: "var(--card-bg, #ffffff)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "12px",
            padding: "1.5rem",
            marginBottom: "1.5rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem" }}>FastAPI Backend Service</h3>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted, #64748b)" }}>
                Python + FastAPI + Uvicorn Web Service
              </p>
            </div>
            {probeStatus === "checking" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.35rem 0.75rem",
                  borderRadius: "999px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  background: "#fef3c7",
                  color: "#92400e",
                }}
              >
                Connecting...
              </span>
            )}
            {probeStatus === "connected" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.35rem 0.75rem",
                  borderRadius: "999px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  background: "#dcfce7",
                  color: "#166534",
                }}
              >
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a" }} />
                Online ({latencyMs}ms)
              </span>
            )}
            {probeStatus === "error" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.35rem 0.75rem",
                  borderRadius: "999px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  background: "#fee2e2",
                  color: "#991b1b",
                }}
              >
                Unreachable
              </span>
            )}
          </div>

          <div style={{ marginTop: "1rem", fontSize: "0.875rem", display: "grid", gap: "0.5rem" }}>
            <div>
              <strong>Target API Base URL:</strong>{" "}
              <code>{apiUrl}</code>
            </div>
            <div>
              <strong>Direct Health Link:</strong>{" "}
              <a href={`${apiUrl}/health`} target="_blank" rel="noopener noreferrer">
                {apiUrl}/health &rarr;
              </a>
            </div>
            {backendData && (
              <div style={{ marginTop: "0.5rem" }}>
                <strong>Backend Response:</strong>
                <pre
                  style={{
                    background: "#f8fafc",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    overflowX: "auto",
                    fontSize: "0.825rem",
                  }}
                >
                  {JSON.stringify(backendData, null, 2)}
                </pre>
              </div>
            )}
            {errorMessage && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.75rem",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "6px",
                  color: "#991b1b",
                }}
              >
                <strong>Diagnostic Note:</strong> {errorMessage}
              </div>
            )}
          </div>

          <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => checkBackend(apiUrl)}
              style={{ fontSize: "0.875rem", padding: "0.4rem 0.8rem" }}
            >
              Re-probe Backend
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const custom = window.prompt("Enter custom backend URL to test (e.g. https://your-backend.onrender.com):", apiUrl);
                if (custom && custom.trim()) {
                  const cleaned = custom.trim().replace(/\/+$/, "");
                  setApiUrl(cleaned);
                  try {
                    localStorage.setItem("haven_api_base_url", cleaned);
                  } catch {
                    // Ignore
                  }
                }
              }}
              style={{ fontSize: "0.875rem", padding: "0.4rem 0.8rem" }}
            >
              Change Target URL
            </button>
          </div>
        </div>

        <div style={{ marginTop: "2rem" }}>
          <Link to="/" className="btn btn-secondary">
            <Spark /> Return to Haven Check-in
          </Link>
        </div>
      </article>
    </div>
  );
}
