import { useEffect, useRef, useState } from 'react'
import { initSidebar } from '../utils/sidebarHelpers'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
import initFirebase from '../firebaseConfig'

export default function Sidebar() {
  const rootRef = useRef(null)
  const AUTO_COLLAPSE_WIDTH = 1200 // match CSS responsive breakpoint

  const [role, setRole] = useState(() => {
    try { return localStorage.getItem('sb_role') || 'loading' } catch (e) { return 'loading' }
  })

  // Initialize collapsed from saved preference but auto-collapse for small screens
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('sb:sidebar-collapsed') === 'true'
      if (typeof window !== 'undefined' && window.innerWidth < AUTO_COLLAPSE_WIDTH) return true
      return saved
    } catch (e) { return false }
  })

  // Keep a ref for the user's saved preference so responsive toggle can restore it
  const userPrefRef = useRef((() => {
    try { return localStorage.getItem('sb:sidebar-collapsed') === 'true' } catch (e) { return false }
  })())

  // Track whether the current collapsed state is due to an automatic responsive change
  const autoCollapsedRef = useRef(false)
  // Keep original saved preference while we temporarily override it for small screens
  const originalSavedPrefRef = useRef(null)

  useEffect(() => {
    if (rootRef.current) initSidebar(rootRef.current)

    // Resolve user role via auth state observer to avoid initial-null fallback
    const app = initFirebase()
    const auth = getAuth(app)
    const db = getFirestore(app)

    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        getDoc(doc(db, 'users', user.uid)).then(snap => {
          const resolved = (snap.exists() && snap.data().role === 'admin') ? 'admin' : 'user'
          setRole(resolved)
          try { localStorage.setItem('sb_role', resolved) } catch (e) {}
        }).catch(() => {
          setRole('user')
          try { localStorage.setItem('sb_role', 'user') } catch (e) {}
        })
      } else {
        setRole(null)
        try { localStorage.removeItem('sb_role') } catch (e) {}
      }
    })

    return () => unsub()
  }, [])

  // Responsive auto-collapse: collapse when window < AUTO_COLLAPSE_WIDTH
  useEffect(() => {
    // keep user preference ref up-to-date
    try { userPrefRef.current = localStorage.getItem('sb:sidebar-collapsed') === 'true' } catch (e) { userPrefRef.current = false }

    const apply = () => {
      const shouldAuto = typeof window !== 'undefined' && window.innerWidth < AUTO_COLLAPSE_WIDTH

      if (shouldAuto) {
        // capture original saved preference once so we can restore it later
        if (originalSavedPrefRef.current === null) {
          try { originalSavedPrefRef.current = localStorage.getItem('sb:sidebar-collapsed') === 'true' } catch (e) { originalSavedPrefRef.current = false }
        }

        if (!collapsed) {
          autoCollapsedRef.current = true
          setCollapsed(true)
          // persist the auto-collapse so reload keeps it minimized
          try { localStorage.setItem('sb:sidebar-collapsed', 'true') } catch (e) {}
          try { window.dispatchEvent(new CustomEvent('sb:sidebar-changed', { detail: { collapsed: true } })) } catch (err) {}
        }
      } else {
        // leaving auto mode: restore user's original saved preference (if we captured it)
        if (autoCollapsedRef.current && originalSavedPrefRef.current !== null) {
          const restoreVal = originalSavedPrefRef.current
          try { localStorage.setItem('sb:sidebar-collapsed', restoreVal ? 'true' : 'false') } catch (e) {}
          autoCollapsedRef.current = false
          originalSavedPrefRef.current = null
          if (collapsed !== restoreVal) {
            setCollapsed(restoreVal)
            try { window.dispatchEvent(new CustomEvent('sb:sidebar-changed', { detail: { collapsed: restoreVal } })) } catch (err) {}
          }
        } else {
          // fallback: read saved preference and apply
          const saved = (() => { try { return localStorage.getItem('sb:sidebar-collapsed') === 'true' } catch (e) { return false } })()
          if (collapsed !== saved) {
            setCollapsed(saved)
            try { window.dispatchEvent(new CustomEvent('sb:sidebar-changed', { detail: { collapsed: saved } })) } catch (err) {}
          }
        }
      }
    }

    // initial apply
    apply()
    // resize listener
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [collapsed])

  useEffect(() => {
    const handler = (e) => {
      try { setCollapsed(!!(e && e.detail && e.detail.collapsed)) } catch (err) {}
    }
    window.addEventListener('sb:sidebar-changed', handler)
    return () => window.removeEventListener('sb:sidebar-changed', handler)
  }, [])

  return (
    <aside ref={rootRef} className={"sidebar" + (collapsed ? ' collapsed' : '')} data-app-sidebar>
      <nav className="sidebar-nav">
       {(() => {
      const base = role === 'admin' ? '/admin' : ''
      return (
        <a href={`${base}/dashboard`} className="nav-item" data-page="dashboard">
          <i className="fas fa-home"></i> <span>Home</span>
        </a>
      )
       })()}
       {role === 'admin' && (
         <a href="/admin/users" className="nav-item" data-page="users">
         <i className="fas fa-users"></i> <span>Users</span>
         </a>
       )}
       {role !== 'admin' && (
         <a href="/profile" className="nav-item" data-page="profile">
         <i className="fas fa-user"></i> <span>Profile</span>
         </a>
       )}

        {(() => {
          const base = role === 'admin' ? '/admin' : ''
          return (
            <a href={`${base}/archive`} className="nav-item" data-page="archive">
              <i className="fas fa-archive"></i> <span>Archive</span>
            </a>
          )
        })()}
        {(() => {
          const base = role === 'admin' ? '/admin' : ''
          return (
            <a href={`${base}/customize`} className="nav-item" data-page="customize">
              <i className="fas fa-paint-roller"></i> <span>Customize</span>
            </a>
          )
        })()}
      </nav>
    </aside>
  )
}

