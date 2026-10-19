// App shell with floating glassmorphism navigation, crisis announcement bar, and deep burgundy footer.
import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { PhoneCall, Shield, User as UserIcon } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Arrow, Leaf } from "./Ui";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobile = () => setMobileMenuOpen(false);

  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {/* Top crisis announcement banner */}
      <div className="top-helpline-bar" role="region" aria-label="Crisis Support Announcement">
        <div className="top-helpline-content">
          <span className="helpline-badge">
            <PhoneCall size={12} aria-hidden="true" />
            24/7 Verified Support:
          </span>
          <span className="helpline-text">
            Tele-MANAS: <a href="tel:14416">14416</a> &bull; Emergency: <a href="tel:112">112</a> &bull; KIRAN: <a href="tel:18005990019">1800-599-0019</a>
          </span>
        </div>
      </div>

      {/* Floating Glassmorphism Header */}
      <header className="site-header">
        <nav className="nav container" aria-label="Main navigation">
          <Link
            className="brand"
            to="/"
            aria-label="Haven Check-in Home"
            onClick={() => {
              closeMobile();
              if (window.location.pathname === "/") {
                window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
              }
            }}
          >
            <Leaf />
            <span>haven</span>
          </Link>

          {/* Links drawer for desktop & mobile */}
          <div className={`links ${mobileMenuOpen ? "open" : ""}`}>
            <NavLink
              to="/"
              end
              onClick={() => {
                closeMobile();
                if (window.location.pathname === "/") {
                  window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
                }
              }}
            >
              Home
            </NavLink>
            <a href="/#how" onClick={closeMobile}>
              How it works
            </a>
            <NavLink to="/chat" onClick={closeMobile}>
              AI Companion
            </NavLink>
            <a href="/#resources" onClick={closeMobile}>
              Resources
            </a>
            <NavLink to="/privacy" onClick={closeMobile}>
              Privacy
            </NavLink>
            {user?.role === "student" && (
              <NavLink to="/app" onClick={closeMobile}>
                Dashboard
              </NavLink>
            )}
            {user?.role === "counselor" && (
              <NavLink to="/counselor" onClick={closeMobile}>
                Counselor Portal
              </NavLink>
            )}
          </div>

          <div className="nav-actions">
            {user ? (
              <>
                <span className="user-nav-badge" title={`Signed in as ${user.name}`}>
                  {user.role === "student" ? (
                    <>
                      <UserIcon size={12} aria-hidden="true" />
                      <span>{user.anonymous_code || user.name.split(" ")[0]}</span>
                    </>
                  ) : (
                    <>
                      <Shield size={12} aria-hidden="true" />
                      <span>Counselor</span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  className="linkish"
                  style={{
                    background: "none",
                    border: 0,
                    color: "var(--muted)",
                    fontSize: "13px",
                    cursor: "pointer",
                    padding: "6px 8px",
                  }}
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  Sign out
                </button>
                {user.role === "student" && (
                  <Link to="/check-in" className="nav-cta" onClick={closeMobile}>
                    Take Check-in <Arrow />
                  </Link>
                )}
              </>
            ) : (
              <>
                <NavLink
                  to="/login"
                  style={{
                    color: "var(--muted)",
                    fontSize: "13px",
                    fontWeight: 500,
                    marginRight: "4px",
                  }}
                  className="hide-mobile"
                >
                  Sign In
                </NavLink>
                <Link to="/check-in" className="nav-cta" onClick={closeMobile}>
                  Start your check-in <Arrow />
                </Link>
              </>
            )}

            {/* Mobile hamburger button with animated lines */}
            <button
              className="menu"
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation"
              aria-expanded={mobileMenuOpen}
            >
              <i />
              <i />
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content Viewport */}
      <main id="main">
        <Outlet />
      </main>

      {/* Deep Burgundy 4-Column Footer */}
      <footer role="contentinfo">
        <div className="container footer-grid">
          <div>
            <Link className="brand" to="/" style={{ color: "#ffffff" }}>
              <Leaf />
              <span>haven</span>
            </Link>
            <p style={{ marginTop: "14px" }}>
              A gentle space to pause, reflect, and understand how you feel at your own pace.
            </p>
            <p style={{ fontSize: "11px", color: "#bda39b" }}>
              Haven Check-in is an academic wellness screening aid. It is strictly non-diagnostic and cannot replace licensed clinical care or emergency services.
            </p>
          </div>

          <div>
            <strong>Explore</strong>
            <Link to="/">Home</Link>
            <a href="/#how">How it works</a>
            <Link to="/chat">AI Companion</Link>
            <a href="/#resources">Resources</a>
            <a href="/#faq">FAQ</a>
          </div>

          <div>
            <strong>Trust &amp; Safety</strong>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/privacy#consent">Informed Consent</Link>
            <Link to="/privacy#camera">Camera Off by Default</Link>
            <Link to="/login">Demo Accounts</Link>
          </div>

          <div>
            <strong>24/7 Crisis Support</strong>
            <div className="footer-helpline-box">
              <span>National Tele-MANAS (Govt of India):</span>
              <a href="tel:14416">
                14416 <Arrow />
              </a>
            </div>
            <div className="footer-helpline-box" style={{ marginTop: "8px" }}>
              <span>National Emergency Number:</span>
              <a href="tel:112">
                112 <Arrow />
              </a>
            </div>
            <div className="footer-helpline-box" style={{ marginTop: "8px" }}>
              <span>KIRAN Mental Health Line:</span>
              <a href="tel:18005990019">
                1800-599-0019 <Arrow />
              </a>
            </div>
          </div>
        </div>

        <div className="container copyright">
          <span>&copy; {new Date().getFullYear()} Haven Check-in &bull; Private Academic Screening Prototype</span>
          <span>Made with care for student well-being.</span>
        </div>
      </footer>
    </div>
  );
}
