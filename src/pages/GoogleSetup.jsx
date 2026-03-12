import { useEffect, useState } from 'react'
import initFirebase from '../firebaseConfig'
import Toast from '../components/Toast'
import {
  getAuth,
  updatePassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore'
import '../styles/vendor/landing-page.css'
import '../styles/vendor/login-style.css'

export default function GoogleSetup(){
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmError, setConfirmError] = useState(false)
  const [toast, setToast] = useState({ show: false, message: '', type: '' })

  useEffect(()=>{
    let unsub = null
    async function init(){
      try{
        const app = initFirebase()
        const auth = getAuth(app)
        const db = getFirestore(app)

        unsub = onAuthStateChanged(auth, async (user)=>{
          if (!user) {
            window.location.href = '/login'
            return
          }
          setCurrentUser(user)

          try{
            const uSnap = await getDoc(doc(db, 'users', user.uid))
            if (uSnap.exists()){
              const data = uSnap.data() || {}
              const profileComplete = Boolean(
                data.firstName && data.lastName &&
                data.firstName.trim() !== '' && data.lastName.trim() !== ''
              )
              const setupComplete = data.setupComplete !== false && profileComplete
              if (setupComplete){
                // Profile already setup, redirect back or to dashboard
                // If there's a referrer within the app (not implemented in router/history here cleanly), default to /
                // For "back to whatever page they're in", usually means "back to previous".
                // Since this is a setup flow, usually you come here from Login.
                // If they type URL manually, redirect to dashboard is safest.
                window.location.href = '/'
                return
              }
              } else {
                // No user doc yet: create a stub so setup can proceed without redirect loops.
                await setDoc(doc(db, 'users', user.uid), {
                  email: user.email || '',
                  role: 'utility staff',
                  createdAt: new Date().toISOString(),
                  photoURL: user.photoURL || '',
                  setupComplete: false,
                })
              }
          }catch(e){ console.warn('Could not read user profile', e) }

          setLoading(false)
        })
      }catch(err){
        console.error('Failed to initialize Firebase:', err)
        alert('Error loading application. Please try again later.')
      }
    }
    init()
    return ()=>{ if (unsub) unsub() }
  },[])

  async function ensureUsernameMapping(db, userId){
    try{
      const uSnap = await getDoc(doc(db, 'users', userId))
      if (uSnap.exists()){
        const uData = uSnap.data() || {}
        const identifier = uData.identifier || uData.username
        if (identifier){
          const usernameRef = doc(db, 'usernames', identifier)
          const nameSnap = await getDoc(usernameRef)
          if (!nameSnap.exists()){
            await setDoc(usernameRef, {
              uid: userId,
              email: (uData.email || ''),
              createdAt: new Date().toISOString(),
            })
          }
        }
      }
    }catch(e){ console.warn('Failed to ensure username mapping after google setup:', e) }
  }

  // Security check: If trying to access /setup directly while already fully setup, redirect away.
  useEffect(() => {
      // Check if we are on client side
      if (typeof window !== 'undefined') {
          // If we have no user, auth check above handles it.
          // If we have user, we check if setup is complete in the main effect.
          // But we can also do a quick check on localStorage or simple redirect if not intended.
          // The main `useEffect` already handles "if profile complete -> redirect /" 
          // So we mainly need to ensure `loading` state covers the gap.
          // The user requested: "automtically direct them back in whatever page they're in"
          // If they came from correct flow (login), they are here. If they just typed URL,
          // document.referrer might tell us, or we just default to dashboard/login.
          
          // Actually, the main effect logic:
          // if (data.firstName ... ) window.location.href = '/'
          // This covers "already set up".
          // If not logged in -> redirect login.
          // This seems sufficient for "bypass-able", as you can't bypass setup if incomplete,
          // and can't access setup if complete.
      }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!currentUser) { alert('You are not signed in. Please log in again.'); window.location.href = '/login'; return }
    if (!firstName.trim()){ alert('Please enter your first name.'); return }
    if (!lastName.trim()){ alert('Please enter your last name.'); return }
    if (!password){ alert('Please enter a password.'); return }
    if (password.length < 6){ alert('Password must be at least 6 characters long.'); return }
    if (password !== confirmPassword){ 
        setConfirmError(true)
        return 
    }

    const submitButtonState = document.getElementById('submit')
    if (submitButtonState){ submitButtonState.disabled = true; submitButtonState.textContent = 'Setting up...'; }

    try{
      const app = initFirebase()
      const auth = getAuth(app)
      const db = getFirestore(app)

      await updatePassword(currentUser, password)

      try{ await updateProfile(currentUser, { displayName: `${firstName} ${lastName}` }) } catch(e){ console.warn('Failed to update auth displayName:', e) }

      await updateDoc(doc(db, 'users', currentUser.uid), {
        firstName,
        lastName,
        role: 'utility staff',
        updatedAt: new Date().toISOString(),
        setupComplete: true,
      })

      await ensureUsernameMapping(db, currentUser.uid)

      setToast({ show: true, message: 'Profile setup complete! Redirecting to dashboard...', type: 'success' })
      
      // Redirect based on role
      setTimeout(async () => {
        try {
          const uSnap = await getDoc(doc(db, 'users', currentUser.uid))
          if(uSnap.exists()) {
               const r = (uSnap.data().role || 'utility staff').toLowerCase()
               if (r === 'admin') window.location.href = '/admin/dashboard'
               else window.location.href = '/dashboard'
          } else {
               window.location.href = '/dashboard'
          }
        } catch (e) {
            window.location.href = '/dashboard'
        }
      }, 2000)

    }catch(error){
      console.error('Setup error:', error)
      let errorMessage = 'Failed to complete setup: '
      const code = error.code || ''
      if (code === 'auth/weak-password') errorMessage = 'Password is too weak. Please use a stronger password.'
      else if (code === 'auth/requires-recent-login'){
        errorMessage = 'Please log in again before setting a password.'
        try{ const app = initFirebase(); const auth = getAuth(app); await signOut(auth) } catch(e){ console.warn('Sign out error:', e) }
        setTimeout(()=> window.location.href = '/login', 2000)
      } else if (code === 'auth/operation-not-allowed') errorMessage = 'Password sign-in is not enabled. Please contact support.'
      else errorMessage += error.message || String(error)

      alert(errorMessage)
      if (submitButtonState){ submitButtonState.disabled = false; submitButtonState.textContent = 'COMPLETE SETUP' }
    }
  }

  const handleCancelSetup = async () => {
    try {
      const app = initFirebase()
      const auth = getAuth(app)
      const db = getFirestore(app)
      const user = auth.currentUser
      if (user) {
        // Remove stub user doc so no trace is left
        try { await deleteDoc(doc(db, 'users', user.uid)) } catch (e) { console.warn('Could not delete user doc:', e) }
        // Delete the Firebase Auth account itself
        try { await user.delete() } catch (e) { console.warn('Could not delete auth account:', e) }
        // Sign out regardless
        try { await signOut(auth) } catch (e) {}
      }
    } catch (e) { console.warn('Cancel setup error:', e) }
    // Replace history entry so back-button won't return to /setup
    window.location.replace('/login')
  }

  if (loading) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh'}}>Loading...</div>

  return (
    <div className="login-page login-body">
      <Toast
        message={toast.message}
        show={toast.show}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
        duration={3000}
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
            <path 
                d="M19 6h-3.5l-1-1h-5l-1 1H5v2h14V6z" 
                fill="url(#logoGradient)" 
            />
            <path 
                d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V9H6v10z" 
                fill="url(#logoGradient)" 
            />
            <rect x="9" y="11" width="2" height="6" fill="white" rx="1" />
            <rect x="13" y="11" width="2" height="6" fill="white" rx="1" />
            </svg>
        </div>
        <div className="app-name">SMART</div>
        <div className="app-name2">DUSTBIN</div>
        <p className="welcome" style={{marginTop:'10px'}}>Complete Your Profile</p>
        <p className="enter-message">Set up your password and personal details.</p>

        <form id="google-setup-form" onSubmit={handleSubmit}>
            <input
                id="firstName"
                value={firstName}
                onChange={e => {
                    const val = e.target.value
                    if (/^[a-zA-Z\s]*$/.test(val)) setFirstName(val)
                }}
                placeholder="FIRST NAME"
                className="input-field"
                style={{animationDelay: '0.6s'}}
                required
            />
            <input
                id="lastName"
                value={lastName}
                onChange={e => {
                    const val = e.target.value
                    if (/^[a-zA-Z\s]*$/.test(val)) setLastName(val)
                }}
                placeholder="LAST NAME"
                className="input-field"
                style={{animationDelay: '0.7s'}}
                required
            />

            <div className="password-container">
                <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    className="input-field"
                    placeholder="PASSWORD"
                    required
                    value={password}
                    style={{animationDelay: '0.7s'}}
                    onChange={e => setPassword(e.target.value)}
                />
                <span id="togglePassword" className="toggle-eye" onClick={() => setShowPassword(!showPassword)}>
                    <i className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} id="eyeIcon"></i>
                </span>
            </div>

            <div className="password-container">
                <input
                    type={showConfirm ? "text" : "password"}
                    id="confirmPassword"
                    className={`input-field ${confirmError ? 'error' : ''}`}
                    placeholder="CONFIRM PASSWORD"
                    required
                    value={confirmPassword}
                    style={{animationDelay: '0.8s', borderColor: confirmError ? '#ff4d4d' : ''}}
                    onChange={e => {
                        setConfirmPassword(e.target.value)
                        setConfirmError(false)
                    }}
                />
                 <span id="toggleConfirm" className="toggle-eye" onClick={() => setShowConfirm(!showConfirm)}>
                    <i className={`fa ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`} id="eyeIcon"></i>
                </span>
            </div>
            
            {confirmError && (
                <div style={{color: '#ff4d4d', fontSize: '12px', marginTop: '-5px', marginBottom: '15px', marginLeft: '5px', textAlign: 'left', fontWeight: 500}}>
                    Those passwords didn’t match. Try again.
                </div>
            )}
            
            <button id="submit" type="submit" className="login-btn" style={{animationDelay: '0.9s'}}>COMPLETE SETUP</button>
        </form>

            <button
              type="button"
              onClick={handleCancelSetup}
              className="forgot-link"
              style={{
                display: 'block',
                textAlign: 'center',
                marginTop: '10px',
                marginBottom: '15px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                width: 'fit-content',
                marginLeft: 'auto',
                marginRight: 'auto',
                animation: 'slideInUp 0.6s ease-out 1s both',
              }}
            >
              <u>Cancel Setup</u>
            </button>

        </div>
      </div>
    </div>
  )
}
