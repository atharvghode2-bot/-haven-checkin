// Auth context. Password fields allow paste for WCAG 2.2 accessible authentication.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setToken, type User } from "../api/client";

type AuthState = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: { email: string; password: string; name: string; role: "student" | "counselor" }) => Promise<User>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  async function refresh() {
    try {
      const data = await api<{ user: User }>("/auth/me");
      setUser(data.user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (localStorage.getItem("haven_token")) {
      timer = setTimeout(() => {
        setReady(true);
      }, 2500);
      void refresh().finally(() => {
        if (timer) clearTimeout(timer);
      });
    } else {
      setReady(true);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      ready,
      async login(email, password) {
        const data = await api<{ token: string; user: User }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setToken(data.token);
        setUser(data.user);
        return data.user;
      },
      async register(payload) {
        const data = await api<{ token: string; user: User }>("/auth/register", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setToken(data.token);
        setUser(data.user);
        return data.user;
      },
      logout() {
        setToken(null);
        setUser(null);
      },
      refresh,
    }),
    [user, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
