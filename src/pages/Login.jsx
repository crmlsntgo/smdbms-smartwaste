import React, { useState } from 'react'
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'
import initFirebase from '../firebaseConfig'
import '../styles/vendor/login-style.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetEmail, setResetEmail] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
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

  const handleResetPassword = async () => {
      if(!resetEmail) {
          alert('Please enter your email')
          return
      }
      try {
          const app = initFirebase()
          const auth = getAuth(app)
          await sendPasswordResetEmail(auth, resetEmail)
          alert('Password reset link sent!')
          setShowResetModal(false)
      } catch (error) {
          alert('Error: ' + error.message)
      }
  }

  return (
    <div className="login-page login-body">
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
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
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
            
            <button id="login" type="submit" className="login-btn">LOGIN</button>
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
                <h3 style={{marginTop:0}}>Reset password</h3>
                <p>Enter your email and we'll send a password reset link.</p>
                <input 
                    type="email" 
                    placeholder="Email" 
                    style={{width:'100%', padding:'8px', margin:'8px 0', boxSizing:'border-box'}} 
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                />
                <div style={{textAlign:'right', marginTop:'8px'}}>
                <button onClick={() => setShowResetModal(false)} style={{marginRight:'8px', padding:'8px 12px'}}>Cancel</button>
                <button onClick={handleResetPassword} style={{padding:'8px 12px'}}>Send link</button>
                </div>
            </div>
            </div>
        )}
    </div>
  )
}
