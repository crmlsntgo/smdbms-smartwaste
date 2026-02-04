import React, { useState, useEffect, useMemo } from 'react'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { 
    getFirestore, 
    collection, 
    query, 
    orderBy, 
    limit, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc, 
    deleteDoc, 
    addDoc, 
    serverTimestamp, 
    writeBatch,
    runTransaction,
    setDoc
} from 'firebase/firestore'
import initFirebase from '../firebaseConfig'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import '../styles/vendor/dashboard-style.css'
import '../styles/vendor/header.css'
import '../styles/vendor/archive.css'
import '../styles/vendor/modal.css'
import { cleanupExpiredDeletedBins } from '../utils/cleanupExpiredDeletedBins'

export default function AdminArchive() {
    // --- State ---
    const [allBins, setAllBins] = useState([])
    const [filteredBins, setFilteredBins] = useState([])
    const [loading, setLoading] = useState(true)
    const [currentFilter, setCurrentFilter] = useState('all') // 'all', 'archived', 'restored', 'deleted'
    const [searchTerm, setSearchTerm] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [selectedBins, setSelectedBins] = useState(new Set())
    const [itemsPerPage] = useState(6)
    
    // Deletion Modal State
    const [binToDelete, setBinToDelete] = useState(null)
    const [showDeleteModal, setShowDeleteModal] = useState(false)

    // --- Stats ---
    const stats = useMemo(() => {
        const archived = allBins.filter(b => b.status?.toLowerCase() === 'archived').length
        const restored = allBins.filter(b => b.status?.toLowerCase() === 'restored').length
        const deleted = allBins.filter(b => b.status?.toLowerCase() === 'deleted').length
        return { archived, restored, deleted }
    }, [allBins])

    // --- Initialization & Data Fetching ---
    useEffect(() => {
        const app = initFirebase()
        const auth = getAuth(app)
        const db = getFirestore(app)

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Check Permission
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid))
                    if (userDoc.exists()) {
                         const role = userDoc.data().role || ''
                         if (role !== 'admin') {
                             window.location.href = '/archive' // Redirect non-admins to standard archive
                             return
                         }
                    }
                } catch (e) {
                    console.error("Auth check failed", e)
                }

                // Load Bins
                await loadAllData(db)
            } else {
                window.location.href = '/login'
            }
        })

        return () => unsubscribe()
    }, [])

    // Polling for expired deleted bins
    useEffect(() => {
        const interval = setInterval(async () => {
             const result = await cleanupExpiredDeletedBins()
             if (result && result.deleted > 0) {
                 const app = initFirebase()
                 const db = getFirestore(app)
                 await loadAllData(db)
             }
        }, 10000) // Check every 10 seconds

        return () => clearInterval(interval)
    }, [])

    const loadAllData = async (db) => {
        setLoading(true)
        try {
            const tempBins = []
            
            // 1. Fetch Archived
            const archiveQ = query(collection(db, 'archive'), orderBy('archivedAt', 'desc'), limit(500))
            const archiveSnap = await getDocs(archiveQ)
            archiveSnap.forEach(docSnap => {
                const data = docSnap.data()
                tempBins.push({
                    ...data,
                    id: docSnap.id,
                    binId: data.binId || data.serial || data.id,
                    binName: data.name || data.binName || 'Unknown Bin',
                    location: data.location || 'Unknown Location',
                    archivedAt: data.archivedAt?.toDate ? data.archivedAt.toDate() : (data.archiveDate ? new Date(data.archiveDate) : null),
                    lastActive: data.lastActive?.toDate ? data.lastActive.toDate() : (data.lastConfigured ? new Date(data.lastConfigured) : null),
                    status: data.status || 'Archived'
                })
            })

            // 2. Fetch Deleted (Admin Specific)
            const deletedQ = query(collection(db, 'deleted'), orderBy('autoDeleteAfter', 'desc'), limit(500))
            const deletedSnap = await getDocs(deletedQ)
            deletedSnap.forEach(docSnap => {
                const data = docSnap.data()
                tempBins.push({
                    ...data,
                    id: docSnap.id,
                    binId: data.binId || data.serial || data.id,
                    binName: data.name || data.binName || 'Unknown Bin',
                    location: data.location || 'Unknown Location',
                    status: 'Deleted',
                    archivedAt: data.autoDeleteAfter?.toDate ? data.autoDeleteAfter.toDate() : new Date() 
                })
            })

            // Sort Combined (Newest First)
            tempBins.sort((a,b) => (b.archivedAt || 0) - (a.archivedAt || 0))
            
            setAllBins(tempBins)
            setFilteredBins(tempBins)
        } catch (error) {
            console.error("Error loading admin archive data", error)
        } finally {
            setLoading(false)
        }
    }

    // --- Filtering & Searching ---
    useEffect(() => {
        let result = allBins

        // 1. Tab Filter
        if (currentFilter !== 'all') {
            result = result.filter(b => b.status?.toLowerCase() === currentFilter.toLowerCase())
        }
        
        // 2. Search
        if (searchTerm.trim()) {
            const lowerTerm = searchTerm.toLowerCase()
            result = result.filter(b => 
                (b.binName && b.binName.toLowerCase().includes(lowerTerm)) ||
                (b.location && b.location.toLowerCase().includes(lowerTerm)) ||
                (b.binId && String(b.binId).toLowerCase().includes(lowerTerm))
            )
        }

        setFilteredBins(result)
        setCurrentPage(1)
    }, [currentFilter, searchTerm, allBins])

    // --- Pagination Logic ---
    const paginatedBins = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filteredBins.slice(start, start + itemsPerPage)
    }, [filteredBins, currentPage, itemsPerPage])
    
    const totalPages = Math.ceil(filteredBins.length / itemsPerPage)

    // --- Handlers ---
    const getUserName = async (auth, db) => {
        if (!auth.currentUser) return 'Admin'
        try {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid))
            if (userDoc.exists()) {
                const data = userDoc.data()
                return `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || auth.currentUser.email
            }
            return auth.currentUser.email || 'Admin'
        } catch (e) {
            return 'Admin'
        }
    }

    const handleRestore = async (id) => {
        if (!confirm('Are you sure you want to restore this bin?')) return

        try {
            const app = initFirebase()
            const db = getFirestore(app)
            const auth = getAuth(app)
            const userName = await getUserName(auth, db)
            
            await runTransaction(db, async(tx) => {
                const archiveRef = doc(db, 'archive', id)
                const binRef = doc(db, 'bins', id)
                
                // Read
                const archiveSnap = await tx.get(archiveRef)
                if (!archiveSnap.exists()) throw new Error("Bin not found in archive")
                const data = archiveSnap.data()

                // Restore to bins (active)
                tx.set(binRef, {
                    ...data,
                    status: 'active',
                    restoredAt: serverTimestamp(),
                    lastConfigured: serverTimestamp() // Set as active
                })

                // Update archive record
                tx.update(archiveRef, {
                    status: 'Restored',
                    restoredAt: serverTimestamp(),
                    modifiedBy: userName
                })
            })

            // Update local state
            setAllBins(prev => prev.map(b => b.id === id ? { ...b, status: 'Restored', modifiedBy: userName } : b))
            alert('Bin restored successfully and returned to Customize page.')
        } catch (error) {
            console.error("Restore failed", error)
            alert('Failed to restore bin.')
        }
    }

    const handleRestoreSelected = async () => {
         if (selectedBins.size === 0) return
         if (!confirm(`Restore ${selectedBins.size} selected bins?`)) return

         try {
             const app = initFirebase()
             const db = getFirestore(app)
             const batch = writeBatch(db)
             let count = 0

             selectedBins.forEach(id => {
                const bin = allBins.find(b => b.id === id)
                if (bin && bin.status !== 'Restored' && bin.status !== 'Deleted') {
                    const ref = doc(db, 'archive', id)
                    batch.update(ref, { status: 'Restored', restoredAt: serverTimestamp() })
                    count++
                }
             })

             if (count > 0) await batch.commit()
             
             setAllBins(prev => prev.map(b => selectedBins.has(b.id) && b.status !== 'Deleted' ? { ...b, status: 'Restored' } : b))
             setSelectedBins(new Set())
             alert(`${count} bins restored.`)
         } catch (error) {
             console.error("Batch restore failed", error)
             alert('Batch restore failed.')
         }
    }

    const handleDeleteClick = (id) => {
        setBinToDelete(id)
        setShowDeleteModal(true)
    }

    const confirmDelete = async () => {
        if (!binToDelete) return
        
        try {
            const app = initFirebase()
            const db = getFirestore(app)
            const auth = getAuth(app)
            const userName = await getUserName(auth, db)
            
            const binData = allBins.find(b => b.id === binToDelete) || {}
            const safeData = JSON.parse(JSON.stringify(binData)) 
            if (safeData.id) delete safeData.id 

            // Add to Deleted
            await addDoc(collection(db, 'deleted'), {
                ...safeData,
                deletedAt: serverTimestamp(),
                deletedBy: auth.currentUser?.email || 'Admin',
                modifiedBy: userName,
                originalId: binToDelete,
                autoDeleteAfter: new Date(Date.now() + 60 * 1000) // 1 minute for testing
            })

            // Delete from Archive
            await deleteDoc(doc(db, 'archive', binToDelete))
            
            // Delete from All Bins (locally move to Deleted status if we want to show it in Deleted tab, but typically 'delete from archive' implies move)
            // Since we re-fetch 'deleted' only on load, let's manually add it to 'deleted' status in state
            // Re-construct the 'deleted' item to match local state shape
            const deletedItem = {
                ...binData,
                status: 'Deleted',
                archivedAt: new Date(),
                modifiedBy: userName
            }
            
            // Remove old, add new
            setAllBins(prev => {
                const filtered = prev.filter(b => b.id !== binToDelete)
                return [...filtered, deletedItem].sort((a,b) => (b.archivedAt || 0) - (a.archivedAt || 0))
            })

            setShowDeleteModal(false)
            setBinToDelete(null)
            
        } catch (error) {
            console.error("Delete failed", error)
            alert("Delete failed.")
        }
    }

    const toggleSelectAll = (e) => {
        if (e.target.checked) {
            const newSet = new Set(filteredBins.map(b => b.id))
            setSelectedBins(newSet)
        } else {
            setSelectedBins(new Set())
        }
    }

    const toggleSelect = (id) => {
        const newSet = new Set(selectedBins)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedBins(newSet)
    }

    const formatDate = (dateObj) => {
        if (!dateObj) return 'N/A'
        let date = dateObj
        
        // Handle Firestore Timestamp
        if (dateObj && typeof dateObj.toDate === 'function') {
            date = dateObj.toDate()
        } 
        // Handle Strings / Numbers
        else if (!(dateObj instanceof Date)) {
            date = new Date(dateObj)
        }

        // Check validity
        if (isNaN(date.getTime())) return 'N/A'

        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    }

    return (
        <div>
            <Header />
            <div className="dashboard-wrapper">
                <Sidebar />
                <main className="main-content">
                    <div className="dashboard-content">
                        {/* Page Header */}
                        <div className="archive-header">
                            <div className="archive-header__left">
                                <h1 className="archive-title">Archived Bins</h1>
                                <p className="archive-subtitle">Smart Dustbin Archived Overview</p>
                            </div>
                            <div className="archive-header__right">
                                <button className="archive-restore-btn" onClick={handleRestoreSelected} disabled={selectedBins.size === 0}>
                                    <i className="fas fa-undo"></i> Restore Selected
                                </button>
                            </div>
                        </div>

                        {/* Admin Stats Cards - includes Deleted Count */}
                        <div className="archive-stats">
                            <div className="stat-card">
                                <div className="stat-card__header">
                                    <span className="stat-card__dot stat-card__dot--blue"></span>
                                    <span className="stat-card__label">Total Archived Bins</span>
                                </div>
                                <div className="stat-card__value" id="statTotalArchived">{stats.archived}</div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-card__header">
                                    <span className="stat-card__dot stat-card__dot--red"></span>
                                    <span className="stat-card__label">Permanently Deleted</span>
                                </div>
                                <div className="stat-card__value" id="statDeleted">{stats.deleted}</div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-card__header">
                                    <span className="stat-card__dot stat-card__dot--green"></span>
                                    <span className="stat-card__label">Restored Bins</span>
                                </div>
                                <div className="stat-card__value" id="statRestored">{stats.restored}</div>
                            </div>
                        </div>

                        {/* Filter Tabs and Search */}
                        <div className="archive-filter">
                            <div className="filter-tabs">
                                <button 
                                    className={`filter-tab ${currentFilter === 'all' ? 'filter-tab--active' : ''}`} 
                                    onClick={() => setCurrentFilter('all')}
                                >All</button>
                                <button 
                                    className={`filter-tab ${currentFilter === 'archived' ? 'filter-tab--active' : ''}`} 
                                    onClick={() => setCurrentFilter('archived')}
                                >Archived</button>
                                <button 
                                    className={`filter-tab ${currentFilter === 'restored' ? 'filter-tab--active' : ''}`} 
                                    onClick={() => setCurrentFilter('restored')}
                                >Restored</button>
                                <button 
                                    className={`filter-tab filter-tab--deleted ${currentFilter === 'deleted' ? 'filter-tab--active' : ''}`} 
                                    onClick={() => setCurrentFilter('deleted')}
                                >Deleted</button>
                            </div>
                            <div className="filter-search">
                                <i className="fas fa-search"></i>
                                <input 
                                    type="text" 
                                    placeholder="Search..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Archive Table */}
                        <div className="archive-table-wrapper">
                            <table className="archive-table">
                                <thead>
                                    <tr>
                                        <th><input type="checkbox" onChange={toggleSelectAll} checked={filteredBins.length > 0 && selectedBins.size === filteredBins.length} /></th>
                                        <th>Bin ID</th>
                                        <th>Bin Name & Location</th>
                                        <th>Archive Date</th>
                                        <th>Reason</th>
                                        <th>Last Active</th>
                                        <th>Status</th>
                                        <th>Archived By</th>
                                        <th>Modified By</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr className="loading-row">
                                            <td colSpan="10" className="loading-cell">
                                                <i className="fas fa-spinner fa-spin"></i>
                                                <span>Loading archived bins...</span>
                                            </td>
                                        </tr>
                                    ) : paginatedBins.length === 0 ? (
                                        <tr>
                                            <td colSpan="10" style={{textAlign:'center', padding:'30px', color:'#666'}}>
                                                 <i className="fas fa-archive" style={{fontSize:'24px', marginBottom:'10px', display:'block'}}></i>
                                                 No {currentFilter !== 'all' ? currentFilter : ''} bins found
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedBins.map(bin => {
                                           const isDeleted = bin.status?.toLowerCase() === 'deleted'
                                           const isRestored = bin.status?.toLowerCase() === 'restored'
                                           
                                           return (
                                            <tr key={bin.id}>
                                                <td>
                                                    <input 
                                                        type="checkbox" 
                                                        className="bin-checkbox" 
                                                        checked={selectedBins.has(bin.id)} 
                                                        onChange={() => toggleSelect(bin.id)}
                                                    />
                                                </td>
                                                <td><span className="bin-id">#{bin.binId}</span></td>
                                                <td>
                                                    <strong>{bin.binName}</strong>
                                                    <div className="bin-location">{bin.location}</div>
                                                </td>
                                                <td>{formatDate(bin.archivedAt)}</td>
                                                <td>{bin.reason || bin.archiveReason || 'No reason'}</td>
                                                <td>{formatDate(bin.lastActive)}</td>
                                                <td>
                                                    <span className={`status-badge status-badge--${bin.status?.toLowerCase()}`}>
                                                        {bin.status}
                                                    </span>
                                                </td>
                                                <td>{bin.archivedByName || 'System'}</td>
                                                <td>{bin.modifiedBy || 'N/A'}</td>
                                                <td>
                                                    {!isDeleted && !isRestored && (
                                                        <button className="action-icon action-icon--restore" onClick={() => handleRestore(bin.id)} title="Restore">
                                                            <i className="fas fa-redo"></i>
                                                        </button>
                                                    )}
                                                    {!isDeleted && (
                                                        <button className="action-icon action-icon--delete" onClick={() => handleDeleteClick(bin.id)} title="Delete">
                                                            <i className="fas fa-trash"></i>
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                           )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                         {/* Pagination */}
                        {!loading && filteredBins.length > 0 && (
                            <div className="archive-pagination">
                                <span className="pagination-info">
                                    Showing {(currentPage - 1) * itemsPerPage + 1}-
                                    {Math.min(currentPage * itemsPerPage, filteredBins.length)} of {filteredBins.length} entries
                                </span>
                                <div className="pagination-controls">
                                    <button 
                                        className="pagination-btn" 
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                    >Previous</button>
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button 
                                            key={i} 
                                            className={`pagination-btn ${currentPage === i + 1 ? 'pagination-btn--active' : ''}`}
                                            onClick={() => setCurrentPage(i + 1)}
                                        >{i + 1}</button>
                                    ))}
                                    <button 
                                        className="pagination-btn"
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                    >Next</button>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Delete Modal */}
            <div className={`modal-overlay ${showDeleteModal ? 'active' : ''}`} style={{display: showDeleteModal ? 'flex' : 'none'}}>
                <div className="modal-dialog">
                    <div className="modal-icon modal-icon--delete" style={{color: '#ef4444', background: '#fee2e2'}}>
                        <i className="fas fa-trash-alt"></i>
                    </div>
                    <h2 className="modal-title">Delete this bin permanently?</h2>
                    <p className="modal-subtitle">This action will move the bin to the deleted items folder. Only admins can view deleted items.</p>
                    <div className="modal-actions">
                        <button className="modal-btn modal-btn--confirm" style={{background:'#ef4444'}} onClick={confirmDelete}>Delete</button>
                        <button className="modal-btn modal-btn--cancel" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    )
}
