import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AuthLayout from '../components/auth/AuthLayout.jsx'
import { post } from '../lib/apiClient.js'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' },
  }),
}

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: Email, 2: Question, 3: Success
  const [email, setEmail] = useState('')
  const [securityQuestion, setSecurityQuestion] = useState('')
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetToken, setResetToken] = useState(null)

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await post('/api/auth/forgot-password', { email })
      setSecurityQuestion(data.security_question)
      setStep(2)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleAnswerSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await post('/api/auth/verify-security-answer', { 
        email, 
        security_answer: securityAnswer 
      })
      if (data.local_reset_token) {
        setResetToken(data.local_reset_token)
        setStep(3)
      }
    } catch (err) {
      setError(err.message || 'Incorrect security answer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout navAction="login">
      <motion.div initial="hidden" animate="visible">
        {/* ── Logo ──────────────────────────────────────────── */}
        <motion.div custom={0} variants={fadeUp} style={{ marginBottom: '12px' }}>
          <img
            src="/rogveda_logo.png"
            alt="ROGVEDA"
            style={{
              maxWidth: '420px',
              width: '100%',
              height: 'auto',
              display: 'block',
              mixBlendMode: 'screen',
              background: 'transparent !important',
              filter: 'drop-shadow(0 0 16px rgba(45, 212, 191, 0.15))',
            }}
            draggable={false}
          />
        </motion.div>

        <motion.div custom={1} variants={fadeUp}>
          <div style={{ width: '32px', height: '2px', backgroundColor: '#2dd4bf', marginBottom: '24px' }} />
        </motion.div>

        {/* ── Form header ───────────────────────────────────── */}
        <motion.div custom={2} variants={fadeUp} style={{ marginBottom: '8px' }}>
          <h2
            className="text-[28px] text-white"
            style={{ fontFamily: '"Playfair Display", Georgia, serif', marginBottom: '8px' }}
          >
            Forgot Password
          </h2>
        </motion.div>
        <motion.div custom={3} variants={fadeUp} style={{ marginBottom: '32px' }}>
          <p className="text-[13px] text-white/40">
            {step === 1 && 'Enter your registered email to begin password recovery'}
            {step === 2 && 'Answer your security question to verify your identity'}
            {step === 3 && 'Identity verified successfully'}
          </p>
        </motion.div>

        {/* ── Error banner ──────────────────────────────────── */}
        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center gap-2"
            style={{
              background: 'rgba(192, 80, 80, 0.12)',
              border: '1px solid rgba(192, 80, 80, 0.3)',
              color: '#f87171',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* ── Success view ──────────────────────────────────── */}
        {step === 3 && (
          <motion.div custom={4} variants={fadeUp} className="flex flex-col items-start">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-5" style={{ background: 'rgba(45, 212, 191, 0.1)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <p className="text-white mb-6 text-[14px] leading-relaxed">
              Your security answer was verified. A password reset link has been generated.
            </p>
            
            {resetToken && (
              <div className="w-full mt-2 p-5 rounded-xl" style={{ background: 'rgba(45, 212, 191, 0.05)', border: '1px solid rgba(45, 212, 191, 0.15)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-[#2dd4bf] animate-pulse"></div>
                  <h3 className="text-[11px] text-[#2dd4bf] uppercase tracking-wider font-bold">Local Mode Active</h3>
                </div>
                <p className="text-[13px] text-white/60 mb-5 leading-relaxed">
                  You are running ROGVEDA locally. Click the button below to reset your password instantly instead of checking your email.
                </p>
                <button
                  onClick={() => navigate(`/reset-password?token=${resetToken}`)}
                  className="w-full font-bold uppercase text-white flex items-center justify-center transition-all hover:brightness-110 active:scale-[0.99]"
                  style={{
                    height: '48px',
                    borderRadius: '8px',
                    letterSpacing: '0.1em',
                    fontSize: '12px',
                    background: 'linear-gradient(90deg, #2dd4bf, #2563eb)',
                    boxShadow: '0 4px 14px rgba(45, 212, 191, 0.2)'
                  }}
                >
                  Reset Password Now
                  <span style={{ marginLeft: '8px', fontSize: '14px' }}>→</span>
                </button>
              </div>
            )}
            
            {!resetToken && (
              <button
                onClick={() => navigate('/login')}
                className="text-[#2dd4bf] hover:underline text-[13px] mt-6"
              >
                Back to Login
              </button>
            )}
          </motion.div>
        )}

        {/* ── Security Question Form ────────────────────────── */}
        {step === 2 && (
          <motion.form custom={4} variants={fadeUp} onSubmit={handleAnswerSubmit}>
            <div className="mb-6">
              <p className="text-[#2dd4bf] text-xs font-bold uppercase tracking-wider mb-2">Security Question</p>
              <p className="text-white text-sm bg-[#0f1a19] border border-[#1f3a37] p-4 rounded-lg">{securityQuestion}</p>
            </div>

            {/* Answer */}
            <div className="relative group" style={{ marginBottom: '24px' }}>
              <div
                className="absolute text-white/25 group-focus-within:text-[#2dd4bf] transition-colors"
                style={{ left: '20px', top: '50%', transform: 'translateY(-50%)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <input
                type="text"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="Your Answer"
                required
                className="w-full text-sm text-white placeholder-white/20 outline-none transition-all duration-200 focus:border-[#2dd4bf]/60 focus:ring-1 focus:ring-[#2dd4bf]/30"
                style={{
                  height: '56px',
                  paddingLeft: '48px',
                  paddingRight: '16px',
                  borderRadius: '10px',
                  background: '#0f1a19',
                  border: '1px solid #1f3a37',
                }}
              />
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02, filter: 'brightness(1.1)' }}
              whileTap={{ scale: 0.99 }}
              className="w-full font-bold uppercase text-white flex items-center justify-center disabled:opacity-50 cursor-pointer"
              style={{
                height: '56px',
                borderRadius: '10px',
                letterSpacing: '0.1em',
                fontSize: '13px',
                background: 'linear-gradient(90deg, #2dd4bf, #2563eb)',
                transition: 'all 0.2s ease',
              }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Verify Answer'
              )}
            </motion.button>
            
            <div className="text-center mt-6 flex justify-between px-2">
              <button type="button" onClick={() => setStep(1)} className="text-[12px] text-[#2dd4bf] hover:underline transition-colors">
                ← Back
              </button>
              <Link to="/login" className="text-[12px] text-white/50 hover:text-white transition-colors">
                Cancel
              </Link>
            </div>
          </motion.form>
        )}


        {step === 1 && (
          /* ── Form ──────────────────────────────────────────── */
          <motion.form custom={4} variants={fadeUp} onSubmit={handleEmailSubmit}>
            {/* Email */}
            <div className="relative group" style={{ marginBottom: '24px' }}>
              <div
                className="absolute text-white/25 group-focus-within:text-[#2dd4bf] transition-colors"
                style={{ left: '20px', top: '50%', transform: 'translateY(-50%)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="w-full text-sm text-white placeholder-white/20 outline-none transition-all duration-200 focus:border-[#2dd4bf]/60 focus:ring-1 focus:ring-[#2dd4bf]/30"
                style={{
                  height: '56px',
                  paddingLeft: '48px',
                  paddingRight: '16px',
                  borderRadius: '10px',
                  background: '#0f1a19',
                  border: '1px solid #1f3a37',
                }}
              />
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02, filter: 'brightness(1.1)' }}
              whileTap={{ scale: 0.99 }}
              className="w-full font-bold uppercase text-white flex items-center justify-center disabled:opacity-50 cursor-pointer"
              style={{
                height: '56px',
                borderRadius: '10px',
                letterSpacing: '0.1em',
                fontSize: '13px',
                background: 'linear-gradient(90deg, #2dd4bf, #2563eb)',
                transition: 'all 0.2s ease',
              }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Continue'
              )}
            </motion.button>
            
            <div className="text-center mt-6">
              <Link to="/login" className="text-[12px] text-white/50 hover:text-white transition-colors">
                Back to Login
              </Link>
            </div>
          </motion.form>
        )}
      </motion.div>
    </AuthLayout>
  )
}
