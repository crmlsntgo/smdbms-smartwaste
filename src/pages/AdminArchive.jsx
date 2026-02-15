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
    setDoc,
    onSnapshot
} from 'firebase/firestore'
import initFirebase from '../firebaseConfig'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import Toast from '../components/Toast'
import { notifyBinChange } from '../utils/syncManager'
import '../styles/vendor/dashboard-style.css'
import '../styles/vendor/header.css'
import '../styles/vendor/archive.css'
import '../styles/vendor/modal.css'
import { cleanupExpiredDeletedBins, cleanupExpiredRestoredBins } from '../utils/cleanupExpiredDeletedBins'

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
    const [binToRestore, setBinToRestore] = useState(null)
    const [showRestoreModal, setShowRestoreModal] = useState(false)
    const [showBatchRestoreModal, setShowBatchRestoreModal] = useState(false)
    const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false)
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

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
        
        // Metadata Sync (Real-time updates)
        const unsubMeta = onSnapshot(doc(db, 'settings', 'binMetadata'), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (['delete', 'restore', 'archive', 'create'].includes(data.lastAction)) {
                    loadAllData(db);
                }
            }
        });

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

        return () => {
             unsubMeta()
             unsubscribe()
        }
    }, [])

    // Polling for expired deleted bins
    useEffect(() => {
        const interval = setInterval(async () => {
             // 1. Deleted Bins Cleanup
             const resultDeleted = await cleanupExpiredDeletedBins()
             
             // 2. Restored Bins Cleanup
             const resultRestored = await cleanupExpiredRestoredBins()

             if ((resultDeleted && resultDeleted.deleted > 0) || (resultRestored && resultRestored.deleted > 0)) {
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

                // Restore to bins (active)
                tx.set(binRef, restoreData)

                // Update archive record
                tx.update(archiveRef, {
                    status: 'Restored',
                    restoredAt: serverTimestamp(),
                    modifiedBy: userName
                })
            })

            // Update local state
            setAllBins(prev => prev.map(b => b.id === id ? { ...b, status: 'Restored', modifiedBy: userName } : b))
            setToast({ show: true, message: "Bin restored successfully. 1 Day expired.", type: 'success' })
            setShowRestoreModal(false)

            notifyBinChange(db, 'restore', id)

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

         // Check if any deleted bin is selected
         let hasDeleted = false
         selectedBins.forEach(id => {
             const bin = allBins.find(b => b.id === id)
             if (bin && bin.status === 'Deleted') hasDeleted = true
         })

         if (hasDeleted) {
             setToast({ show: true, message: "Can't be restored, the bin is deleted", type: 'error' })
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
             let count = 0

             selectedBins.forEach(id => {
                const bin = allBins.find(b => b.id === id)
                if (bin && bin.status !== 'Restored' && bin.status !== 'Deleted') {
                    const archiveRef = doc(db, 'archive', id)
                    const binRef = doc(db, 'bins', id)

                    // Helper to remove UI-specific derived fields and potentially invalid dates
                    const { 
                        lastActive, 
                        archivedAt, 
                        id: _id, // Remove id
                        binId,   // Remove derived binId (original fields like serial usually exist)
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
                    batch.update(archiveRef, { status: 'Restored', restoredAt: serverTimestamp(), modifiedBy: userName })
                    count++
                }
             })

             if (count > 0) await batch.commit()
             
             setAllBins(prev => prev.map(b => selectedBins.has(b.id) && b.status !== 'Deleted' ? { ...b, status: 'Restored', modifiedBy: userName } : b))
             setSelectedBins(new Set())
             setToast({ show: true, message: `${count} bins restored.`, type: 'success' })
             
             notifyBinChange(db, 'restore', Array.from(selectedBins))
             setShowBatchRestoreModal(false)

         } catch (error) {
             console.error("Batch restore failed", error)
             setShowBatchRestoreModal(false)
             alert('Batch restore failed.')
         }
    }

    const handleDeleteSelected = async () => {
        if (selectedBins.size === 0) return

        // 1. Validation: Prevent deleting 'Restored' bins
        let hasRestored = false
        selectedBins.forEach(id => {
            const bin = allBins.find(b => b.id === id)
            if (bin && bin.status === 'Restored') hasRestored = true
        })

        if (hasRestored) {
            setToast({ show: true, message: "Can't be deleted the bins is restored. Go to customize page to customize the bin.", type: 'error' })
            return
        }

        setShowBatchDeleteModal(true)
    }

    const confirmBatchDelete = async () => {
        try {
            const app = initFirebase()
            const db = getFirestore(app)
            const auth = getAuth(app)
            const userName = await getUserName(auth, db)
            
            const promises = []

            for (const id of selectedBins) {
                const bin = allBins.find(b => b.id === id)
                if (!bin) continue

                if (bin.status === 'Deleted') {
                    // Logic 2: "Permanent Delete" for already deleted bins
                    const deletedRef = doc(db, 'deleted', id)
                    promises.push(deleteDoc(deletedRef))
                    
                    // Logic 3: Delete Serial Number
                    if (bin.serial) {
                        const serialRef = doc(db, 'serials', bin.serial)
                        // Using separate transactions inside loop is inefficient but serials are likely one-off docs?
                        // Or just fire-and-forget delete
                        promises.push(deleteDoc(serialRef))
                        // Also check 'settings/serials' or wherever it was? 
                        // The codebase previously used `doc(db, 'serials', serial)` for archiving.
                    }
                } else {
                    // Logic 4: Archive -> Deleted (Soft Delete)
                    const safeData = JSON.parse(JSON.stringify(bin))
                    if (safeData.id) delete safeData.id

                    promises.push(
                        addDoc(collection(db, 'deleted'), {
                            ...safeData,
                            deletedAt: serverTimestamp(),
                            deletedBy: auth.currentUser?.email || 'Admin',
                            modifiedBy: userName,
                            originalId: id,
                            autoDeleteAfter: new Date(Date.now() + 60 * 1000)
                        }),
                        deleteDoc(doc(db, 'archive', id))
                    )
                }
            }

            await Promise.all(promises)
            
            // Local State Update
            setAllBins(prev => {
                // If soft deleted -> move to deleted tab (status update)
                // If permanent deleted -> remove from list
                const nextState = []
                prev.forEach(b => {
                    if (selectedBins.has(b.id)) {
                        if (b.status === 'Deleted') {
                           // Permanent delete: Exclude from state
                           return
                        } else {
                           // Soft delete: Update Status
                           nextState.push({
                               ...b,
                               status: 'Deleted',
                               archivedAt: new Date(),
                               modifiedBy: userName
                           })
                        }
                    } else {
                        nextState.push(b)
                    }
                })
                return nextState.sort((a,b) => (b.archivedAt || 0) - (a.archivedAt || 0))
            })

            const deletedCount = selectedBins.size
            setSelectedBins(new Set())
            setToast({ show: true, message: `${deletedCount} bins deleted.`, type: 'delete' })

            notifyBinChange(db, 'delete', Array.from(selectedBins))
            setShowBatchDeleteModal(false)
            
        } catch (error) {
             console.error("Batch delete failed", error)
             setShowBatchDeleteModal(false)
             setToast({ show: true, message: 'Batch delete failed.', type: 'error' })
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

            if (binData.status === 'Deleted') {
                 // Hard Delete Logic
                 await deleteDoc(doc(db, 'deleted', binToDelete))
                 if (binData.serial) {
                     await deleteDoc(doc(db, 'serials', binData.serial))
                 }
                 
                 setAllBins(prev => prev.filter(b => b.id !== binToDelete))
                 setShowDeleteModal(false)
                 setBinToDelete(null)
                 setToast({ show: true, message: `The ${binData.binName || 'bin'} is permanently deleted.`, type: 'delete' })
                 
                 notifyBinChange(db, 'delete', binToDelete)

                 return
            }
            
            const safeData = JSON.parse(JSON.stringify(binData)) 
            if (safeData.id) delete safeData.id 

            // Add to Deleted
            await addDoc(collection(db, 'deleted'), {
                ...safeData,
                deletedAt: serverTimestamp(),
                deletedBy: auth.currentUser?.email || 'Admin',
                modifiedBy: userName,
                originalId: binToDelete,
                autoDeleteAfter: new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day (for testing)
            })

            // Delete from Archive
            await deleteDoc(doc(db, 'archive', binToDelete))
            
            // Update local state to Deleted
            const deletedItem = {
                ...binData,
                status: 'Deleted',
                archivedAt: new Date(),
                modifiedBy: userName
            }
            
            setAllBins(prev => {
                const filtered = prev.filter(b => b.id !== binToDelete)
                return [...filtered, deletedItem].sort((a,b) => (b.archivedAt || 0) - (a.archivedAt || 0))
            })

            setShowDeleteModal(false)
            setBinToDelete(null)
            setToast({ show: true, message: `The ${binData.binName} is deleted. Expired after 1 minute`, type: 'delete' })
            
            notifyBinChange(db, 'delete', binToDelete)

        } catch (error) {
            console.error("Delete failed", error)
            setToast({ show: true, message: "Delete failed.", type: 'error' })
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
                                <button 
                                    className="archive-restore-btn" 
                                    onClick={handleDeleteSelected} 
                                    disabled={selectedBins.size === 0} 
                                    style={{marginLeft:'10px', background:'#ef4444'}}
                                >
                                    <i className="fas fa-trash"></i> Delete Selected
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
                                    <span className="stat-card__dot stat-card__dot--green"></span>
                                    <span className="stat-card__label">Restored Bins</span>
                                </div>
                                <div className="stat-card__value" id="statRestored">{stats.restored}</div>
                            </div>

                            <div className="stat-card">
                                <div className="stat-card__header">
                                    <span className="stat-card__dot stat-card__dot--red"></span>
                                    <span className="stat-card__label">Permanently Deleted</span>
                                </div>
                                <div className="stat-card__value" id="statDeleted">{stats.deleted}</div>
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
                                                <td>{bin.archivedByName || 'System'}</td>
                                                <td>{bin.modifiedBy || 'N/A'}</td>
                                                <td>
                                                    {!isDeleted && !isRestored && (
                                                        <button className="action-icon action-icon--restore" onClick={() => handleRestoreClick(bin.id)} title="Restore">
                                                            <i className="fas fa-redo"></i>
                                                        </button>
                                                    )}
                                                    {!isDeleted && !isRestored && (
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
            <div 
                className={`modal-overlay ${showDeleteModal ? 'active' : ''}`} 
                style={{
                    display: showDeleteModal ? 'flex' : 'none',
                    backdropFilter: 'blur(5px)' // Background blur
                }}
                onClick={() => setShowDeleteModal(false)} // Close on click outside
            >
                <div 
                    className="modal-dialog" 
                    onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside
                >
                    <div className="modal-icon modal-icon--delete" style={{color: '#d32f2f', background: '#ffebee'}}>
                         <i className="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2 className="modal-title" style={{ fontWeight: 'bold' }}>Confirm Deletion</h2>
                    <p className="modal-subtitle">
                        Are you sure you want to permanently delete <strong>{allBins.find(b => b.id === binToDelete)?.binName || 'this bin'}</strong>?<br/>
                        This action cannot be undone.
                    </p>
                    <div className="modal-actions">
                        <button className="modal-btn modal-btn--cancel" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                        <button className="modal-btn" style={{background:'#d32f2f', color:'white', display:'flex', alignItems:'center', gap:'8px'}} onClick={confirmDelete}>
                            <i className="fas fa-trash-alt"></i> Delete Permanently
                        </button>
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

            {/* Batch Delete Modal */}
            <div 
                className={`modal-overlay ${showBatchDeleteModal ? 'active' : ''}`} 
                style={{
                    display: showBatchDeleteModal ? 'flex' : 'none',
                    backdropFilter: 'blur(5px)'
                }}
                onClick={() => setShowBatchDeleteModal(false)}
            >
                <div 
                    className="modal-dialog"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="modal-icon modal-icon--delete" style={{color: '#d32f2f', background: '#ffebee'}}>
                         <i className="fas fa-exclamation-triangle"></i>
                    </div>
                    <h2 className="modal-title" style={{ fontWeight: 'bold' }}>Confirm Deletion</h2>
                    
                    <div className="modal-subtitle" style={{marginBottom: '20px'}}>
                        <p>Are you sure you want to permanently delete these <strong>{selectedBins.size}</strong> bins?</p>
                        <div style={{
                            maxHeight: '150px', 
                            overflowY: 'auto', 
                            background: '#f8fafc', 
                            padding: '10px', 
                            borderRadius: '6px', 
                            marginTop: '10px',
                            textAlign: 'left',
                            border: '1px solid #e2e8f0'
                        }}>
                             {Array.from(selectedBins).map(id => {
                                 const bin = allBins.find(b => b.id === id)
                                 return (
                                     <div key={id} style={{fontSize: '13px', padding: '4px 0', borderBottom: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px'}}>
                                         <i className="fas fa-trash-alt" style={{color: '#ef4444', fontSize: '12px'}}></i>
                                         <span>{bin?.binName || 'Unknown Bin'}</span>
                                     </div>
                                 )
                             })}
                        </div>
                        <p style={{marginTop: '10px', fontSize: '13px', color: '#64748b'}}>This action cannot be undone.</p>
                    </div>

                    <div className="modal-actions">
                        <button className="modal-btn modal-btn--cancel" onClick={() => setShowBatchDeleteModal(false)}>Cancel</button>
                        <button className="modal-btn" style={{background:'#d32f2f', color:'white', display:'flex', alignItems:'center', gap:'8px'}} onClick={confirmBatchDelete}>
                            <i className="fas fa-trash-alt"></i> Delete Permanently
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
