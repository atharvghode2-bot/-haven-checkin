// React Error Boundary to catch and display any unexpected client-side errors gracefully.
import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error caught by Haven ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            backgroundColor: "#F5F2FA",
            color: "#292536",
            fontFamily: "'Raleway', 'Segoe UI', sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "520px",
              width: "100%",
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              padding: "2.5rem",
              boxShadow: "0 10px 25px rgba(138, 123, 176, 0.15)",
              border: "1px solid #E4DDEE",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "#F5F2FA",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1.25rem",
                color: "#C58D9B",
              }}
            >
              <AlertTriangle size={32} />
            </div>

            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 600,
                color: "#292536",
                marginBottom: "0.75rem",
                fontFamily: "'Lora', Georgia, serif",
              }}
            >
              Something went wrong
            </h1>

            <p style={{ color: "#5E5671", fontSize: "0.95rem", lineHeight: 1.5, marginBottom: "1.5rem" }}>
              Haven encountered an unexpected client error. Your confidential session data remains safe.
            </p>

            {this.state.error?.message && (
              <div
                style={{
                  backgroundColor: "#F5F2FA",
                  border: "1px solid #E4DDEE",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  fontSize: "0.85rem",
                  color: "#7869A0",
                  textAlign: "left",
                  marginBottom: "1.5rem",
                  fontFamily: "monospace",
                  wordBreak: "break-word",
                }}
              >
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "0.6rem 1.25rem",
                  backgroundColor: "#8A7BB0",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                <RefreshCw size={16} />
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "0.6rem 1.25rem",
                  backgroundColor: "#FFFFFF",
                  color: "#292536",
                  border: "1px solid #E4DDEE",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                <Home size={16} />
                Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
