import { useEffect, useState } from 'react'
import initFirebase from '../firebaseConfig'
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
} from 'firebase/firestore'

export default function GoogleSetup(){
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

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
              const data = uSnap.data()
              if (data.firstName && data.lastName && data.firstName.trim() !== '' && data.lastName.trim() !== ''){
                window.location.href = '/'
                return
              }
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!currentUser) { alert('You are not signed in. Please log in again.'); window.location.href = '/login'; return }
    if (!firstName.trim()){ alert('Please enter your first name.'); return }
    if (!lastName.trim()){ alert('Please enter your last name.'); return }
    if (!password){ alert('Please enter a password.'); return }
    if (password.length < 6){ alert('Password must be at least 6 characters long.'); return }
    if (password !== confirmPassword){ alert('Passwords do not match. Please try again.'); return }

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
      })

      await ensureUsernameMapping(db, currentUser.uid)

      alert('Profile setup complete! Redirecting to dashboard...')
      window.location.href = '/'
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

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form id="google-setup-form" onSubmit={handleSubmit} className="w-full max-w-md bg-white p-6 rounded shadow">
        <h2 className="text-2xl mb-4">Complete Your Profile</h2>
        <div className="flex gap-3">
          <input id="firstName" value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="FIRST NAME" className="flex-1 p-2 border rounded" />
          <input id="lastName" value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="LAST NAME" className="flex-1 p-2 border rounded" />
        </div>
        <div className="mt-3 relative">
          <input id="password" type={showPassword? 'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="PASSWORD" className="w-full p-2 border rounded" />
          <button type="button" onClick={()=>setShowPassword(s=>!s)} className="absolute right-2 top-1/2 -translate-y-1/2">{showPassword? 'Hide':'Show'}</button>
        </div>
        <div className="mt-3 relative">
          <input id="confirmPassword" type={showConfirm? 'text':'password'} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="CONFIRM PASSWORD" className="w-full p-2 border rounded" />
          <button type="button" onClick={()=>setShowConfirm(s=>!s)} className="absolute right-2 top-1/2 -translate-y-1/2">{showConfirm? 'Hide':'Show'}</button>
        </div>
        <button id="submit" type="submit" className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded">COMPLETE SETUP</button>
      </form>
    </div>
  )
}
