import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuth, signOut } from 'firebase/auth'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
import initFirebase from '../firebaseConfig'
import GlobalSearch from './GlobalSearch'
import '../styles/vendor/header.css'

export default function Header() {
  const [user, setUser] = useState(null)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [initials, setInitials] = useState('U')
  
  const profileRef = useRef(null)
  const notifRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const app = initFirebase()
    const auth = getAuth(app)
    const db = getFirestore(app)
    
    // Auth Listener
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        // Fetch additional data if needed (role, specific names)
        // Using basic auth profile for speed, can enhance with doc fetch if needed
        let displayName = currentUser.displayName
        let userInitials = 'U'

        if (!displayName) {
             try {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
                if (userDoc.exists()) {
                    const data = userDoc.data()
                    displayName = data.firstName ? `${data.firstName} ${data.lastName}`.trim() : ''
                }
             } catch(e) { console.warn(e) }
        }

        if (displayName) {
             userInitials = displayName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()
        } else if (currentUser.email) {
             userInitials = currentUser.email[0].toUpperCase()
        }

        setUser({ ...currentUser, displayName, initials: userInitials })
        setInitials(userInitials)
      } else {
        setUser(null)
      }
    })

    // Click Outside Listener
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileMenu(false)
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      unsubscribe()
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLogout = async () => {
    try {
      const auth = getAuth()
      await signOut(auth)
      window.location.href = '/login'
    } catch (error) {
      console.error("Logout failed", error)
    }
  }

  return (
    <>
    <header className="sb-header">
      <div className="sb-header__left">
        <div className="sb-logo">
          <div className="sb-logo__icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="8" width="14" height="11" rx="2" ry="2" fill="none" stroke="white" strokeWidth="1.6" />
              <path d="M8 8V6.5C8 5.7 8.7 5 9.5 5H14.5C15.3 5 16 5.7 16 6.5V8" fill="none" stroke="white" strokeWidth="1.6" />
              <line x1="10" y1="10" x2="10" y2="17" stroke="white" strokeWidth="1.6" />
              <line x1="14" y1="10" x2="14" y2="17" stroke="white" strokeWidth="1.6" />
            </svg>
          </div>
          <div className="sb-logo__text">
            <span className="sb-logo__title">SMART</span>
            <span className="sb-logo__subtitle">DUSTBIN</span>
          </div>
        </div>
      </div>

      <div className="sb-header__right">
        <GlobalSearch />

        <div className="sb-notification-wrapper" ref={notifRef}>
          <button 
            type="button" 
            id="sb-notification-button" 
            className="sb-icon-button sb-icon-button--notification" 
            aria-label="Notifications"
            aria-haspopup="true"
            aria-expanded={showNotifications}
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <span className="sb-icon-button__inner">
              <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3C9.8 3 8 4.8 8 7V8.2C8 8.7 7.8 9.2 7.5 9.6L6.4 11.1C6.1 11.5 6 11.9 6 12.3V16H18V12.3C18 11.9 17.9 11.5 17.6 11.1L16.5 9.6C16.2 9.2 16 8.7 16 8.2V7C16 4.8 14.2 3 12 3Z" fill="none" stroke="#027A5E" strokeWidth="1.6" />
                <path d="M10 17C10.3 18.2 11.1 19 12 19C12.9 19 13.7 18.2 14 17" fill="none" stroke="#027A5E" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span className="sb-notification-dot" />
            </span>
          </button>

          <div className="sb-notification-dropdown" id="sb-notification-dropdown" hidden={!showNotifications}>
            <div className="sb-notification-dropdown__header">
                <h3 className="sb-notification-dropdown__header-title">Notifications</h3>
            </div>
            <div className="sb-notification-dropdown__body">
                <div className="sb-notification-item">
                    <div className="sb-notification-item__icon">⚠</div>
                    <div className="sb-notification-item__content">
                        <div className="sb-notification-item__title">Bin2: Full</div>
                        <div className="sb-notification-item__meta">5 min ago</div>
                    </div>
                </div>
                <div className="sb-notification-item">
                    <div className="sb-notification-item__icon">⚠</div>
                    <div className="sb-notification-item__content">
                        <div className="sb-notification-item__title">Bin4: Full</div>
                        <div className="sb-notification-item__meta">5 hours ago</div>
                    </div>
                </div>
                <div className="sb-notification-item">
                    <div className="sb-notification-item__icon">⚠</div>
                    <div className="sb-notification-item__content">
                        <div className="sb-notification-item__title">Your restoration request is denied.</div>
                        <div className="sb-notification-item__meta">1 hour ago</div>
                    </div>
                </div>
            </div>
          </div>
        </div>

        <div className="sb-profile-wrapper" ref={profileRef}>
             <button
                type="button"
                id="sb-profile-button"
                className="sb-icon-button sb-profile-button"
                aria-haspopup="true"
                aria-expanded={showProfileMenu}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
                <span className="sb-icon-button__inner sb-profile-avatar" aria-hidden="true">
                    {user?.photoURL ? <img src={user.photoURL} alt="User" style={{width:'100%', height:'100%', borderRadius:'50%'}} /> : initials}
                </span>
            </button>

            <div className="sb-profile-menu" id="sb-profile-dropdown" hidden={!showProfileMenu}>
                <button 
                  type="button" 
                  className="sb-profile-menu__item" 
                  data-sb-menu-item="settings"
                  onClick={() => { setShowProfileMenu(false); navigate('/settings') }}
                >
                    Settings
                </button>

                <button 
                  type="button" 
                  className="sb-profile-menu__item sb-profile-menu__item--danger" 
                  data-sb-menu-item="logout"
                  onClick={() => { setShowProfileMenu(false); setShowLogoutModal(true); }}
                >
                    Logout
                </button>
            </div>
        </div>
      </div>
    </header>

     {/* Logout Modal */}
    <div className={`modal-overlay ${showLogoutModal ? 'active' : ''}`} id="logout-modal-overlay">
        <div className="modal-dialog">
            <div className="modal-icon modal-icon--logout">
                <i className="fas fa-sign-out-alt"></i>
            </div>
            <h2 className="modal-title">Are you sure you want to logout?</h2>
            <p className="modal-subtitle">We wont bother you anymore.</p>
            <div className="modal-actions">
                <button className="modal-btn modal-btn--confirm" id="modal-logout-confirm" onClick={handleLogout}>Confirm</button>
                <button className="modal-btn modal-btn--cancel" id="modal-logout-cancel" onClick={() => setShowLogoutModal(false)}>Cancel</button>
            </div>
        </div>
    </div>
    </>
  )
}
