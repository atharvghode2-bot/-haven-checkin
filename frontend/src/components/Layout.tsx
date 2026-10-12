// App shell with refined editorial navigation, helpline notice, and deep rust-colored footer.
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { ArrowUpRight, HeartHandshake, PhoneCall, Shield, Sparkles, User as UserIcon } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {/* Top crisis announcement banner */}
      <div className="top-helpline-bar" role="region" aria-label="Crisis Support Announcement">
        <div className="top-helpline-content">
          <span className="helpline-badge">
            <PhoneCall size={13} aria-hidden="true" />
            24/7 Crisis Support:
          </span>
          <span className="helpline-text">
            Tele-MANAS (India): <strong>14416</strong> &bull; Emergency: <strong>112</strong> &bull; KIRAN: <strong>1800-599-0019</strong>
          </span>
        </div>
      </div>

      <header className="nav">
        <div className="nav-container">
          <Link className="brand" to="/" aria-label="Haven Check-in Home">
            <HeartHandshake size={22} aria-hidden="true" className="brand-icon" />
            <span className="brand-wordmark">Haven Check-in</span>
          </Link>

          <nav className="nav-links" aria-label="Primary">
            <NavLink to="/" end>
              Home
            </NavLink>
            <a href="/#how-it-works">How It Works</a>
            <a href="/#resources">Wellness Resources</a>
            {user?.role === "student" && <NavLink to="/app">Dashboard</NavLink>}
            {user?.role === "counselor" && <NavLink to="/counselor">Counselor Portal</NavLink>}
            <NavLink to="/privacy">Privacy & Safety</NavLink>

            {user ? (
              <div className="user-nav-group">
                <span className="user-badge" title={`Signed in as ${user.name}`}>
                  {user.role === "student" ? (
                    <>
                      <UserIcon size={13} aria-hidden="true" />
                      <span>{user.anonymous_code || user.name}</span>
                    </>
                  ) : (
                    <>
                      <Shield size={13} aria-hidden="true" />
                      <span>Counselor ({user.name.split(" ")[0]})</span>
                    </>
                  )}
                </span>
                <button
                  className="linkish signout-btn"
                  type="button"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  Sign out
                </button>
                {user.role === "student" && (
                  <Link to="/check-in" className="btn btn-primary nav-cta">
                    Take Check-in
                  </Link>
                )}
              </div>
            ) : (
              <div className="auth-nav-group">
                <NavLink to="/login" className="nav-login-link">
                  Sign in
                </NavLink>
                <Link to="/check-in" className="btn btn-primary nav-cta">
                  <span>Start Check-in</span>
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main id="main" className="main">
        <Outlet />
      </main>

      {/* Rich Terracotta & Rust Footer */}
      <footer className="footer" role="contentinfo">
        <div className="footer-inner">
          <div className="footer-col brand-col">
            <div className="footer-brand">
              <Sparkles size={18} className="footer-brand-icon" aria-hidden="true" />
              <span className="footer-brand-text">Haven Check-in</span>
            </div>
            <p className="footer-tagline">
              A gentle, confidential mental wellness screening aid for college students. Made to give you space to check in with how you feel.
            </p>
            <p className="footer-disclaimer-note">
              <strong>Academic & Screening Prototype:</strong> Haven is not a diagnostic tool and does not provide clinical care or emergency treatment.
            </p>
          </div>

          <div className="footer-col links-col">
            <h4 className="footer-heading">Navigation</h4>
            <ul className="footer-links-list">
              <li><Link to="/">Home</Link></li>
              <li><a href="/#how-it-works">How It Works</a></li>
              <li><a href="/#resources">Crisis & Wellness Resources</a></li>
              <li><Link to="/check-in">Take a Check-in</Link></li>
              <li><Link to="/login">Sign In / Demo Accounts</Link></li>
              <li><Link to="/privacy">Data Governance & Privacy</Link></li>
            </ul>
          </div>

          <div className="footer-col crisis-col">
            <h4 className="footer-heading">Immediate Support</h4>
            <p className="footer-support-intro">
              If you or someone you care about is experiencing significant distress, free support is available 24/7:
            </p>
            <div className="footer-helpline-card">
              <span className="footer-helpline-title">Tele-MANAS (Govt. of India)</span>
              <a href="tel:14416" className="footer-helpline-phone">
                14416 <ArrowUpRight size={14} aria-hidden="true" />
              </a>
              <span className="footer-helpline-meta">Toll-Free, Confidential, Multilingual</span>
            </div>
            <div className="footer-helpline-card mt-2">
              <span className="footer-helpline-title">National Emergency Services</span>
              <a href="tel:112" className="footer-helpline-phone">
                112 <ArrowUpRight size={14} aria-hidden="true" />
              </a>
              <span className="footer-helpline-meta">Immediate Safety & Medical Dispatch</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <div className="footer-bottom-inner">
            <p>&copy; {new Date().getFullYear()} Haven Check-in. Designed for student mental wellness.</p>
            <div className="footer-bottom-links">
              <Link to="/privacy">Privacy Policy</Link>
              <a href="#main">Back to top &uarr;</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
