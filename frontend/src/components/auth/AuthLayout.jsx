/**
 * AuthLayout — Shared wrapper for Login / Signup pages.
 *
 * Two-column split: LEFT 55 % (HeroPanel), RIGHT 45 % (form content).
 * Responsive: stacks on mobile with hero as a short banner.
 */

import { Link } from 'react-router-dom'
import HeroPanel from './HeroPanel.jsx'

export default function AuthLayout({
  children,
  /** Which pill button to show in the nav: 'signup' or 'login' */
  navAction = 'signup',
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* ═══════ LEFT PANEL (55 %) ═══════ */}
      <div className="w-0 lg:w-[55%] flex-shrink-0">
        <HeroPanel />
      </div>

      {/* ═══════ RIGHT PANEL (45 %) ═══════ */}
      <div
        className="flex-1 flex flex-col h-full overflow-y-auto"
        style={{ background: '#0a1010' }}
      >
        {/* ── Top nav ──────────────────────────────────────── */}
        <nav
          className="flex items-center justify-end"
          style={{ padding: '32px 64px', gap: '40px' }}
        >
          {['About', 'Research', 'Features', 'Contact'].map((item) => (
            <a
              key={item}
              href="#"
              className="hidden md:inline-block text-[11px] font-medium uppercase text-white/50 hover:text-white transition-colors duration-300"
              style={{ letterSpacing: '0.15em' }}
            >
              {item}
            </a>
          ))}

          {navAction === 'signup' ? (
            <Link
              to="/signup"
              className="text-[11px] font-semibold uppercase text-[#2dd4bf] hover:bg-[#2dd4bf]/10 transition-all duration-300"
              style={{
                letterSpacing: '0.15em',
                padding: '8px 24px',
                border: '1px solid #2dd4bf',
                borderRadius: '999px',
                whiteSpace: 'nowrap',
              }}
            >
              Sign Up
            </Link>
          ) : (
            <Link
              to="/"
              className="text-[11px] font-semibold uppercase text-[#2dd4bf] hover:bg-[#2dd4bf]/10 transition-all duration-300"
              style={{
                letterSpacing: '0.15em',
                padding: '8px 24px',
                border: '1px solid #2dd4bf',
                borderRadius: '999px',
                whiteSpace: 'nowrap',
              }}
            >
              Login
            </Link>
          )}
        </nav>

        {/* ── Form content (vertically centered, left-aligned with fixed padding) ─ */}
        <div className="flex-1 flex items-center" style={{ paddingLeft: '96px', paddingRight: '64px' }}>
          <div className="w-full" style={{ maxWidth: '480px' }}>
            {children}
          </div>
        </div>

        {/* ── Bottom-right corner ──────────────────────────── */}
        <div className="flex justify-end" style={{ padding: '0 64px 32px' }}>
          <div className="text-right">
            <div className="w-10 h-[2px] bg-[#2dd4bf] ml-auto mb-3" />
            <p
              className="italic leading-relaxed text-white/40"
              style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: '13px',
              }}
            >
              Discover Molecules.<br />
              Decode Possibilities.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
