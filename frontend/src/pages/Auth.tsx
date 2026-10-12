// Sign-in and registration with accessible validation, paste-friendly inputs, and demo account shortcuts.
import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { HeartHandshake, Lock, LogIn, Sparkles, User as UserIcon } from "lucide-react";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button, ErrorSummary, Field } from "../components/Ui";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const next = params.get("next") || (location.state as { next?: string } | null)?.next;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "counselor">("student");
  const [errors, setErrors] = useState<{ field: string; text: string }[]>([]);
  const [pending, setPending] = useState(false);

  function fillDemo(userType: "student" | "counselor") {
    if (userType === "student") {
      setEmail("student@haven.edu");
      setPassword("Student123!");
      setRole("student");
      setName("Maya");
    } else {
      setEmail("counselor@haven.edu");
      setPassword("Counselor123!");
      setRole("counselor");
      setName("Priya Shah");
    }
    setErrors([]);
  }

  function validate() {
    const nextErrors: { field: string; text: string }[] = [];
    if (!email.includes("@")) nextErrors.push({ field: "email", text: "Please enter a valid academic or personal email." });
    if (password.length < 8) nextErrors.push({ field: "password", text: "Password must be at least 8 characters long." });
    if (mode === "register" && !name.trim()) {
      nextErrors.push({ field: "name", text: "Please provide a preferred first name." });
    }
    if (mode === "register" && role === "counselor" && !email.toLowerCase().endsWith("@haven.edu")) {
      nextErrors.push({ field: "email", text: "Counselor registrations require an official campus email ending in @haven.edu." });
    }
    return nextErrors;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validate();
    if (nextErrors.length) {
      setErrors(nextErrors);
      return;
    }
    setPending(true);
    setErrors([]);
    try {
      const user =
        mode === "login"
          ? await login(email, password)
          : await register({ email, password, name, role });
      const dest = next || (user.role === "counselor" ? "/counselor" : "/app");
      navigate(dest);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Authentication failed. Please verify credentials.";
      setErrors([{ field: "email", text: message }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-container reveal">
      <div className="grid-2 auth-grid">
        {/* Form Column */}
        <form className="panel auth-panel" onSubmit={onSubmit} noValidate>
          <div className="auth-header">
            <HeartHandshake size={28} className="text-accent mb-1" aria-hidden="true" />
            <h1>{mode === "login" ? "Sign in to Haven" : "Create an Account"}</h1>
            <p className="muted-sm">
              {mode === "login"
                ? "Access your private wellness check-ins and screening trends."
                : "Register for confidential campus screening and trend monitoring."}
            </p>
          </div>

          <ErrorSummary
            title="Please correct the following:"
            items={errors.map((item) => ({ href: `#${item.field}`, text: item.text }))}
          />

          {mode === "register" && (
            <Field id="name" label="Preferred Name / Alias" error={errors.find((e) => e.field === "name")?.text}>
              <input
                className="input"
                id="name"
                autoComplete="given-name"
                placeholder="e.g. Maya"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          )}

          <Field id="email" label="Email Address" error={errors.find((e) => e.field === "email")?.text}>
            <input
              className="input"
              id="email"
              type="email"
              autoComplete="username"
              placeholder="e.g. student@haven.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field
            id="password"
            label="Password"
            hint="Must be at least 8 characters. Paste is supported."
            error={errors.find((e) => e.field === "password")?.text}
          >
            <input
              className="input"
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {mode === "register" && (
            <Field id="role" label="Account Role">
              <select
                className="select"
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as "student" | "counselor")}
              >
                <option value="student">Student (Confidential Screening)</option>
                <option value="counselor">Campus Counselor (@haven.edu only)</option>
              </select>
            </Field>
          )}

          <Button type="submit" variant="primary" disabled={pending} className="w-full mt-2">
            {pending ? (
              "Authenticating..."
            ) : mode === "login" ? (
              <>
                <LogIn size={16} aria-hidden="true" />
                Sign In
              </>
            ) : (
              <>
                <UserIcon size={16} aria-hidden="true" />
                Create Account
              </>
            )}
          </Button>

          <div className="auth-switch-link mt-3">
            {mode === "login" ? (
              <span>
                New student or counselor? <Link to="/register">Create an account</Link>
              </span>
            ) : (
              <span>
                Already have an account? <Link to="/login">Sign in here</Link>
              </span>
            )}
          </div>
        </form>

        {/* Demo Accounts Aside */}
        <aside className="panel static demo-accounts-panel">
          <div className="flex-row items-center gap-2 mb-2">
            <Sparkles size={20} className="text-accent" aria-hidden="true" />
            <h2>Pre-seeded Demo Accounts</h2>
          </div>
          <p className="muted-sm">
            Use these one-click buttons to instantly autofill test credentials for your project evaluation:
          </p>

          <div className="demo-fill-card student-demo mt-3">
            <div className="flex-row justify-between items-center">
              <div>
                <strong>Student Account (Maya)</strong>
                <p className="muted-xs">Email: <code>student@haven.edu</code></p>
                <p className="muted-xs">Password: <code>Student123!</code></p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fillDemo("student")}
                title="Fill student credentials"
              >
                Autofill Student
              </button>
            </div>
          </div>

          <div className="demo-fill-card counselor-demo mt-3">
            <div className="flex-row justify-between items-center">
              <div>
                <strong>Counselor Account (Priya)</strong>
                <p className="muted-xs">Email: <code>counselor@haven.edu</code></p>
                <p className="muted-xs">Password: <code>Counselor123!</code></p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fillDemo("counselor")}
                title="Fill counselor credentials"
              >
                Autofill Counselor
              </button>
            </div>
          </div>

          <div className="security-notice-box mt-4">
            <Lock size={16} className="text-accent inline-icon" aria-hidden="true" />
            <p className="muted-xs">
              Passwords are automatically hashed using PBKDF2 with SHA-256 and unique 16-byte salts. Session tokens are signed using JWT.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
