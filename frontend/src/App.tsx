// Route map with role gates.
import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { Loading } from "./components/Ui";
import { ScrollToTop } from "./components/ScrollToTop";
import { AlertDetail } from "./pages/AlertDetail";
import { AuthPage } from "./pages/Auth";
import { Chat } from "./pages/Chat";
import { CounselorHome } from "./pages/Counselor";
import { Health } from "./pages/Health";
import { Landing } from "./pages/Landing";
import { Privacy } from "./pages/Privacy";
import { Results } from "./pages/Results";
import { Screening } from "./pages/Screening";
import { StudentHome } from "./pages/StudentHome";

function Guard({ role, children }: { role: "student" | "counselor"; children: ReactNode }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
        <Loading label="Verifying session" />
      </div>
    );
  }

  if (!user) {
    const nextPath = location.pathname + location.search;
    const dest = nextPath && nextPath !== "/" ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
    return <Navigate to={dest} replace />;
  }

  if (user.role !== role) {
    return <Navigate to={user.role === "counselor" ? "/counselor" : "/app"} replace />;
  }

  return children;
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/health" element={<Health />} />
        <Route path="/chat" element={<Chat />} />
        <Route
          path="/app"
          element={
            <Guard role="student">
              <StudentHome />
            </Guard>
          }
        />
        <Route
          path="/check-in"
          element={
            <Guard role="student">
              <Screening />
            </Guard>
          }
        />
        <Route
          path="/results/:sessionId"
          element={
            <Guard role="student">
              <Results />
            </Guard>
          }
        />
        <Route
          path="/counselor"
          element={
            <Guard role="counselor">
              <CounselorHome />
            </Guard>
          }
        />
        <Route
          path="/counselor/alerts/:alertId"
          element={
            <Guard role="counselor">
              <AlertDetail />
            </Guard>
          }
        />
        <Route path="*" element={<p>Page not found. Return to the home page.</p>} />
      </Route>
    </Routes>
    </>
  );
}
