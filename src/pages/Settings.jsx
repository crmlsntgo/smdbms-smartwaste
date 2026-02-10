import React, { useState, useEffect } from 'react'
import { getAuth, updateProfile, signOut, reauthenticateWithCredential, updatePassword, EmailAuthProvider, sendPasswordResetEmail } from 'firebase/auth'
import { getFirestore, doc, getDoc, updateDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import initFirebase from '../firebaseConfig'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import '../styles/vendor/dashboard-style.css'

// Header CSS is loaded by `Header.jsx`; load settings CSS dynamically so
// it takes precedence over unrelated page CSS that might still be present.

export default function Settings() {
  const [activeTab, setActiveTab] = useState('appearance')
  const [theme, setTheme] = useState('light')
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    address: '',
    phone: '',
    role: '',
    city: ''
  })
  const [originalData, setOriginalData] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState(null)
  
  // Archive Modal State
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiveChecked, setArchiveChecked] = useState(false)

  // Password Modal State
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passForm, setPassForm] = useState({ old: '', new: '', confirm: '' })
  const [passVis, setPassVis] = useState({ old: false, new: false, confirm: false })

  useEffect(() => {
    import('../styles/vendor/settings.css').catch(err => console.error('Failed to load settings CSS', err))

    const savedTheme = localStorage.getItem('sb-theme') || 'light'
    setTheme(savedTheme)

    const app = initFirebase()
    const auth = getAuth(app)
    const db = getFirestore(app)
    
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                const docRef = doc(db, 'users', user.uid)
                const docSnap = await getDoc(docRef)
                const data = docSnap.exists() ? docSnap.data() : {}
                
                const initialData = {
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    email: user.email || '',
                    username: data.username || user.email?.split('@')[0] || '',
                    address: data.address || '',
                    phone: data.phone || '',
                    role: data.role || 'User',
                    city: data.city || ''
                }
                setFormData(initialData)
                setOriginalData(initialData)
            } catch (err) {
                console.error("Error fetching settings:", err)
            } finally {
                setLoading(false)
            }
        } else {
            window.location.href = '/login'
        }
    })

    return () => unsubscribe()
  }, [])

  const handleInputChange = (e) => {
    const { id, value } = e.target
    if (id === 'settings-first-name') setFormData(prev => ({ ...prev, firstName: value }))
    else if (id === 'settings-last-name') setFormData(prev => ({ ...prev, lastName: value }))
    else if (id === 'settings-phone') setFormData(prev => ({ ...prev, phone: value }))
    else if (id === 'settings-address') setFormData(prev => ({ ...prev, address: value }))
  }

  const handleCityChange = (e) => {
      setFormData(prev => ({ ...prev, city: e.target.value }))
  }

  const handleThemeChange = (e) => {
      const newTheme = e.target.value
      setTheme(newTheme)
      localStorage.setItem('sb-theme', newTheme)
      if (newTheme === 'dark') {
          document.documentElement.classList.add('dark')
      } else {
          document.documentElement.classList.remove('dark')
      }
  }

  const handleSave = async () => {
      setSaving(true)
      setNotification(null)
      try {
          const app = initFirebase()
          const auth = getAuth(app)
          const db = getFirestore(app)
          const user = auth.currentUser

          if (!user) throw new Error("No user logged in")

          const updates = {
              firstName: formData.firstName,
              lastName: formData.lastName,
              address: formData.address,
              phone: formData.phone,
              city: formData.city
          }

          await updateDoc(doc(db, 'users', user.uid), updates)
          
          if (formData.firstName !== originalData.firstName || formData.lastName !== originalData.lastName) {
              await updateProfile(user, {
                  displayName: `${formData.firstName} ${formData.lastName}`.trim()
              })
          }
          
          setOriginalData(formData)
          setNotification({ type: 'success', message: 'Profile updated successfully.' })
          setTimeout(() => setNotification(null), 3000)

      } catch (error) {
          console.error("Error saving settings:", error)
          setNotification({ type: 'error', message: 'Failed to update profile.' })
      } finally {
          setSaving(false)
      }
  }

  const handleCancel = () => {
      setFormData(originalData)
      setNotification({ type: 'info', message: 'Changes discarded.' })
      setTimeout(() => setNotification(null), 3000)
  }

  // --- Password Logic ---
  const handlePassChange = (e) => {
      const { name, value } = e.target
      setPassForm(prev => ({ ...prev, [name]: value }))
  }

  const togglePassVis = (field) => {
      setPassVis(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const handleChangePassword = async () => {
      const { old, new: newPass, confirm } = passForm
      if (!old || !newPass || !confirm) {
          alert("Please fill all password fields")
          return
      }
      if (newPass.length < 8) {
          alert("New password must be at least 8 characters")
          return
      }
      if (newPass !== confirm) {
           alert("New passwords do not match")
           return
      }

      setSaving(true)
      try {
          const app = initFirebase()
          const auth = getAuth(app)
          const db = getFirestore(app)
          const user = auth.currentUser

          if (!user) return

          // 1. Re-authenticate
          const credential = EmailAuthProvider.credential(user.email, old)
          await reauthenticateWithCredential(user, credential)

          // 2. Update Password
          await updatePassword(user, newPass)

          // 3. Update Last Changed Timestamp in Firestore
          await updateDoc(doc(db, 'users', user.uid), {
             lastPasswordChange: serverTimestamp()
          })

          setNotification({ type: 'success', message: 'Password changed successfully.' })
          setTimeout(() => setNotification(null), 3000)
          setShowPasswordModal(false)
          setPassForm({ old: '', new: '', confirm: '' })

      } catch (error) {
          console.error("Password change failed:", error)
          let msg = "Failed to change password."
          if (error.code === 'auth/wrong-password') msg = "Incorrect old password."
          if (error.code === 'auth/weak-password') msg = "Password is too weak."
          alert(msg)
      } finally {
          setSaving(false)
      }
  }
  
  const handleForgotPassword = async () => {
       const email = formData.email
       if (!email) return
       try {
           const app = initFirebase()
           const auth = getAuth(app)
           await sendPasswordResetEmail(auth, email)
           alert(`Password reset link sent to ${email}`)
       } catch (e) {
           console.error(e)
           alert("Failed to send reset email")
       }
  }

  const handleArchiveConfirm = async () => {
      if (!archiveChecked) return

      try {
          const app = initFirebase()
          const auth = getAuth(app)
          const db = getFirestore(app)
          const user = auth.currentUser

          if (!user) return

          // 1. Store in account_archive
          await setDoc(doc(db, 'account_archive', user.uid), {
             ...formData,
             role: originalData.role || 'User',
             uid: user.uid,
             archivedAt: serverTimestamp(),
             archivedEmail: user.email
          })

          // 2. Delete from users collection
          await deleteDoc(doc(db, 'users', user.uid))

          // 3. Sign out and delete Auth user (optional: if you want to completely block login)
          // If we just want to block app access but keep auth user, deleting doc 'users' is enough
          // because Login.jsx checks for userDoc existence.
          // However, if we want them to "can't log in again", deleting user from Auth is best if possible.
          // But deleting auth user requires sensitive operation re-authentication sometimes.
          // Given the prompt: "can't open/use it anymore... can't log in again", deleting document prevents app usage.
          // And usually invalidates the session logic if we add a check on login.
          // Login.jsx at line 42 redirects to dashboard if doc doesn't exist?
          // Wait, Login.jsx: "else { window.location.href = '/dashboard' }"
          // This means if user doc MISSING, it still lets them in! That's a security hole if we rely on doc deletion.
          
          // Let's check Login.jsx again.
          // Line 39: if (userDoc.exists()) { ... } else { window.location.href = '/dashboard' }
          // This means MISSING doc = Allow login as default user?
          // We must FIX Login.jsx to prevent login if archived/missing.
          
          await signOut(auth)
          window.location.href = '/login'

      } catch (error) {
          console.error("Archive failed:", error)
          setNotification({ type: 'error', message: 'Failed to archive account.' })
          setShowArchiveModal(false)
      }
  }

  if (loading) {
      return (
          <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#f4f7f6'}}>
              Loading...
          </div>
      )
  }

  return (
    <div className="settings-page">
      <Header />
      <div className="dashboard-wrapper">
        <Sidebar />
        <main className="main-content">
          <div className="dashboard-content">
            <div className="welcome-section">
              <h2>Settings</h2>
            </div>
            
            {notification && (
                <div style={{
                    position: 'fixed',
                    top: '80px',
                    right: '20px',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    background: notification.type === 'success' ? '#d1fae5' : (notification.type === 'error' ? '#fee2e2' : '#e0f2fe'),
                    color: notification.type === 'success' ? '#065f46' : (notification.type === 'error' ? '#991b1b' : '#075985'),
                    border: `1px solid ${notification.type === 'success' ? '#34d399' : (notification.type === 'error' ? '#f87171' : '#38bdf8')}`,
                    zIndex: 1000,
                    fontWeight: 500,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                    {notification.message}
                </div>
            )}

            <div className="settings-layout">
              <aside className="sb-settings-aside">
                <div className="sb-settings-card">
                  <nav className="sb-settings-nav">
                    <button 
                        className={`sb-settings-nav__item ${activeTab === 'appearance' ? 'sb-settings-nav__item--active' : ''}`} 
                        onClick={() => setActiveTab('appearance')}
                    >
                      Appearance
                    </button>
                    <button 
                        className={`sb-settings-nav__item ${activeTab === 'personal' ? 'sb-settings-nav__item--active' : ''}`} 
                        onClick={() => setActiveTab('personal')}
                    >
                      Personal Details
                    </button>
                  </nav>
                </div>
              </aside>

              <div className="sb-settings-main">
                <div className="sb-settings-panels">
                  
                  {/* Appearance Panel */}
                  <div className="sb-settings-panel" style={{display: activeTab === 'appearance' ? 'block' : 'none'}}>
                    <div className="sb-card sb-appearance-card">
                      <h2 className="sb-card-title">Theme</h2>
                      <div className="sb-appearance-options">
                        <label className="sb-appearance-option">
                          <input type="radio" name="theme" value="light" checked={theme === 'light'} onChange={handleThemeChange} />
                          <span className="sb-appearance-label">Light Mode</span>
                        </label>
                        <label className="sb-appearance-option">
                          <input type="radio" name="theme" value="dark" checked={theme === 'dark'} onChange={handleThemeChange} />
                          <span className="sb-appearance-label">Dark Mode</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Personal Details Panel */}
                  <div className="sb-settings-panel" style={{display: activeTab === 'personal' ? 'block' : 'none'}}>
                    <div className="sb-settings-panel-content">
                      
                      <div className="sb-card sb-personal-card">
                        <h3 className="sb-card-title">Personal Information</h3>
                        <div className="sb-form-grid">
                          <div className="form-field">
                            <label>First Name</label>
                            <input type="text" id="settings-first-name" placeholder="First name" value={formData.firstName} onChange={handleInputChange} />
                          </div>
                          <div className="form-field">
                            <label>Last Name</label>
                            <input type="text" id="settings-last-name" placeholder="Last name" value={formData.lastName} onChange={handleInputChange} />
                          </div>
                          <div className="form-field">
                            <label>Email</label>
                            <input type="email" id="settings-email" value={formData.email} readOnly style={{background: '#f9fafb', cursor: 'not-allowed'}} />
                          </div>
                          <div className="form-field">
                            <label>Username</label>
                            <input type="text" id="settings-username" value={formData.username} readOnly style={{background: '#f9fafb', cursor: 'not-allowed'}} />
                          </div>
                          <div className="form-field">
                            <label>Address</label>
                            <input type="text" id="settings-address" placeholder="Address" value={formData.address} onChange={handleInputChange} />
                          </div>
                          <div className="form-field">
                            <label>Contact Number</label>
                            <input type="text" id="settings-phone" placeholder="Phone number" value={formData.phone} onChange={handleInputChange} />
                          </div>
                          <div className="form-field">
                            <label>Role</label>
                            <input type="text" id="settings-role" value={formData.role} readOnly style={{background: '#f9fafb', cursor: 'not-allowed'}} />
                          </div>
                          <div className="form-field">
                            <label>City</label>
                            <select id="settings-city" value={formData.city} onChange={handleCityChange}>
                              <option value="">Select a city</option>
                              <option value="Caloocan City">Caloocan City</option>
                              <option value="Manila">Manila</option>
                              <option value="Quezon City">Quezon City</option>
                              <option value="Makati">Makati</option>
                              <option value="Cebu City">Cebu City</option>
                              <option value="Davao City">Davao City</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="sb-card sb-account-settings-card">
                        <h3 className="sb-card-title">Account Settings</h3>
                        <div className="sb-settings-item">
                          <div className="sb-settings-item-header">
                            <div>
                              <p className="sb-settings-item-title">Password</p>
                              <p className="sb-settings-item-desc">Last changed {originalData.lastPasswordChange ? new Date(originalData.lastPasswordChange.toDate()).toLocaleDateString() : 'a while ago'}</p>
                            </div>
                            <button className="btn-secondary" onClick={() => setShowPasswordModal(true)}>Change Password</button>
                          </div>
                        </div>
                        <div className="sb-settings-item">
                          <div className="sb-settings-item-header">
                            <div>
                              <p className="sb-settings-item-title">Archive Account</p>
                              <p className="sb-settings-item-desc">Archive your account and all data</p>
                            </div>
                            <button className="btn-archive" onClick={() => { setArchiveChecked(false); setShowArchiveModal(true); }}>Archive</button>
                          </div>
                        </div>
                      </div>

                      {/* ACTIONS MOVED HERE - OUTSIDE THE SB-CARD DIVS */}
                      <div className="sb-form-actions">
                        <button className="btn-cancel" onClick={handleCancel} disabled={saving}>
                          Cancel
                        </button>
                        <button className="btn-primary" onClick={handleSave} disabled={saving}>
                          {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Archive Modal */}
      <div className={`modal-overlay ${showArchiveModal ? 'active' : ''}`} style={{zIndex: 2000}}>
          <div className="modal-dialog">
              <div className="modal-icon modal-icon--delete">
                  <i className="fas fa-trash-alt"></i>
              </div>
              <h2 className="modal-title">Archive Account</h2>
              <p className="modal-subtitle" style={{marginBottom: '20px'}}>
                  Are you sure you want to archive your account linked to <span style={{fontWeight: 600, color: '#111827'}}>{formData.email}</span>?
              </p>
              
              <div style={{display: 'flex', alignItems: 'flex-start', gap: '10px', textAlign: 'left', background: '#f9fafb', padding: '12px', borderRadius: '8px', marginBottom: '24px'}}>
                  <input 
                      type="checkbox" 
                      id="confirm-archive" 
                      checked={archiveChecked} 
                      onChange={(e) => setArchiveChecked(e.target.checked)}
                      style={{marginTop: '4px', cursor: 'pointer'}}
                  />
                  <label htmlFor="confirm-archive" style={{fontSize: '13px', color: '#4b5563', cursor: 'pointer', lineHeight: '1.4'}}>
                      I understand that I won't be able to recover my account.
                  </label>
              </div>

              <div className="modal-actions">
                  <button 
                      className="modal-btn" 
                      style={{
                          background: archiveChecked ? '#fee2e2' : '#f3f4f6', 
                          color: archiveChecked ? '#dc2626' : '#9ca3af',
                          cursor: archiveChecked ? 'pointer' : 'not-allowed',
                          fontWeight: 600
                      }}
                      onClick={handleArchiveConfirm}
                      disabled={!archiveChecked}
                  >
                      Archive
                  </button>
                  <button 
                      className="modal-btn modal-btn--cancel" 
                      onClick={() => setShowArchiveModal(false)}
                      style={{
                          background: 'white',
                          border: '1px solid #d1d5db',
                          color: '#374151'
                      }}
                  >
                      Cancel
                  </button>
              </div>
          </div>
      </div>

     {/* Change Password Modal */}
     <div 
        className={`modal-overlay ${showPasswordModal ? 'active' : ''}`} 
        style={{zIndex: 2005}}
        onClick={(e) => {
            if(e.target === e.currentTarget) setShowPasswordModal(false)
        }}
     >
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
              <div className="modal-icon" style={{background: '#a7f3d0', color: '#047857'}}>
                  <i className="fas fa-lock"></i>
              </div>
              <h2 className="modal-title">Change your password</h2>
              <p className="modal-subtitle" style={{marginBottom: '20px'}}>
                  To change your password, please fill in the fields below. Your password must contain at least 8 characters.
              </p>
              
              <div className="sb-form-grid" style={{gridTemplateColumns: '1fr', gap: '15px', textAlign: 'left', marginBottom: '20px', width: '100%'}}>
                   <div className="form-field">
                      <label style={{fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px', display:'block'}}>OLD PASSWORD</label>
                      <div style={{position: 'relative'}}>
                        <input 
                            type={passVis.old ? "text" : "password"} 
                            name="old"
                            value={passForm.old}
                            onChange={handlePassChange}
                            style={{width: '100%', padding: '10px 35px 10px 12px', borderRadius: '6px', border: '1px solid #d1d5db'}}
                        />
                        <i 
                            className={`fas ${passVis.old ? 'fa-eye-slash' : 'fa-eye'}`}
                            onClick={() => togglePassVis('old')}
                            style={{position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#9ca3af'}}
                        ></i>
                      </div>
                  </div>
                  <div className="form-field">
                      <label style={{fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px', display:'block'}}>NEW PASSWORD</label>
                      <div style={{position: 'relative'}}>
                        <input 
                            type={passVis.new ? "text" : "password"} 
                            name="new"
                            value={passForm.new}
                            onChange={handlePassChange}
                            style={{width: '100%', padding: '10px 35px 10px 12px', borderRadius: '6px', border: '1px solid #d1d5db'}}
                        />
                        <i 
                            className={`fas ${passVis.new ? 'fa-eye-slash' : 'fa-eye'}`}
                            onClick={() => togglePassVis('new')}
                            style={{position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#9ca3af'}}
                        ></i>
                      </div>
                  </div>
                  <div className="form-field">
                      <label style={{fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '4px', display:'block'}}>CONFIRM PASSWORD</label>
                      <div style={{position: 'relative'}}>
                        <input 
                            type={passVis.confirm ? "text" : "password"} 
                            name="confirm"
                            value={passForm.confirm}
                            onChange={handlePassChange}
                            style={{width: '100%', padding: '10px 35px 10px 12px', borderRadius: '6px', border: '1px solid #d1d5db'}}
                        />
                        <i 
                            className={`fas ${passVis.confirm ? 'fa-eye-slash' : 'fa-eye'}`}
                            onClick={() => togglePassVis('confirm')}
                            style={{position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#9ca3af'}}
                        ></i>
                      </div>
                  </div>
                  <div>
                      <span 
                        style={{fontSize: '13px', fontWeight: 600, color: '#111827', cursor: 'pointer', textDecoration: 'underline'}}
                        onClick={handleForgotPassword}
                      >
                          Forgot password?
                      </span>
                  </div>
              </div>

              <div className="modal-actions">
                  <button 
                      className="modal-btn modal-btn--cancel" 
                      onClick={() => setShowPasswordModal(false)}
                      disabled={saving}
                      style={{
                          background: '#f3f4f6',
                          color: '#374151',
                          border: 'none'
                      }}
                  >
                      Cancel
                  </button>
                  <button 
                      className="modal-btn" 
                      onClick={handleChangePassword}
                      disabled={saving}
                      style={{
                          background: '#047857', 
                          color: 'white',
                          fontWeight: 600
                      }}
                  >
                      {saving ? 'Changing...' : 'Change password'}
                  </button>
              </div>
          </div>
     </div>

    </div>
  )
}