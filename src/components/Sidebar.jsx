import { useEffect, useRef, useState } from 'react'
import { initSidebar } from '../utils/sidebarHelpers'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
import initFirebase from '../firebaseConfig'

export default function Sidebar() {
  const rootRef = useRef(null)
  const [role, setRole] = useState(() => {
    try { return localStorage.getItem('sb_role') || 'loading' } catch (e) { return 'loading' }
  })
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sb:sidebar-collapsed') === 'true' } catch (e) { return false }
  })

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

