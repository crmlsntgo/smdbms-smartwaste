import initFirebase from '../firebaseConfig'
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'
import { getFirestore, doc, getDoc } from 'firebase/firestore'

import * as presenceModule from './presence'

let _app = null
let _auth = null
let _db = null
let _presenceHandle = null

export function getApp() {
  if (!_app) _app = initFirebase()
  return _app
}

export async function fetchUserProfile(uid) {
  if (!uid) return null
  const app = getApp()
  try {
    const db = getFirestore(app)
    const userDoc = await getDoc(doc(db, 'users', uid))
    if (userDoc && userDoc.exists()) return userDoc.data()
  } catch (e) {
    console.warn('fetchUserProfile failed', e)
  }
  return null
}

export function startAuthListeners({ onUser } = {}) {
  const app = getApp()
  _auth = getAuth(app)
  _db = getFirestore(app)

  const unsubscribe = onAuthStateChanged(_auth, async (user) => {
    if (user) {
      // try to get role
      let userRole = null
      try {
        const userDoc = await getDoc(doc(_db, 'users', user.uid))
        if (userDoc.exists()) userRole = userDoc.data().role
        try { localStorage.setItem('sb_role', userRole || 'user') } catch (e) {}
      } catch (e) {
        console.warn('authManager: failed to fetch user role', e)
      }

      if (userRole === 'admin') {
        try {
          _presenceHandle = await presenceModule.initPresence(app, user, { useRealtime: true })
        } catch (e) {
          console.warn('authManager: presence init failed', e)
        }
      }

      const u = {
        uid: user.uid,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        email: user.email || ''
      }
      try { window.SBUser = u } catch (e) {}
      try { window.dispatchEvent(new CustomEvent('sb:set-user', { detail: u })) } catch (e) {}
      if (typeof onUser === 'function') onUser(u)
    } else {
      try { window.SBUser = null } catch (e) {}
      try { window.dispatchEvent(new CustomEvent('sb:set-user', { detail: {} })) } catch (e) {}
      try { localStorage.removeItem('sb_role') } catch (e) {}
      if (typeof onUser === 'function') onUser(null)
    }
  })

  return () => {
    if (typeof unsubscribe === 'function') unsubscribe()
    // teardown presence if any
    if (_presenceHandle) {
      try { presenceModule.tearDownPresence(app, _auth.currentUser, _presenceHandle) } catch (e) {}
      _presenceHandle = null
    }
  }
}

export async function performLogout() {
  try {
    if (_presenceHandle) {
      try { await presenceModule.tearDownPresence(getApp(), _auth.currentUser, _presenceHandle) } catch (e) {}
      _presenceHandle = null
    }
  } catch (e) {}

  try {
    const auth = getAuth(getApp())
    await signOut(auth)
  } catch (e) {
    console.warn('performLogout failed:', e)
  }

  try { localStorage.removeItem('sb_role') } catch (e) {}

  // best-effort redirect to legacy login page
  try { window.location.href = 'auth/login.html' } catch (e) {}
}
