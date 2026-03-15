import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth'
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, where, limit, deleteDoc } from 'firebase/firestore'
import initFirebase from '../firebaseConfig'
import Toast from '../components/Toast'
import '../styles/vendor/landing-page.css'
import '../styles/vendor/register-style.css'
import { redirectIfAuthenticated } from '../utils/authManager'

// API base URL — empty string lets the Vite dev proxy forward /api/* to localhost:3000
const API_URL = import.meta.env.VITE_API_URL || ''

export default function Register() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState(false)
  const [emailError, setEmailError] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: '' })
  const [isRegistering, setIsRegistering] = useState(false)

  // Email verification modal states
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [isSendingCode, setIsSendingCode] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0) // seconds remaining
  const [isResendingCode, setIsResendingCode] = useState(false)

  // Count down the resend cooldown every second
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  // Redirect away from auth pages if already authenticated
  useEffect(() => {
    const app = initFirebase()
    const auth = getAuth(app)
    
    // Check once on mount, but don't set up a persistent listener that interferes with registration
    if (auth.currentUser && !isRegistering) {
        // window.location.href = '/dashboard' 
        // Better yet: let's not auto-redirect on Register to avoid the race condition entirely.
        // If the user lands here while logged in, they can just navigate away.
        // Or if we really must, ensuring we don't redirect if we just clicked register.
    }
  }, [])

  // Helper to generate unique identifier (matching legacy 8-digit format)
  const generateUniqueIdentifier = async (db) => {
    // Try 10 times to generate a unique ID
    for (let i = 0; i < 10; i++) {
        const identifier = Math.floor(10000000 + Math.random() * 90000000).toString() // 8-digit number
        
        // Check uniqueness against 'usernames' collection which is public readable
        // This avoids permission errors when querying 'users' collection
        const usernameRef = doc(db, 'usernames', identifier)
        const snap = await getDoc(usernameRef)
        
        if (!snap.exists()) {
            return identifier
        }
    }
    // Fallback if collision persists (extremely unlikely)
    return Date.now().toString().slice(-8)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    
    let hasError = false
    let newEmailError = false
    let newPasswordError = false
    let alertMsg = ""

    // Email validation
    // Restrict to common domains
    const allowedDomains = [
        'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
        'icloud.com', 'aol.com', 'protonmail.com', 'zoho.com', 
        'yandex.com', 'mail.com', 'gmx.com', 'me.com', 'live.com', 'msn.com'
    ];

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    const lowerEmail = email.toLowerCase().trim()
    const emailParts = lowerEmail.split('@')
    const domain = emailParts.length === 2 ? emailParts[1] : ''
    
    const isCommonDomain = allowedDomains.includes(domain)

    if (!emailRegex.test(email) || !isCommonDomain) {
        newEmailError = true
        hasError = true
        alertMsg += "Please use a common verified email provider\n"
    }

    // Password length validation
    if (password.length < 8) {
      newPasswordError = true
      hasError = true
      alertMsg += "Password must be at least 8 characters.\n"
    }

    // Password match validation
    if (password !== confirmPassword) {
      newPasswordError = true
      hasError = true
      alertMsg += "Passwords don't match!\n"
    }

    // Update state to show red borders
    setEmailError(newEmailError)
    setPasswordError(newPasswordError)

    // Check if any error occurred
    if (hasError) {
        setToast({ show: true, message: alertMsg.trim(), type: 'error' })
        return
    }

    // Send a 6-digit verification code to the email before creating the account
    setIsSendingCode(true)
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/send-verification-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const rawText = await response.text()
      let data = {}
      try { data = JSON.parse(rawText) } catch (_) {}
      if (!response.ok) {
        if (data.error && data.error.toLowerCase().includes('already registered')) {
          setEmailError(true)
        }
        setToast({ show: true, message: data.error || 'Failed to send verification code. Please try again.', type: 'error' })
        setIsSendingCode(false)
        return
      }
      setVerifyCode('')
      setResendCooldown(60)
      setShowVerifyModal(true)
    } catch (err) {
      setToast({ show: true, message: 'Could not reach the server. Please check your connection and try again.', type: 'error' })
    }
    setIsSendingCode(false)
  }

  // Called after the user enters the correct verification code
  const handleVerifyAndRegister = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      setToast({ show: true, message: 'Please enter the 6-digit verification code.', type: 'error' })
      return
    }

    setIsVerifying(true)
    try {
      const verifyResponse = await fetch(`${API_URL}/api/v1/auth/verify-registration-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verifyCode })
      })
      const verifyRaw = await verifyResponse.text()
      let verifyData = {}
      try { verifyData = JSON.parse(verifyRaw) } catch (_) {}
      if (!verifyResponse.ok) {
        setToast({ show: true, message: verifyData.error || 'Invalid verification code. Please try again.', type: 'error' })
        setIsVerifying(false)
        return
      }
    } catch (err) {
      setToast({ show: true, message: 'Could not reach the server. Please check your connection and try again.', type: 'error' })
      setIsVerifying(false)
      return
    }

    // Code verified — proceed to create the account
    setShowVerifyModal(false)
    setIsRegistering(true)
    setIsVerifying(false)

    try {
      const app = initFirebase()
      const auth = getAuth(app)
      const db = getFirestore(app)

      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      if (!userCredential.user) throw new Error('Failed to create account')

      const role = 'utility staff'

      // If this email was previously archived, restore old profile data.
      let archivedRecord = null
      let archivedDocId = null
      try {
        const archivedQ = query(collection(db, 'account_archive'), where('archivedEmail', '==', email), limit(1))
        const archivedSnap = await getDocs(archivedQ)
        if (!archivedSnap.empty) {
          archivedDocId = archivedSnap.docs[0].id
          archivedRecord = archivedSnap.docs[0].data()
        }
      } catch (archiveLookupError) {
        console.warn('Archived account lookup failed:', archiveLookupError)
      }

      const restoredIdentifier = archivedRecord?.username || archivedRecord?.identifier || null
      const identifier = restoredIdentifier || await generateUniqueIdentifier(db)

      try {
        await updateProfile(userCredential.user, { displayName: `${firstName} ${lastName}` })
      } catch (updErr) {
        console.warn('Failed to set displayName:', updErr)
      }

      const userRef = doc(db, 'users', userCredential.user.uid)
      const userPayload = {
        ...(archivedRecord || {}),
        firstName: firstName,
        lastName: lastName,
        username: identifier,
        identifier: identifier,
        email: email,
        role: archivedRecord?.role || role,
        createdAt: new Date().toISOString(),
      }
      if (archivedRecord) {
        userPayload.restoredAt = new Date().toISOString()
      }
      await setDoc(userRef, userPayload, { merge: true })

      console.log("User document created successfully")

      // Also save to usernames collection for username login support
      try {
        await setDoc(doc(db, 'usernames', identifier), {
          uid: userCredential.user.uid,
          email: email,
          createdAt: new Date().toISOString(),
        })
      } catch (usernameError) {
        console.warn('Error saving username map:', usernameError)
      }

      // Remove archived record after successful restoration
      if (archivedDocId) {
        try {
          await deleteDoc(doc(db, 'account_archive', archivedDocId))
        } catch (archiveDeleteError) {
          console.warn('Failed to delete archived account record:', archiveDeleteError)
        }
      }

      setToast({ show: true, message: 'Account created successfully. Redirecting to login...', type: 'success' })

      // Sign out immediately so the user must log in explicitly
      try { await signOut(auth) } catch (e) { console.warn('Sign out failed', e) }

      setTimeout(() => {
        window.location.href = '/login'
      }, 2000)

    } catch (error) {
      setIsRegistering(false)
      console.error('Registration error:', error)
      let errorMessage = 'Registration failed: '
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered. Please use a different email or log in.'
          setEmailError(true)
          setPasswordError(false)
          break
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.'
          setEmailError(true)
          setPasswordError(false)
          break
        case 'auth/weak-password':
          errorMessage = 'Password should be at least 6 characters.'
          setPasswordError(true)
          setEmailError(false)
          break
        default:
          errorMessage += error.message
          setPasswordError(false)
          setEmailError(false)
      }
      setToast({ show: true, message: errorMessage, type: 'error' })
    }
  }

  return (
    <div className="register-page register-body">
      <Toast 
        message={toast.message}
        show={toast.show}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
        style={{ top: '20px', right: '20px' }}
      />
      <div className="bg-shape1"></div> 
      <div className="bg-shape2"></div>

      {/* Landing Nav Header */}
      <header className="landing-nav" style={{ position: 'absolute', top: 0, width: '100%', flexShrink: 0, zIndex: 1000 }}>
        <div className="landing-nav__container">
          <a href="/" className="landing-nav__logo">
            <div className="landing-nav__logo-icon">
              <i className="fas fa-trash"></i>
            </div>
            <div className="landing-nav__logo-text">
              <span className="landing-nav__logo-title">SMART</span>
              <span className="landing-nav__logo-subtitle">DUSTBIN</span>
            </div>
          </a>
          <nav className="landing-nav__menu">
            <a href="/product" className="landing-nav__link">Product</a>
            <a href="/support" className="landing-nav__link">Support</a>
            <a href="/solutions" className="landing-nav__link">Solutions</a>
          </nav>
          <div className="landing-nav__actions">
            <a href="/login" className="landing-nav__signin">Sign in</a>
            <a href="/register" className="landing-nav__demo">Request Demo</a>
          </div>
          <button className="landing-nav__mobile-toggle" id="mobileMenuToggle">
            <i className="fas fa-bars"></i>
          </button>
        </div>
      </header>


      <div className="login-scroll-area">
      <div className="login-container">
        <div className="logo-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#027a64" />
                    <stop offset="100%" stopColor="#058b6e" />
                </linearGradient>
            </defs>
            {/* Filled Lid */}
            <path 
                d="M19 6h-3.5l-1-1h-5l-1 1H5v2h14V6z" 
                fill="url(#logoGradient)" 
            />
            {/* Filled Body */}
            <path 
                d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V9H6v10z" 
                fill="url(#logoGradient)" 
            />
            {/* White Vertical Lines (cutouts) */}
            <rect x="9" y="11" width="2" height="6" fill="white" rx="1" />
            <rect x="13" y="11" width="2" height="6" fill="white" rx="1" />
          </svg>
        </div>
        <div className="app-name">SMART</div>
        <div className="app-name2">DUSTBIN</div>
        <p className="register">Create an account.</p>
        <p className="regist-message">Register your account with SmartWaste.</p>

        <form onSubmit={handleRegister}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="FIRST NAME"
              maxLength="35"
              required
              style={{ flex: 1 }}
              value={firstName}
              onChange={e => {
                if (e.target.value.length > 35) {
                  setToast({ show: true, message: 'First name cannot exceed 35 characters.', type: 'error' })
                  return
                }
                if (/^[a-zA-Z\s]*$/.test(e.target.value)) setFirstName(e.target.value)
              }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="LAST NAME"
              maxLength="35"
              required
              style={{ flex: 1 }}
              value={lastName}
              onChange={e => {
                if (e.target.value.length > 35) {
                  setToast({ show: true, message: 'Last name cannot exceed 35 characters.', type: 'error' })
                  return
                }
                if (/^[a-zA-Z\s]*$/.test(e.target.value)) setLastName(e.target.value)
              }}
            />
          </div>
          <input
            type="email"
            className={`input-field ${emailError ? 'error' : ''}`}
            placeholder="EMAIL"
            maxLength="254"
            required
            value={email}
            onChange={e => {
              if (e.target.value.length > 254) {
                setToast({ show: true, message: 'Email cannot exceed 254 characters.', type: 'error' })
                return
              }
              setEmail(e.target.value)
              setEmailError(false)
            }}
          />

          <div className="password-container" style={{ position: 'relative' }}>
            <input
              type={showPassword ? "text" : "password"}
              className={`input-field ${passwordError ? 'error' : ''}`}
              placeholder="PASSWORD"
              required
              value={password}
              onChange={e => {
                setPassword(e.target.value)
                setPasswordError(false)
              }}
            />
            <span id="togglePassword" className="toggle-password" onClick={() => setShowPassword(!showPassword)}>
              <i className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </span>
          </div>

          <div className="password-container" style={{ position: 'relative' }}>
            <input
              type={showConfirmPassword ? "text" : "password"}
              className={`input-field ${passwordError ? 'error' : ''}`}
              placeholder="CONFIRM PASSWORD"
              required
              value={confirmPassword}
              onChange={e => {
                setConfirmPassword(e.target.value)
                setPasswordError(false)
              }}
            />
            <span id="toggleConfirmPassword" className="toggle-password" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
             <i className={`fa ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`} ></i>
            </span>
          </div>

          <button id="submit" type="submit" className="signup-btn" disabled={isRegistering || isSendingCode}>
            {isRegistering ? 'SIGNING UP...' : isSendingCode ? 'SENDING CODE...' : 'SIGN UP'}
          </button>
        </form>

        <p className="signin-text"> Already have an account? <a href="/login" className="signin-link"> <u>Sign In</u></a></p>
      </div>
      </div>

      {/* Email Verification Modal */}
      {showVerifyModal && createPortal(
        <div style={{ display: 'flex', position: 'fixed', left: 0, top: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div style={{ background: '#fff', padding: '35px 25px', borderRadius: '16px', width: '90%', maxWidth: '400px', color: '#000', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', textAlign: 'center', fontFamily: '"Montserrat", sans-serif' }}>
            <h3 style={{ marginTop: 0, color: '#027a64' }}>Verify Your Email</h3>
            <p style={{ fontSize: '0.9rem' }}>We've sent a 6-digit code to <br /><strong>{email}</strong></p>
            <input
              type="text"
              placeholder="000000"
              maxLength={6}
              style={{ width: '100%', padding: '15px', margin: '15px 0', boxSizing: 'border-box', borderRadius: '8px', border: '2px solid #027a64', textAlign: 'center', fontSize: '20px', letterSpacing: '8px', fontWeight: 'bold', background: '#f0f9f7' }}
              value={verifyCode}
              onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => {
                  setShowVerifyModal(false)
                  setVerifyCode('')
                  setResendCooldown(0)
                }}
                disabled={isVerifying}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyAndRegister}
                disabled={isVerifying || isResendingCode}
                className="login-btn"
                style={{ flex: 2, margin: 0, borderRadius: '8px', padding: '12px', animation: 'none' }}
              >
                {isVerifying ? 'VERIFYING...' : 'VERIFY & SIGN UP'}
              </button>
            </div>
            <button
              onClick={async () => {
                setIsResendingCode(true)
                try {
                  const r = await fetch(`${API_URL}/api/v1/auth/send-verification-code`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                  })
                  const rRaw = await r.text()
                  let d = {}
                  try { d = JSON.parse(rRaw) } catch (_) {}
                  if (!r.ok) {
                    setToast({ show: true, message: d.error || 'Failed to resend code. Please try again.', type: 'error' })
                  } else {
                    setVerifyCode('')
                    setResendCooldown(60)
                    setToast({ show: true, message: 'A new code has been sent to your email.', type: 'success' })
                  }
                } catch (err) {
                  setToast({ show: true, message: 'Could not reach the server. Please check your connection and try again.', type: 'error' })
                }
                setIsResendingCode(false)
              }}
              disabled={resendCooldown > 0 || isResendingCode || isVerifying}
              style={{ marginTop: '15px', background: 'none', border: 'none', color: '#027a64', cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't get a code? Resend"}
            </button>
          </div>
        </div>
      , document.body)}
    </div>
  )
}
