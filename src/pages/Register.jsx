import React, { useState, useEffect } from 'react'
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth'
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'
import initFirebase from '../firebaseConfig'
import Toast from '../components/Toast'
import '../styles/vendor/register-style.css'
import { redirectIfAuthenticated } from '../utils/authManager'

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

    setIsRegistering(true)

    try {
      const app = initFirebase()
      const auth = getAuth(app)
      const db = getFirestore(app)

      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      if (!userCredential.user) throw new Error('Failed to create account')

      const role = 'utility staff'
      const identifier = await generateUniqueIdentifier(db)

      try {
        await updateProfile(userCredential.user, { displayName: `${firstName} ${lastName}` })
      } catch (updErr) {
        console.warn('Failed to set displayName:', updErr)
      }

      // Explicitly set the document with merge: true to avoid overwriting if somehow exists, 
      // but primarily to ensure fields are set correctly.
      // We await the user doc creation BEFORE redirecting
      const userRef = doc(db, 'users', userCredential.user.uid)
      await setDoc(userRef, {
        firstName: firstName,
        lastName: lastName,
        username: identifier,
        identifier: identifier,
        email: email,
        role: role,
        createdAt: new Date().toISOString(),
      }, { merge: true })
      
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

      alert('Account created successfully. Please login with your credentials.')

      // Sign out immediately so user has to log in again
      try { await signOut(auth) } catch (e) { console.warn('Sign out failed', e) }
      window.location.href = '/login'

    } catch (error) {
      setIsRegistering(false)
      console.error('Registration error:', error)
      let errorMessage = 'Registration failed: '
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered. Please use a different email or login.'
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
      alert(errorMessage)
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

      <div className="logo-corner">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M5 7H19V5C19 3.89543 18.1046 3 17 3H7C5.89543 3 5 3.89543 5 5V7Z"
            stroke="white"
            strokeWidth="2"
          />
          <path
            d="M4 7H20V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V7Z"
            stroke="white"
            strokeWidth="2"
          />
          <line x1="9" y1="11" x2="9" y2="17" stroke="white" strokeWidth="2" />
          <line x1="15" y1="11" x2="15" y2="17" stroke="white" strokeWidth="2" />
        </svg>
        <div className="corner-text">
          <span className="smart">SMART</span>
          <span className="dustbin">DUSTBIN</span>
        </div>
      </div>

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
              required
              style={{ flex: 1 }}
              value={firstName}
              onChange={e => {
                if (/^[a-zA-Z\s]*$/.test(e.target.value)) setFirstName(e.target.value)
              }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="LAST NAME"
              required
              style={{ flex: 1 }}
              value={lastName}
              onChange={e => {
                if (/^[a-zA-Z\s]*$/.test(e.target.value)) setLastName(e.target.value)
              }}
            />
          </div>
          <input
            type="email"
            className={`input-field ${emailError ? 'error' : ''}`}
            placeholder="EMAIL"
            required
            value={email}
            onChange={e => {
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

          <button id="submit" type="submit" className="signup-btn" disabled={isRegistering}>
            {isRegistering ? 'SIGNING UP...' : 'SIGN UP'}
          </button>
        </form>

        <p className="signin-text"> Already have an account? <a href="/login" className="signin-link"> <u>Sign In</u></a></p>
      </div>
    </div>
  )
}
