import React, { useState, useEffect } from 'react'
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'
import initFirebase from '../firebaseConfig'
import Toast from '../components/Toast'
import '../styles/vendor/login-style.css'
import { redirectIfAuthenticated } from '../utils/authManager'

// API base URL - adjust for production
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: '' })
  
  // States for 5-digit code flow
  const [resetStep, setResetStep] = useState('email') // 'email', 'code', 'newPassword'
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setIsLoggingIn(true)
    try {
      const app = initFirebase()
      const auth = getAuth(app)
      const db = getFirestore(app)
      let resolvedEmail = email

      // Check if email is actually username
      if (!email.includes('@')) {
        const uname = await getDoc(doc(db, 'usernames', email))
        if (!uname.exists()) {
             alert('User not found')
             setIsLoggingIn(false)
             return
        }
        resolvedEmail = uname.data().email
      }

      const cred = await signInWithEmailAndPassword(auth, resolvedEmail, password)
      const userRef = doc(db, 'users', cred.user.uid)
      const userDoc = await getDoc(userRef)
      
      if (userDoc.exists()) {
          // Login success, redirect based on role or default
          const role = (userDoc.data().role || '').toString().toLowerCase()
          try { localStorage.setItem('sb_role', role) } catch (e) {}
          if (role === 'admin') {
              window.location.href = '/admin/dashboard'
          } else {
              window.location.href = '/dashboard'
          }
      } else {
          // Check if archived
          const archiveRef = doc(db, 'account_archive', cred.user.uid)
          const archiveDoc = await getDoc(archiveRef)
          
          if (archiveDoc.exists()) {
             alert('This account has been archived. Please contact support to restore it.')
             await auth.signOut()
             setIsLoggingIn(false)
             return
          }
          
          // If simply missing but not archived? (e.g. new user not properly set up)
          // Ideally block, but respecting legacy fallback if needed.
          // However, for this task "can't log in again", blocking is safer.
          // But I'll stick to blocking specifically archived ones or just fail if user doc missing.
          // Given the prompt creates an archive entry, checking for it is robust.
          
          window.location.href = '/dashboard'
      }
    } catch (err) {
      console.error(err)
      setIsLoggingIn(false)
      setPasswordError(true)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      const app = initFirebase()
      const auth = getAuth(app)
      const db = getFirestore(app)
      const provider = new GoogleAuthProvider()
      
      const result = await signInWithPopup(auth, provider)
      const user = result.user
      
      // Check if user exists
      const userRef = doc(db, 'users', user.uid)
      const userDoc = await getDoc(userRef)
      
      if (userDoc.exists()) {
          const data = userDoc.data()
          // Check if profile is complete (has firstName/lastName)
          if (!data.firstName || !data.lastName) {
              window.location.href = '/setup'
          } else {
              // Login success, redirect based on role
              const role = (data.role || 'utility staff').toLowerCase()
              try { localStorage.setItem('sb_role', role) } catch (e) {}
              
              if (role === 'admin') window.location.href = '/admin/dashboard'
              else window.location.href = '/dashboard'
          }
      } else {
          // New user - create initial doc and redirect to setup
          await setDoc(userRef, {
              email: user.email,
              role: 'utility staff',
              createdAt: new Date().toISOString(),
              photoURL: user.photoURL || ''
          })
          window.location.href = '/setup'
      }

    } catch (err) {
      console.error("Google Sign In Error:", err)
      // Specific error handling if needed, or just alert
      if (err.code === 'auth/popup-closed-by-user') return
      alert("Google Sign In Failed. Please try again.")
    }
  }

  // Send 5-digit code to email
  const handleSendResetCode = async () => {
      if(!resetEmail) {
          alert('Please enter your email')
          return
      }
      setIsResetting(true)
      try {
          const response = await fetch(`${API_URL}/api/v1/auth/send-reset-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: resetEmail })
          })
          const data = await response.json()
          
          if (!response.ok) {
            alert(data.error || 'Failed to send reset code')
            setIsResetting(false)
            return
          }
          
          alert('A 5-digit code has been sent to your email!')
          setResetStep('code')
      } catch (error) {
          alert('Error: ' + error.message)
      }
      setIsResetting(false)
  }

  // Verify the 5-digit code
  const handleVerifyCode = async () => {
      if(!resetCode || resetCode.length !== 5) {
          alert('Please enter the 5-digit code')
          return
      }
      setIsResetting(true)
      try {
          const response = await fetch(`${API_URL}/api/v1/auth/verify-reset-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: resetEmail, code: resetCode })
          })
          const data = await response.json()
          
          if (!response.ok) {
            alert(data.error || 'Invalid code')
            setIsResetting(false)
            return
          }
          
          setResetStep('newPassword')
      } catch (error) {
          alert('Error: ' + error.message)
      }
      setIsResetting(false)
  }

  // Set new password
  const handleResetPassword = async () => {
      if(!newPassword || newPassword.length < 6) {
          alert('Password must be at least 6 characters')
          return
      }
      if(newPassword !== confirmPassword) {
          alert('Passwords do not match')
          return
      }
      setIsResetting(true)
      try {
          const response = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: resetEmail, code: resetCode, newPassword })
          })
          const data = await response.json()
          
          if (!response.ok) {
            alert(data.error || 'Failed to reset password')
            setIsResetting(false)
            return
          }
          
          alert('Password reset successfully! You can now login with your new password.')
          closeResetModal()
      } catch (error) {
          alert('Error: ' + error.message)
      }
      setIsResetting(false)
  }

  const closeResetModal = () => {
      setShowResetModal(false)
      setResetStep('email')
      setResetEmail('')
      setResetCode('')
      setNewPassword('')
      setConfirmPassword('')
  }

  // If user is already authenticated, redirect away from login/register pages
  useEffect(() => {
    const unsub = redirectIfAuthenticated()
    return () => { if (typeof unsub === 'function') unsub() }
  }, [])

  return (
    <div className="login-page login-body">
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
        <p className="welcome">Welcome to SmartWaste</p>
        <p className="enter-message">
            Enter your email or identifier and password to access your account.
        </p>

        <form onSubmit={handleLogin}>
            <input
            type="text"
            className="input-field"
            id="email"
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
            }}
            />

            <div className="password-container">
            <input
                type={showPassword ? "text" : "password"}
                id="password"
                className={`input-field ${passwordError ? 'error' : ''}`}
                placeholder="PASSWORD"
                required
                value={password}
                onChange={e => {
                    setPassword(e.target.value)
                    setPasswordError(false)
                }}
            />
            <span id="togglePassword" className="toggle-eye" onClick={() => setShowPassword(!showPassword)}>
                <i className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} id="eyeIcon"></i>
            </span>
            </div>

            {passwordError ? (
                <div style={{color: '#ff4d4d', fontSize: '0.70rem', marginTop: '10px', marginBottom: '20px', textAlign: 'center', fontWeight: 500, fontFamily: '"Montserrat", sans-serif'}}>
                    The password you’ve entered is incorrect. <span onClick={() => setShowResetModal(true)} style={{textDecoration: 'underline', cursor: 'pointer', fontWeight: 600}}>Forgot Password?</span>
                </div>
            ) : (
                <a href="#" onClick={(e) => { e.preventDefault(); setShowResetModal(true)} } className="forgot-link"><u>Forgot your password?</u></a>
            )}
            
            <button id="login" type="submit" className="login-btn" disabled={isLoggingIn}>
              {isLoggingIn ? 'LOGGING IN...' : 'LOGIN'}
            </button>
        </form>

        <div className="separator">OR</div>

        <button id="google-signin" className="google-btn" type="button" onClick={handleGoogleLogin}>
            <img
            src="https://www.google.com/favicon.ico"
            alt="Google"
            width="18"
            height="18"
            />
            Sign in with Google
        </button>

        <p className="signup-text"> New to website? <a href="/register" className="signup-link"> <u>Create an account</u></a></p>
        </div>

        {showResetModal && (
            <div id="forgotModal" className="modal" style={{display:'flex', position:'fixed', left:0, top:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)', alignItems:'center', justifyContent:'center', zIndex:9999}}>
            <div style={{background:'#fff', padding:'20px', borderRadius:'8px', width:'90%', maxWidth:'400px', color:'#000', boxShadow:'0 6px 18px rgba(0,0,0,0.2)'}}>
                
                {resetStep === 'email' && (
                  <>
                    <h3 style={{marginTop:0}}>Reset Password</h3>
                    <p>Enter your email and we'll send you a 5-digit verification code.</p>
                    <input 
                        type="email" 
                        placeholder="Email" 
                        style={{width:'100%', padding:'10px', margin:'8px 0', boxSizing:'border-box', borderRadius:'4px', border:'1px solid #ccc'}} 
                        value={resetEmail}
                        onChange={e => setResetEmail(e.target.value)}
                    />
                    <div style={{textAlign:'right', marginTop:'12px'}}>
                      <button onClick={closeResetModal} style={{marginRight:'8px', padding:'10px 16px', borderRadius:'4px', border:'1px solid #ccc', background:'#fff', cursor:'pointer'}}>Cancel</button>
                      <button onClick={handleSendResetCode} disabled={isResetting} style={{padding:'10px 16px', borderRadius:'4px', border:'none', background:'#027a64', color:'#fff', cursor:'pointer'}}>
                        {isResetting ? 'Sending...' : 'Send Code'}
                      </button>
                    </div>
                  </>
                )}

                {resetStep === 'code' && (
                  <>
                    <h3 style={{marginTop:0}}>Enter Verification Code</h3>
                    <p>We've sent a 5-digit code to <strong>{resetEmail}</strong></p>
                    <input 
                        type="text" 
                        placeholder="Enter 5-digit code"
                        maxLength={5}
                        style={{width:'100%', padding:'14px', margin:'8px 0', boxSizing:'border-box', borderRadius:'4px', border:'1px solid #ccc', textAlign:'center', fontSize:'24px', letterSpacing:'8px', fontWeight:'bold'}} 
                        value={resetCode}
                        onChange={e => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    />
                    <p style={{fontSize:'12px', color:'#666', marginTop:'4px'}}>Code expires in 1 minute</p>
                    <div style={{textAlign:'right', marginTop:'12px'}}>
                      <button onClick={() => setResetStep('email')} style={{marginRight:'8px', padding:'10px 16px', borderRadius:'4px', border:'1px solid #ccc', background:'#fff', cursor:'pointer'}}>Back</button>
                      <button onClick={handleVerifyCode} disabled={isResetting} style={{padding:'10px 16px', borderRadius:'4px', border:'none', background:'#027a64', color:'#fff', cursor:'pointer'}}>
                        {isResetting ? 'Verifying...' : 'Verify Code'}
                      </button>
                    </div>
                  </>
                )}

                {resetStep === 'newPassword' && (
                  <>
                    <h3 style={{marginTop:0}}>Set New Password</h3>
                    <p>Enter your new password below.</p>
                    <div style={{position:'relative'}}>
                      <input 
                          type={showNewPassword ? "text" : "password"}
                          placeholder="New Password" 
                          style={{width:'100%', padding:'10px', margin:'8px 0', boxSizing:'border-box', borderRadius:'4px', border:'1px solid #ccc'}} 
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                      />
                      <span onClick={() => setShowNewPassword(!showNewPassword)} style={{position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', cursor:'pointer', color:'#666'}}>
                        <i className={`fa ${showNewPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </span>
                    </div>
                    <input 
                        type="password" 
                        placeholder="Confirm New Password" 
                        style={{width:'100%', padding:'10px', margin:'8px 0', boxSizing:'border-box', borderRadius:'4px', border:'1px solid #ccc'}} 
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                    />
                    <p style={{fontSize:'12px', color:'#666', marginTop:'4px'}}>Password must be at least 6 characters</p>
                    <div style={{textAlign:'right', marginTop:'12px'}}>
                      <button onClick={closeResetModal} style={{marginRight:'8px', padding:'10px 16px', borderRadius:'4px', border:'1px solid #ccc', background:'#fff', cursor:'pointer'}}>Cancel</button>
                      <button onClick={handleResetPassword} disabled={isResetting} style={{padding:'10px 16px', borderRadius:'4px', border:'none', background:'#027a64', color:'#fff', cursor:'pointer'}}>
                        {isResetting ? 'Resetting...' : 'Reset Password'}
                      </button>
                    </div>
                  </>
                )}

            </div>
            </div>
        )}
    </div>
  )
}
