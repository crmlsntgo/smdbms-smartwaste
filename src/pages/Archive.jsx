import React, { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useSearchHighlight } from '../hooks/useSearchHighlight'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { 
    getFirestore, 
    collection, 
    query, 
    orderBy, 
    limit, 
    getDocs, 
    getDoc, 
    doc, 
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
import Toast from '../components/Toast'
import { notifyBinChange } from '../utils/syncManager'
import '../styles/vendor/dashboard-style.css'
import '../styles/vendor/header.css'
import '../styles/vendor/archive.css'
import { cleanupExpiredRestoredBins } from '../utils/cleanupExpiredDeletedBins'

export default function Archive() {
    // --- State ---
    const [allBins, setAllBins] = useState([])
    const [filteredBins, setFilteredBins] = useState([])
    const [loading, setLoading] = useState(true)
    const [userRole, setUserRole] = useState(null)
    const [currentFilter, setCurrentFilter] = useState('all') // 'all', 'archived', 'restored', 'deleted'
    const [searchTerm, setSearchTerm] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [selectedBins, setSelectedBins] = useState(new Set())
    const [itemsPerPage] = useState(6)
    
    // Deletion Modal State
    const [binToDelete, setBinToDelete] = useState(null)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [binToRestore, setBinToRestore] = useState(null)
    const [showRestoreModal, setShowRestoreModal] = useState(false)
    const [showBatchRestoreModal, setShowBatchRestoreModal] = useState(false)
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
    
    const location = useLocation()
    const { getHighlightClass } = useSearchHighlight()
    
    // Handle Global Search Navigation
    useEffect(() => {
        if (location.state) {
            // Filter selection (archived, restored, deleted)
            if (location.state.filter) {
                setCurrentFilter(location.state.filter)
            } 
            // Highlight specific item ?
            if (location.state.highlightTerm && !location.state.disableSearchFilter) {
               setSearchTerm(location.state.highlightTerm)
               // Also reset filter if needed, or keep it if it matches context
            }
        }
    }, [location]) // Dependency on bins so it runs after render

    // --- Stats ---
    const stats = useMemo(() => {
        const archived = allBins.filter(b => b.status?.toLowerCase() === 'archived').length
        const restored = allBins.filter(b => b.status?.toLowerCase() === 'restored').length
        return { archived, restored }
    }, [allBins])

    // --- Initialization & Data Fetching ---
    useEffect(() => {
        const app = initFirebase()
        const auth = getAuth(app)
        const db = getFirestore(app)
        
        // Polling for expired restored bins
        const interval = setInterval(async () => {
             const result = await cleanupExpiredRestoredBins()
             if (result && result.deleted > 0) {
                 if (auth.currentUser) await loadArchivedBins(db, auth.currentUser)
             }
        }, 10000)

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // 1. Check Role
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid))
                    if (userDoc.exists()) {
                        setUserRole(userDoc.data().role)
                    }
                } catch (e) {
                    console.error("Role check failed", e)
                }

                // 2. Load Bins
                await loadArchivedBins(db, user)
            } else {
                setLoading(false)
                // Redirect if needed, or just show loading/empty
                window.location.href = '/login'
            }
        })

        return () => {
            clearInterval(interval)
            unsubscribe()
        }
    }, [])

    const loadArchivedBins = async (db, user) => {
        setLoading(true)
        try {
            const tempBins = []
            
            // Standard Archive Collection
            const archiveQ = query(collection(db, 'archive'), orderBy('archivedAt', 'desc'), limit(500))
            const archiveSnap = await getDocs(archiveQ)
            archiveSnap.forEach(docSnap => {
                const data = docSnap.data()
                tempBins.push({
                    ...data,
                    id: docSnap.id,
                    binId: data.binId || data.serial || data.id, // normalization
                    binName: data.name || data.binName || 'Unknown Bin',
                    location: data.location || 'Unknown Location',
                    archivedAt: data.archivedAt?.toDate ? data.archivedAt.toDate() : (data.archiveDate ? new Date(data.archiveDate) : null),
                    lastActive: data.lastActive?.toDate ? data.lastActive.toDate() : (data.lastConfigured ? new Date(data.lastConfigured) : null),
                    status: data.status || 'Archived'
                })
            })

            // Deleted Collection (Admin Only) - Logic copied from legacy js, but check local role isn't set yet inside effect closure?
            // Actually we can re-check role or fetch it first. For now let's optimistic fetch if we can conform role.
            // Since role state might lag, we rely on the check done before calling this function if we passed it, 
            // but we didn't pass role. We'll fetch user role first inside the effect to be safe.
            // *Edit*: Re-using the fetch logic in the effect above is better.
            
            // Re-fetch logic inside load for clarity or check role inside:
            let isAdmin = false
            if (user) {
                 const uDoc = await getDoc(doc(db, 'users', user.uid))
                 if (uDoc.exists() && uDoc.data().role === 'admin') isAdmin = true
            }

            if (isAdmin) {
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
                        // Deleted items might have autoDeleteAfter instead of archivedAt
                        archivedAt: data.autoDeleteAfter?.toDate ? data.autoDeleteAfter.toDate() : new Date() 
                    })
                })
            }

            // Client-side Sort (Newest First)
            tempBins.sort((a,b) => (b.archivedAt || 0) - (a.archivedAt || 0))
            
            setAllBins(tempBins)
            setFilteredBins(tempBins)
        } catch (error) {
            console.error("Error loading bins", error)
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
        setCurrentPage(1) // Reset to page 1 on filter change
    }, [currentFilter, searchTerm, allBins])

    // --- Pagination Logic ---
    const paginatedBins = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filteredBins.slice(start, start + itemsPerPage)
    }, [filteredBins, currentPage, itemsPerPage])
    
    const totalPages = Math.ceil(filteredBins.length / itemsPerPage)

    // --- Helper Formatters ---
    const getUserName = async (auth, db) => {
        if (!auth.currentUser) return 'Utility Staff'
        try {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid))
            if (userDoc.exists()) {
                const data = userDoc.data()
                return `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || auth.currentUser.email
            }
            return auth.currentUser.email || 'Utility Staff'
        } catch (e) {
            return 'Utility Staff'
        }
    }

    const handleRestoreClick = (id) => {
        setBinToRestore(id)
        setShowRestoreModal(true)
    }

    const confirmRestore = async () => {
        if (!binToRestore) return
        const id = binToRestore

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

                // Check if reason was Emptying
                const isEmptying = (data.reason === 'Emptying' || data.reason === 'Emptied / Emptying' || data.archiveReason === 'Emptying' || data.archiveReason === 'Emptied / Emptying');

                // Prepare restore data
                const restoreData = {
                    ...data,
                    status: 'Active',
                    restoredAt: serverTimestamp(),
                    lastConfigured: serverTimestamp()
                };

                // If Emptying, reset values and update lastEmptiedAt
                if (isEmptying) {
                    restoreData.fill_level = 0;
                    restoreData.general_waste = 0;
                    restoreData.waste_composition = { recyclable: 0, biodegradable: 0, non_biodegradable: 0 };
                    restoreData.lastEmptiedAt = serverTimestamp();
                    restoreData.emptiedBy = userName; // The person restoring confirms it is emptied
                }

                // Restore
                tx.set(binRef, restoreData)

                // Update Archive
                tx.update(archiveRef, {
                    status: 'Restored',
                    restoredAt: serverTimestamp(),
                    modifiedBy: userName
                })
            })

            // Optimistic update
            setAllBins(prev => prev.map(b => b.id === id ? { ...b, status: 'Restored' } : b))
            setToast({ show: true, message: "Bin restored successfully. 1 Day expired.", type: 'success' })
            setShowRestoreModal(false)
        } catch (error) {
            console.error("Restore failed", error)
            alert('Failed to restore bin.')
        }
    }

    const handleRestoreSelected = async () => {
         if (selectedBins.size === 0) return

         // Check if any restored bin is selected
         let hasRestored = false
         selectedBins.forEach(id => {
             const bin = allBins.find(b => b.id === id)
             if (bin && bin.status === 'Restored') hasRestored = true
         })

         if (hasRestored) {
             setToast({ show: true, message: "The bin's already restored", type: 'error' })
             return
         }

         setShowBatchRestoreModal(true)
    }

    const confirmBatchRestore = async () => {
         try {
             const app = initFirebase()
             const db = getFirestore(app)
             const auth = getAuth(app)
             const userName = await getUserName(auth, db)
             const batch = writeBatch(db)

             selectedBins.forEach(id => {
                const bin = allBins.find(b => b.id === id)
                if (bin && bin.status !== 'Restored' && bin.status !== 'Deleted') { // Can only restore archived
                    const archiveRef = doc(db, 'archive', id)
                    const binRef = doc(db, 'bins', id)
                    
                    // Helper to remove UI-specific derived fields and potentially invalid dates
                    const { 
                        lastActive, 
                        archivedAt, 
                        id: _id, // Remove id
                        binId,   // Remove derived binId
                        ...rest 
                    } = bin

                    // Check if Emptying
                    const isEmptying = (bin.reason === 'Emptying' || bin.reason === 'Emptied / Emptying' || bin.archiveReason === 'Emptying' || bin.archiveReason === 'Emptied / Emptying');

                    // Restore to bins (active)
                    const restoreData = {
                        ...rest,
                        status: 'Active',
                        restoredAt: serverTimestamp(),
                        lastConfigured: serverTimestamp()
                    }

                    if (isEmptying) {
                        restoreData.fill_level = 0;
                        restoreData.general_waste = 0;
                        restoreData.waste_composition = { recyclable: 0, biodegradable: 0, non_biodegradable: 0 };
                        restoreData.lastEmptiedAt = serverTimestamp();
                        restoreData.emptiedBy = userName;
                    }

                    batch.set(binRef, restoreData)

                    // Update archive status
                    batch.update(archiveRef, { status: 'Restored', restoredAt: serverTimestamp(), modifiedBy: userName })
                }
             })

             await batch.commit()
             
             // Optimistic update
             setAllBins(prev => prev.map(b => selectedBins.has(b.id) ? { ...b, status: 'Restored', modifiedBy: userName } : b))
             setSelectedBins(new Set())
             setToast({ show: true, message: 'Selected bins restored.', type: 'success' })
             
             notifyBinChange(db, 'restore', Array.from(selectedBins))
             setShowBatchRestoreModal(false)

         } catch (error) {
             console.error("Batch restore failed", error)
             setShowBatchRestoreModal(false)
             alert('Batch restore failed.')
         }
    }

    const handleDeleteClick = (id) => {
        setBinToDelete(id)
        setShowDeleteModal(true)
    }

    const handleDeleteSelected = async () => {
        if (selectedBins.size === 0) return
        if (!confirm(`Permanently delete ${selectedBins.size} selected bins?`)) return

        try {
            const app = initFirebase()
            const db = getFirestore(app)
            const auth = getAuth(app)
            const userName = await getUserName(auth, db)
            
            // Process deletions
            const promises = Array.from(selectedBins).map(async (id) => {
                const bin = allBins.find(b => b.id === id)
                if (!bin) return
                if (bin.status === 'Deleted') return

                const safeData = JSON.parse(JSON.stringify(bin))
                if (safeData.id) delete safeData.id
                
                // Add to Deleted collection
                await addDoc(collection(db, 'deleted'), {
                    ...safeData,
                    deletedAt: serverTimestamp(),
                    deletedBy: auth.currentUser?.email || 'Admin',
                    modifiedBy: userName,
                    originalId: id,
                    autoDeleteAfter: new Date(Date.now() + 60 * 1000)
                })

                // Remove from Archive collection
                await deleteDoc(doc(db, 'archive', id))
            })

            await Promise.all(promises)
            
            // Remove from local state
            setAllBins(prev => prev.filter(b => !selectedBins.has(b.id)))
            setSelectedBins(new Set())
            alert(`${selectedBins.size} bins deleted.`)
            
        } catch (error) {
             console.error("Batch delete failed", error)
             alert('Batch delete failed.')
        }
    }

    const confirmDelete = async () => {
        if (!binToDelete) return
        
        try {
            const app = initFirebase()
            const db = getFirestore(app)
            
            // 1. Add to 'deleted' collection
            const binData = allBins.find(b => b.id === binToDelete) || {}
            // Sanitize undefined
            const safeData = JSON.parse(JSON.stringify(binData)) // naive quick sanitize
            if (safeData.id) delete safeData.id // don't replicate ID field inside doc if not needed, but nice to have ref

            // In legacy logic: we simply deleteDoc from archive. 
            // Wait, legacy code says: `deleteDoc(doc(db, "archive", id))` and creates notification.
            // Wait, legacy "Deleted" tab usually implies soft delete or separate collection. 
            // Let's stick to simple delete from 'archive' as per legacy `deleteBin` function...
            // Checking legacy `archive.js` (not provided in full but assumed standard delete):
            // Actually line 150 of provided context has ` onclick="showDeleteModal('${bin.id}')" `
            // And line 118 loads from `collection(db, "deleted")` for admins. 
            // So logic implies moving from 'archive' to 'deleted'.
            
            const deletedRef = collection(db, 'deleted')
            await addDoc(deletedRef, {
                ...safeData,
                deletedAt: serverTimestamp(),
                deletedBy: auth.currentUser?.email || 'Admin',
                originalId: binToDelete,
                autoDeleteAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            })

            // 2. Delete from 'archive'
            await deleteDoc(doc(db, 'archive', binToDelete))
            
            // UI Update
            setAllBins(prev => prev.filter(b => b.id !== binToDelete))
            setShowDeleteModal(false)
            setBinToDelete(null)
            
        } catch (error) {
            console.error("Delete failed", error)
            alert("Delete failed.")
        }
    }

    const toggleSelectAll = (e) => {
        if (e.target.checked) {
            const allIds = paginatedBins.map(b => b.id) // Only select visible page? Or all? Legacy usually visible.
            // If user wants all filtered, let's map filteredBins.
            // Standard check-all usually applies to current view or all list. 
            // Let's stick to paginated for safety or filtered if simple. 
            // Given "Restore Selected" usually implies bulk, let's select ALL filtered IDs.
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

    // --- Helper Formatters ---
    const formatDate = (dateObj) => {
        if (!dateObj) return 'N/A'
        return dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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
                                {userRole === 'admin' && (
                                <button 
                                    className="archive-restore-btn" 
                                    onClick={handleDeleteSelected} 
                                    disabled={selectedBins.size === 0} 
                                    style={{marginLeft:'10px', background:'#ef4444'}}
                                >
                                    <i className="fas fa-trash"></i> Delete Selected
                                </button>
                                )}
                            </div>
                        </div>

                        {/* Stats Cards */}
                        <div className="archive-stats">
                            <div id="archive-overview" className={`stat-card ${getHighlightClass('archive-overview')}`}>
                                <div className="stat-card__header">
                                    <span className="stat-card__dot stat-card__dot--blue"></span>
                                    <span className="stat-card__label">Total Archived Bins</span>
                                </div>
                                <div className="stat-card__value" id="statTotalArchived">{stats.archived}</div>
                            </div>

                            <div id="restored-overview" className={`stat-card ${getHighlightClass('restored-overview')}`}>
                                <div className="stat-card__header">
                                    <span className="stat-card__dot stat-card__dot--green"></span>
                                    <span className="stat-card__label">Restored Bins</span>
                                </div>
                                <div className="stat-card__value" id="statRestored">{stats.restored}</div>
                            </div>

                            {userRole === 'admin' && (
                                <div id="deleted-overview" className={`stat-card ${getHighlightClass('deleted-overview')}`}>
                                    <div className="stat-card__header">
                                        <span className="stat-card__dot stat-card__dot--red"></span>
                                        <span className="stat-card__label">Permanently Deleted</span>
                                    </div>
                                    <div className="stat-card__value" id="statDeleted">
                                        {allBins.filter(b => b.status === 'Deleted').length}
                                    </div>
                                </div>
                            )}
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
                                {userRole === 'admin' && (
                                    <button 
                                        className={`filter-tab filter-tab--deleted ${currentFilter === 'deleted' ? 'filter-tab--active' : ''}`} 
                                        onClick={() => setCurrentFilter('deleted')}
                                    >Deleted</button>
                                )}
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
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr className="loading-row">
                                            <td colSpan="8" className="loading-cell">
                                                <i className="fas fa-spinner fa-spin"></i>
                                                <span>Loading archived bins...</span>
                                            </td>
                                        </tr>
                                    ) : paginatedBins.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" style={{textAlign:'center', padding:'30px', color:'#666'}}>
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
                                                    <strong className="bin-name">{bin.binName}</strong>
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
                                                <td>
                                                    {!isDeleted && !isRestored && (
                                                        <button className="action-icon action-icon--restore" onClick={() => handleRestoreClick(bin.id)} title="Restore">
                                                            <i className="fas fa-redo"></i>
                                                        </button>
                                                    )}
                                                    {!isDeleted && userRole === 'admin' && (
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

            {/* Delete Modal - Kept minimal for this file as requested, but adding blur and outside click */}
            <div 
                className={`modal-overlay ${showDeleteModal ? 'active' : ''}`} 
                style={{
                    display: showDeleteModal ? 'flex' : 'none',
                    backdropFilter: 'blur(5px)'
                }}
                onClick={() => setShowDeleteModal(false)}
            >
                <div 
                    className="modal-dialog"
                    onClick={(e) => e.stopPropagation()}
                >
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

            {/* Restore Modal */}
            <div 
                className={`modal-overlay ${showRestoreModal ? 'active' : ''}`}
                 style={{
                    display: showRestoreModal ? 'flex' : 'none',
                    backdropFilter: 'blur(5px)'
                }}
                onClick={() => setShowRestoreModal(false)}
            >
                <div 
                    className="modal-dialog"
                    onClick={(e) => e.stopPropagation()}
                >
                     <div className="modal-icon modal-icon--restore" style={{color: '#047857', background: '#d1fae5'}}>
                        <i className="fas fa-undo"></i>
                     </div>
                     <h2 className="modal-title" style={{ fontWeight: 'bold' }}>Confirm Restore</h2>
                     <p className="modal-subtitle">
                         Are you sure you want to restore <strong className="bin-name">{allBins.find(b => b.id === binToRestore)?.binName || 'this bin'}</strong>?<br/>
                         This bin will be moved back to the active dashboard.
                     </p>
                     <div className="modal-actions">
                        <button className="modal-btn modal-btn--cancel" onClick={() => setShowRestoreModal(false)}>Cancel</button>
                        <button className="modal-btn" style={{background:'#10b981', color:'white', display:'flex', alignItems:'center', gap:'8px'}} onClick={confirmRestore}>
                            <i className="fas fa-undo"></i> Restore
                        </button>
                     </div>
                </div>
            </div>

            {/* Batch Restore Modal */}
            <div 
                className={`modal-overlay ${showBatchRestoreModal ? 'active' : ''}`}
                 style={{
                    display: showBatchRestoreModal ? 'flex' : 'none',
                    backdropFilter: 'blur(5px)'
                }}
                onClick={() => setShowBatchRestoreModal(false)}
            >
                <div 
                    className="modal-dialog"
                    onClick={(e) => e.stopPropagation()}
                >
                     <div className="modal-icon modal-icon--restore" style={{color: '#047857', background: '#d1fae5'}}>
                        <i className="fas fa-undo"></i>
                     </div>
                     <h2 className="modal-title" style={{ fontWeight: 'bold' }}>Confirm Restore</h2>
                     <p className="modal-subtitle">
                         Are you sure you want to restore <strong>{selectedBins.size} bin(s)</strong>?<br/>
                         These bins will be moved back to the active dashboard.
                     </p>
                     <div className="modal-actions">
                        <button className="modal-btn modal-btn--cancel" onClick={() => setShowBatchRestoreModal(false)}>Cancel</button>
                        <button className="modal-btn" style={{background:'#10b981', color:'white', display:'flex', alignItems:'center', gap:'8px'}} onClick={confirmBatchRestore}>
                            <i className="fas fa-undo"></i> Restore
                        </button>
                     </div>
                </div>
            </div>

            <Toast 
                message={toast.message} 
                show={toast.show} 
                type={toast.type}
                onClose={() => setToast({ ...toast, show: false })} 
            />
        </div>
    )
}
