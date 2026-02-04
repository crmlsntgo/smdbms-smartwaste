import React, { useState, useEffect, useRef } from 'react'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { 
    getFirestore, 
    collection, 
    query, 
    orderBy, 
    limit, 
    startAfter, 
    getDocs, 
    getDoc, 
    doc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    addDoc, 
    serverTimestamp,
    runTransaction 
} from 'firebase/firestore'
import initFirebase from '../firebaseConfig'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import '../styles/vendor/dashboard-style.css'
import '../styles/vendor/header.css'
import '../styles/vendor/settings.css'
import '../styles/vendor/customize.css'
import '../styles/vendor/modal.css' // Reusing modal css for consistency

export default function Customize() {
  const [bins, setBins] = useState([])
  const [selectedBinId, setSelectedBinId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const [removeReason, setRemoveReason] = useState('')
  const [permissionError, setPermissionError] = useState(null)
  const [successModal, setSuccessModal] = useState({ show: false, message: '' })
  
  // Form State
  const [formData, setFormData] = useState({
      binName: '',
      capacity: '',
      serial: '',
      threshold: '',
      location: '',
      imageUrl: '',
      sensorStatus: 'disconnected'
  })
  
  // Firestore references
  const [lastDoc, setLastDoc] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 200

  useEffect(() => {
    const app = initFirebase()
    const auth = getAuth(app)
    const db = getFirestore(app)

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Check Role
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid))
                if (userDoc.exists()) {
                    const role = userDoc.data().role || ''
                    setUserRole(role)
                    // Check permissions
                    if (['admin', 'utility staff', 'utility_staff'].includes(role.toLowerCase())) {
                        await loadBins(db, true)
                        setPermissionError(null)
                    } else {
                        setPermissionError('Your account does not have permission to read bins. Contact an administrator.')
                        setLoading(false)
                    }
                } else {
                     setPermissionError('Unable to load bins due to permission restrictions. Please check Firestore rules and your user role.')
                     setLoading(false)
                }
            } catch (e) {
                console.error("Role check failed", e)
                setPermissionError('Unable to load bins due to permission restrictions. Please check Firestore rules and your user role.')
                setLoading(false)
            }
        } else {
            // Redirect or show login required
            window.location.href = '/login'
        }
    })

    return () => {
      unsubscribe()
      const link = document.getElementById('customize-page-css')
      if (link) link.remove()
    }
  }, [])

  const loadBins = async (db, reset = false) => {
      setLoading(true)
      try {
          const binsCol = collection(db, 'bins')
          let q = query(binsCol, orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
          
          if (!reset && lastDoc) {
              q = query(binsCol, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE))
          }

          const snapshot = await getDocs(q)
          const newBins = []
          snapshot.forEach(docSnap => {
              const data = docSnap.data()
              // Normalize data matching public JS logic
              newBins.push({ 
                  id: docSnap.id, 
                  ...data,
                  binName: data.name || data.binName || 'Unnamed Bin',
                  sensorStatus: data.sensorStatus || 'connected',
                  imageUrl: data.imageUrl || ''
              })
          })

          if (reset) {
              setBins(newBins)
              if (newBins.length > 0) selectBin(newBins[0])
          } else {
              setBins(prev => [...prev, ...newBins])
          }

          setLastDoc(snapshot.docs[snapshot.docs.length - 1])
          setHasMore(snapshot.docs.length === PAGE_SIZE)
          
      } catch (error) {
          console.error("Error loading bins:", error)
      } finally {
          setLoading(false)
      }
  }

  const selectBin = (bin) => {
      setSelectedBinId(bin.id)
      setFormData({
          binName: bin.binName || '',
          capacity: bin.capacity || '',
          serial: bin.serial || '',
          threshold: bin.threshold || '',
          location: bin.location || '',
          imageUrl: bin.imageUrl || '',
          sensorStatus: bin.sensorStatus || 'disconnected',
          lastConfigured: bin.lastConfigured,
          status: bin.status,
          createdAt: bin.createdAt
      })
      setShowInfo(false)
  }

  const handleInputChange = (e) => {
      const { id, value } = e.target
      let key = id.replace('bin-', '').replace(/-([a-z])/g, (g) => g[1].toUpperCase())
      
      // Fix: Map 'name' back to 'binName' to match state property
      if (key === 'name') key = 'binName'

      // Validation logic matching customize.js
      if (id === 'bin-capacity' || id === 'bin-threshold') {
          if (!/^\d*$/.test(value)) return // Only digits
      }
      
      setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleCreateBin = async () => {
    // Generate Serial Number Transactionally
    // Matching `customize.js` logic for `generateNextSerial`
    const app = initFirebase()
    const db = getFirestore(app)

    try {
        const nextSerial = await runTransaction(db, async (transaction) => {
             const serialRef = doc(db, 'settings', 'serials')
             const serialDoc = await transaction.get(serialRef)
             
             let currentSeq = 1000
             if (!serialDoc.exists()) {
                 transaction.set(serialRef, { nextSequence: 1001 })
             } else {
                 currentSeq = serialDoc.data().nextSequence || 1000
                 transaction.update(serialRef, { nextSequence: currentSeq + 1 })
             }
             return `SDB-${currentSeq}`
        })
        
        // Create new bin
        const newBinData = {
            binName: 'New Bin',
            capacity: 100,
            serial: nextSerial,
            threshold: 80,
            location: 'New Location',
            imageUrl: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400',
            sensorStatus: 'disconnected',
            createdAt: serverTimestamp(),
            lastConfigured: serverTimestamp(),
            status: 'Active'
        }

        const docRef = await addDoc(collection(db, 'bins'), newBinData)
        
        const newBin = { id: docRef.id, ...newBinData, createdAt: new Date() } // approximate date for UI
        setBins([newBin, ...bins])
        selectBin(newBin)
        setSuccessModal({ show: true, message: `New bin created with Serial: ${nextSerial}` })

    } catch (error) {
        console.error("Error creating bin:", error)
        alert("Failed to create new bin.")
    }
  }

  const handleSave = async (e) => {
      e.preventDefault()
      if (!selectedBinId) return

      try {
          const app = initFirebase()
          const db = getFirestore(app)
          const binRef = doc(db, 'bins', selectedBinId)

          const updateData = {
              binName: formData.binName,
              capacity: parseInt(formData.capacity) || 0,
              threshold: parseInt(formData.threshold) || 80,
              location: formData.location,
              imageUrl: formData.imageUrl,
              lastConfigured: serverTimestamp()
          }

          await updateDoc(binRef, updateData)
          
          // Update local state
          setBins(prev => prev.map(b => b.id === selectedBinId ? { ...b, ...updateData } : b))
          alert("Bin configuration saved.")

      } catch (error) {
          console.error("Save failed:", error)
          alert("Failed to save changes.")
      }
  }

  const handleRemove = async () => {
      const reason = removeReason;
      if (!reason) return;
      if (bins.length <= 1) {
          alert('Cannot remove the last bin');
          setShowRemoveModal(false);
          return;
      }

      if (!selectedBinId) return
      
      try {
          const app = initFirebase()
          const db = getFirestore(app)
          const auth = getAuth(app)

          const currentBin = bins.find(b => b.id === selectedBinId)
          if (!currentBin) return;

          // Get user info for Archived By field
          let archivedByName = auth.currentUser.email || auth.currentUser.uid;
          try {
              const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid))
              if (userDoc.exists()) {
                  const userData = userDoc.data()
                  archivedByName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email || auth.currentUser.email || auth.currentUser.uid
              }
          } catch(e) {
              console.warn("Could not fetch user details for archive log:", e)
          }

          // Transactional remove (matching public/js/customize.js logic)
          await runTransaction(db, async (tx) => {
              const binRef = doc(db, 'bins', String(currentBin.id))
              const archiveRef = doc(db, 'archive', String(currentBin.id))
              const serialRef = currentBin.serial ? doc(db, 'serials', currentBin.serial) : null

              // READ
              const binSnap = await tx.get(binRef)
              if (!binSnap.exists()) throw new Error("Bin not found")
              const binData = binSnap.data()

              let sSnap = null
              if (serialRef) sSnap = await tx.get(serialRef)

              // WRITE
              tx.set(archiveRef, {
                  ...binData,
                  status: 'archived',
                  archivedAt: serverTimestamp(),
                  archiveDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
                  archiveReason: reason,
                  reason: reason,
                  lastActive: currentBin.lastConfigured ? formatDate(currentBin.lastConfigured) : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
                  archivedBy: auth.currentUser ? auth.currentUser.uid : null,
                  archivedByName: archivedByName
              })

              tx.delete(binRef)
              if (sSnap && sSnap.exists()) {
                  tx.update(serialRef, { archived: true, archivedAt: serverTimestamp(), archiveReason: reason })
              }
          })

          // UI Update
          const remaining = bins.filter(b => b.id !== selectedBinId)
          setBins(remaining)
          if (remaining.length > 0) selectBin(remaining[0])
          else {
              setSelectedBinId(null)
              setFormData({ binName:'', capacity:'', serial:'', threshold:'', location:'', imageUrl:'', sensorStatus:'' })
          }
          
          setShowRemoveModal(false)
          alert(`Bin "${currentBin.binName}" moved to archive`)

      } catch (error) {
          console.error("Remove failed:", error)
          alert(`Failed to archive "${bins.find(b=>b.id===selectedBinId)?.binName}". Check console.`)
      }
  }

  // Format Helpers
  const formatDate = (ts) => {
      if (!ts) return 'N/A'
      if (ts.toDate) return ts.toDate().toLocaleString()
      if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString()
      return new Date(ts).toLocaleString()
  }

  const filteredBins = bins.filter(b => 
      b.binName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      b.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.serial?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="customize-page">
      <Header />
      <div className="dashboard-wrapper">
        <Sidebar />
        <main className="main-content">
          <div className="dashboard-content">
            {/* Page Header */}
            <div className="customize-header">
                <div className="customize-header__left">
                    <h1 className="customize-title">Bin Customization</h1>
                    <p className="customize-subtitle">Configure and customize your smart bins</p>
                </div>
                <div className="customize-header__right">
                    <button className="customize-add-btn" id="add-bin-btn" onClick={handleCreateBin}>
                        <i className="fas fa-plus"></i> Add New Bin
                    </button>
                </div>
            </div>

            {/* Three Column Layout */}
            <div className="customize-layout">
                {/* Bin List (Left) */}
                <div className="customize-bin-list">
                    <div className="config-header">
                        <h3 className="config-title">Bin List</h3>
                    </div>
                    <div className="bin-list-content">
                        <div className="bin-list-search">
                            <i className="fas fa-search"></i>
                            <input 
                                type="text" 
                                placeholder="Search bins..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="bin-items" id="bin-items">
                            {permissionError ? (
                                <div className="bin-list-permission-error" style={{padding:'20px', color:'#ef4444', background:'#fee2e2', borderRadius:'8px', fontSize:'13px'}}>
                                    <strong>Permission error:</strong> {permissionError}<br/>
                                    <small>Check your Firestore rules and ensure your user has the correct role in the users collection.</small>
                                </div>
                            ) : (
                                <>
                                {filteredBins.map(bin => (
                                    <div 
                                        key={bin.id} 
                                        className={`bin-item ${selectedBinId === bin.id ? 'bin-item--active' : ''}`}
                                        onClick={() => selectBin(bin)}
                                    >
                                        <div className="bin-item__icon" style={{backgroundImage: bin.imageUrl ? `url('${bin.imageUrl}')` : 'none', backgroundColor: '#e5e7eb'}}></div>
                                        <div className="bin-item__name">{bin.binName}</div>
                                        <div className="bin-item__meta">
                                            <span className={`bin-item__dot bin-item__dot--${bin.sensorStatus === 'connected' ? 'green' : 'orange'}`}></span>
                                            <span>{bin.location}</span>
                                        </div>
                                    </div>
                                ))}
                                {loading && <div style={{padding:'10px', textAlign:'center', color:'#888'}}>Loading bins...</div>}
                                {!loading && filteredBins.length === 0 && (
                                    <div className="bin-list-empty" style={{padding:'20px', textAlign:'center', color:'#888'}}>
                                        No bins available. Add a bin to get started.
                                    </div>
                                )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bin Configuration (Middle) */}
                <div className="customize-bin-config">
                    <div className="config-header">
                        <h3 className="config-title">Bin Configuration</h3>
                        <div className="config-actions">
                            <button className="config-btn config-btn--danger" onClick={() => setShowRemoveModal(true)} disabled={!selectedBinId}>
                                <i className="fas fa-trash"></i> Remove
                            </button>
                            <button className="config-btn config-btn--primary" onClick={handleSave} disabled={!selectedBinId}>
                                <i className="fas fa-check"></i> Save Changes
                            </button>
                        </div>
                    </div>

                    <form id="bin-form" className="config-form" onSubmit={(e) => e.preventDefault()}>
                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="bin-name">Bin Name</label>
                                <input type="text" id="bin-name" value={formData.binName} onChange={handleInputChange} disabled={!selectedBinId} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="bin-capacity">Capacity (Liters)</label>
                                <input type="text" id="bin-capacity" value={formData.capacity} onChange={handleInputChange} disabled={!selectedBinId} />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="bin-serial">Bin Serial Number</label>
                                <input type="text" id="bin-serial" value={formData.serial} readOnly disabled={!selectedBinId} style={{background:'#f9fafb'}} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="bin-threshold">Alert Threshold (%)</label>
                                <input type="number" id="bin-threshold" value={formData.threshold} onChange={handleInputChange} min="1" max="100" disabled={!selectedBinId} />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="bin-location">Location</label>
                                <input type="text" id="bin-location" value={formData.location} onChange={handleInputChange} disabled={!selectedBinId} />
                            </div>
                            <div className="form-group">
                                <label>Sensor Connection</label>
                                <div className="sensor-status" style={{color: formData.sensorStatus === 'connected' ? '#059669' : '#6b7280'}}>
                                    <span className={`status-dot ${formData.sensorStatus === 'connected' ? 'status-dot--connected' : ''}`}></span>
                                    {formData.sensorStatus === 'connected' ? 'Connected' : 'Disconnected'}
                                </div>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group full-width">
                                <label htmlFor="bin-image-url">Bin Image URL</label>
                                <input type="text" id="bin-image-url" value={formData.imageUrl} onChange={handleInputChange} placeholder="https://..." disabled={!selectedBinId} />
                            </div>
                        </div>

                        {/* Additional Information */}
                        <div className="additional-info">
                            <button type="button" className="info-toggle" onClick={() => setShowInfo(!showInfo)}>
                                <i className="fas fa-info-circle"></i> Additional Information
                            </button>
                            <div className="info-details" style={{display: showInfo ? 'block' : 'none'}}>
                                <div className="info-row">
                                    <span className="info-label">Last Configured</span>
                                    <span className="info-value">{formatDate(formData.lastConfigured)}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Status</span>
                                    <span className="info-value">{formData.status}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Date Created</span>
                                    <span className="info-value">{formatDate(formData.createdAt)}</span>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Bin Preview (Right) */}
                <div className="customize-bin-preview">
                    <div className="config-header">
                        <h3 className="config-title">Live Preview</h3>
                    </div>
                    <div className="preview-card">
                        <div className="preview-name">{formData.binName || 'No bin selected'}</div>
                        <div className="preview-location">
                            <i className="fas fa-map-marker-alt"></i>
                            <span>{formData.location}</span>
                        </div>
                        <div className="preview-image" style={{
                            backgroundImage: formData.imageUrl ? `url('${formData.imageUrl}')` : 'none'
                        }}></div>
                        <div className="preview-wifi">
                            <i className="fas fa-wifi"></i>
                        </div>
                        <div className="preview-details">
                            <div className="preview-detail-row">
                                <span className="detail-label">Capacity:</span>
                                <span className="detail-value">{formData.capacity}L</span>
                            </div>
                            <div className="preview-detail-row">
                                <span className="detail-label">Alert Threshold:</span>
                                <span className="detail-value">{formData.threshold}%</span>
                            </div>
                            <div className="preview-detail-row">
                                <span className="detail-label">Sensor Status:</span>
                                <span className={`detail-value ${formData.sensorStatus==='connected' ? 'detail-value--connected' : ''}`}>
                                    {formData.sensorStatus === 'connected' ? 'Connected' : 'Offline'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Remove Confirmation Modal */}
            <div className={`modal-overlay ${showRemoveModal ? 'active' : ''}`}>
                <div className="modal-dialog">
                    <div className="modal-icon">
                        <i className="fas fa-trash"></i>
                    </div>
                    <h2 className="modal-title">Are you sure you want to remove this bin?</h2>
                    <p className="modal-subtitle">This will go to admin archive page.</p>
                    
                    <div className="modal-form-group">
                        <label htmlFor="remove-reason">Reason for removing</label>
                        <div className="custom-select">
                            <select 
                                id="remove-reason" 
                                value={removeReason}
                                onChange={(e) => setRemoveReason(e.target.value)}
                            >
                                <option value="">Select a reason</option>
                                <option value="Repair">Repair</option>
                                <option value="Damaged">Damaged</option>
                                <option value="Maintenance">Maintenance</option>
                            </select>
                            <i className="fas fa-chevron-down"></i>
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button 
                            className="modal-btn modal-btn--confirm" 
                            id="modal-confirm-btn" 
                            onClick={handleRemove}
                            disabled={!removeReason}
                        >
                            Confirm
                        </button>
                        <button 
                            className="modal-btn modal-btn--cancel" 
                            id="modal-cancel-btn" 
                            onClick={() => setShowRemoveModal(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>

            {/* Success Modal */}
            <div className={`modal-overlay ${successModal.show ? 'active' : ''}`} style={{display: successModal.show ? 'flex' : 'none', zIndex: 2100}}>
                <div className="modal-dialog">
                    <div className="modal-icon" style={{background: '#d1fae5', color: '#059669', display:'flex', alignItems:'center', justifyContent:'center', width:'48px', height:'48px', borderRadius:'50%', margin:'0 auto 16px auto'}}>
                        <i className="fas fa-check" style={{fontSize: '24px'}}></i>
                    </div>
                    <h2 className="modal-title" style={{fontSize:'18px', fontWeight:'600', marginBottom:'8px'}}>Success</h2>
                    <p className="modal-subtitle" style={{fontSize:'14px', color:'#666', marginBottom:'24px'}}>{successModal.message}</p>
                    <button 
                        className="modal-btn" 
                        style={{background: '#059669', color: 'white', padding: '10px 24px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight:'500'}}
                        onClick={() => setSuccessModal({ show: false, message: '' })}
                    >
                        OK
                    </button>
                </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  )
}
