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
    doc, 
    getDoc, 
    deleteDoc, 
    setDoc
} from 'firebase/firestore'
import initFirebase from '../firebaseConfig'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import '../styles/vendor/dashboard-style.css'
import '../styles/vendor/header.css'
import '../styles/vendor/admin-users.css'
import '../styles/vendor/modal.css' // Reusing common modal styles

export default function Users() {
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastDoc, setLastDoc] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [sortConfig, setSortConfig] = useState({ key: 'firstName', direction: 'asc' })
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loadMoreLoading, setLoadMoreLoading] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState(null)
  
  const USERS_PAGE_SIZE = 50

  useEffect(() => {
    const app = initFirebase()
    const auth = getAuth(app)
    const db = getFirestore(app)

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
        if (u) {
            // Check current user role
            const uDoc = await getDoc(doc(db, 'users', u.uid))
            if (uDoc.exists()) setCurrentUserRole(uDoc.data().role)
                
            loadUsers(db, true)
        } else {
             window.location.href = '/login'
        }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
      filterAndSortUsers()
  }, [users, searchTerm, roleFilter, sortConfig])

  const loadUsers = async (db, reset = false) => {
      if (reset) setLoading(true)
      else setLoadMoreLoading(true)

      try {
          const usersCol = collection(db, 'users')
          let q = query(usersCol, orderBy('firstName'), limit(USERS_PAGE_SIZE))
          
          if (!reset && lastDoc) {
              q = query(usersCol, orderBy('firstName'), startAfter(lastDoc), limit(USERS_PAGE_SIZE))
          }
          
          const snapshot = await getDocs(q)
          const newUsers = []
          snapshot.forEach(docSnap => {
              newUsers.push({ uid: docSnap.id, ...docSnap.data() })
          })

          if (reset) {
              setUsers(newUsers)
          } else {
              setUsers(prev => [...prev, ...newUsers])
          }

          setLastDoc(snapshot.docs[snapshot.docs.length - 1])
          setHasMore(snapshot.docs.length === USERS_PAGE_SIZE)

      } catch (error) {
          console.error("Error loading users:", error)
      } finally {
          setLoading(false)
          setLoadMoreLoading(false)
      }
  }

  const filterAndSortUsers = () => {
      let result = [...users]
      
      // Filter by Role
      if (roleFilter) {
          result = result.filter(u => (u.role || 'utility staff').toLowerCase() === roleFilter.toLowerCase())
      }

      // Search
      if (searchTerm) {
          const lower = searchTerm.toLowerCase()
          result = result.filter(u => 
              (u.firstName && u.firstName.toLowerCase().includes(lower)) ||
              (u.lastName && u.lastName.toLowerCase().includes(lower)) ||
              (u.email && u.email.toLowerCase().includes(lower))
          )
      }

      // Sort
      result.sort((a, b) => {
          let valA = '', valB = ''
          if (sortConfig.key === 'name') {
              valA = `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase()
              valB = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase()
          } else {
              valA = (a[sortConfig.key] || '').toString().toLowerCase()
              valB = (b[sortConfig.key] || '').toString().toLowerCase()
          }
          
          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1
          return 0
      })

      setFilteredUsers(result)
  }

  const handleSort = (key) => {
      setSortConfig(prev => ({
          key,
          direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
      }))
  }

  const handleSelectAll = (e) => {
      if (e.target.checked) {
          setSelectedIds(new Set(filteredUsers.map(u => u.uid)))
      } else {
          setSelectedIds(new Set())
      }
  }

  const handleSelectOne = (uid) => {
      const newSet = new Set(selectedIds)
      if (newSet.has(uid)) newSet.delete(uid)
      else newSet.add(uid)
      setSelectedIds(newSet)
  }

  const getInitials = (firstName, lastName) => {
      return `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase() || '?'
  }

  const getAvatarColor = (uid) => {
      const colors = ['#027a64', '#1976d2', '#7b1fa2', '#c2185b', '#d32f2f', '#f57c00', '#388e3c', '#0097a7']
      return colors[(uid || '').charCodeAt(0) % colors.length]
  }
  
  // Action Handlers
  const handleViewDetails = (user) => {
      setSelectedUser(user)
  }

  const handleDeleteUser = async () => {
    if(!selectedUser) return
    
    // Close modal first
    setShowDeleteConfirm(false)

    try {
        const app = initFirebase()
        const db = getFirestore(app)
        
        // Delete from 'users' collection
        await deleteDoc(doc(db, 'users', selectedUser.uid))
        
        if (selectedUser.username) {
             await deleteDoc(doc(db, 'usernames', selectedUser.username))
        }

        // Optimistic UI update
        setUsers(prev => prev.filter(u => u.uid !== selectedUser.uid))
        setSelectedUser(null)
        alert('User deleted successfully.')

    } catch (e) {
        console.error("Delete failed", e)
        alert('Failed to delete user.')
    }
  }

  const handleOpenDeleteConfirm = () => {
      setShowDeleteConfirm(true)
  }

  const handleCloseDeleteConfirm = () => {
        setShowDeleteConfirm(false)
  }
  
  const formatDate = (date) => {
      if (!date) return 'N/A'
      // Handle firestore timestamp
      if (typeof date.toDate === 'function') {
          return date.toDate().toLocaleString()
      }
      return new Date(date).toLocaleString()
  }

  return (
    <div>
      <Header />
      <div className="dashboard-wrapper">
        <Sidebar link="users" /> {/* Pass active link prop */}
        
        <main className="main-content">
          <div className="users-content dashboard-content">
            {/* Header Section */}
            <div className="users-header">
                <div className="users-title-section">
                    <h2 className="users-title">All Users</h2>
                    <span className="users-count" id="userCount">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</span>
                </div>
            </div>

            {/* Search and Filter Section */}
            <div className="users-controls">
                <div className="search-box">
                    <i className="fas fa-search"></i>
                    <input 
                        type="text" 
                        placeholder="Search users..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-section">
                    <i className="fas fa-filter filter-icon"></i>
                    <span className="filter-label">Filter by:</span>
                    <div className="filter-dropdown">
                        <select 
                            className="filter-select"
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                        >
                            <option value="">All Roles</option>
                            <option value="admin">Admin</option>
                            <option value="utility staff">Utility Staff</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="users-table-container">
                <table className="users-table">
                    <thead>
                        <tr>
                            <th className="checkbox-col">
                                <input 
                                    type="checkbox" 
                                    checked={filteredUsers.length > 0 && selectedIds.size === filteredUsers.length}
                                    onChange={handleSelectAll}
                                />
                            </th>
                            <th className="sortable" onClick={() => handleSort('name')} style={{cursor:'pointer'}}>
                                Name <i className={`fas fa-sort${sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '-up' : '-down') : ''}`}></i>
                            </th>
                            <th>Email</th>
                            <th>Role</th>
                            <th className="actions-col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr className="loading-row">
                                <td colSpan="6" className="loading-cell">
                                    <i className="fas fa-spinner fa-spin"></i>
                                    <span>Loading users...</span>
                                </td>
                            </tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan="6" style={{padding:'20px', textAlign:'center'}}>No users found</td></tr>
                        ) : (
                            filteredUsers.map(user => {
                                const roleClass = (user.role || 'utility staff').toLowerCase().replace(/\s+/g, '-')
                                    .replace('utility_staff', 'utility-staff') // handle generic
                                return (
                                    <tr key={user.uid}>
                                        <td className="checkbox-col">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedIds.has(user.uid)} 
                                                onChange={() => handleSelectOne(user.uid)}
                                            />
                                        </td>
                                        <td>
                                            <div className="user-avatar">
                                                <div className="avatar-circle" style={{backgroundColor: getAvatarColor(user.uid)}}>
                                                    {getInitials(user.firstName, user.lastName)}
                                                </div>
                                                <span className="user-name-text">{user.firstName} {user.lastName}</span>
                                            </div>
                                        </td>
                                        <td>{user.email}</td>
                                        <td>
                                            <span className={`role-badge ${roleClass === 'utility-staff' ? 'utility-staff' : roleClass}`}>
                                                {user.role || 'Utility Staff'}
                                            </span>
                                        </td>
                                        <td className="actions-col">
                                            <button className="actions-btn" onClick={() => handleViewDetails(user)} title="View Details">
                                                <i className="fas fa-ellipsis-v"></i>
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Load More Button */}
            {hasMore && !loading && (
                <div style={{textAlign:'center', marginTop:'15px'}}>
                    <button 
                        className="config-btn config-btn--primary" 
                        onClick={() => {
                            const app = initFirebase()
                            const db = getFirestore(app)
                            loadUsers(db, false)
                        }}
                        disabled={loadMoreLoading}
                    >
                        {loadMoreLoading ? 'Loading...' : 'Load more users'}
                    </button>
                </div>
            )}
          </div>
        </main>
      </div>

       {/* User Details Modal */}
       {selectedUser && (
           <div className={`modal ${selectedUser ? 'active' : ''}`} style={{display: 'flex', zIndex: 1000}}>
               <div className="modal-content user-modal-content" style={{
                   maxWidth:'550px', 
                   padding:'24px', 
                   borderRadius:'8px',
                   fontFamily: "'Inter', sans-serif",
                   overflow: 'hidden'
               }}>
                   <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px'}}>
                       <h3 style={{fontSize:'20px', fontWeight:'700', margin:'0'}}>User Details</h3>
                       <button className="modal-close" onClick={() => setSelectedUser(null)} style={{background:'none', border:'none', fontSize:'24px', color:'#9ca3af', cursor:'pointer'}}>×</button>
                   </div>
                   
                   <div className="modal-body" style={{borderTop:'1px solid #f3f4f6'}}>
                       
                       <div style={{display:'flex', justifyContent:'space-between', padding:'16px 0', borderBottom:'1px solid #f3f4f6'}}>
                           <span style={{color:'#6b7280', fontSize:'14px', fontWeight:'600'}}>Full Name:</span>
                           <span style={{color:'#111827', fontSize:'14px'}}>{selectedUser.firstName} {selectedUser.lastName}</span>
                       </div>

                       <div style={{display:'flex', justifyContent:'space-between', padding:'16px 0', borderBottom:'1px solid #f3f4f6'}}>
                           <span style={{color:'#6b7280', fontSize:'14px', fontWeight:'600'}}>Email:</span>
                           <span style={{color:'#111827', fontSize:'14px'}}>{selectedUser.email}</span>
                       </div>

                       <div style={{display:'flex', justifyContent:'space-between', padding:'16px 0', borderBottom:'1px solid #f3f4f6'}}>
                           <span style={{color:'#6b7280', fontSize:'14px', fontWeight:'600'}}>Identifier:</span>
                           <span style={{color:'#111827', fontSize:'14px'}}>{selectedUser.username || 'N/A'}</span>
                       </div>

                       <div style={{display:'flex', justifyContent:'space-between', padding:'16px 0', borderBottom:'1px solid #f3f4f6'}}>
                           <span style={{color:'#6b7280', fontSize:'14px', fontWeight:'600'}}>Role:</span>
                           <span style={{color:'#111827', fontSize:'14px'}}>{selectedUser.role || 'utility staff'}</span>
                       </div>

                       <div style={{display:'flex', justifyContent:'space-between', padding:'16px 0', borderBottom:'1px solid #f3f4f6'}}>
                           <span style={{color:'#6b7280', fontSize:'14px', fontWeight:'600'}}>Created:</span>
                           <span style={{color:'#111827', fontSize:'14px'}}>{formatDate(selectedUser.createdAt)}</span>
                       </div>

                       <div style={{display:'flex', justifyContent:'space-between', padding:'16px 0', borderBottom:'1px solid #f3f4f6'}}>
                           <span style={{color:'#6b7280', fontSize:'14px', fontWeight:'600'}}>Address:</span>
                           <span style={{color:'#111827', fontSize:'14px', textAlign: 'right', maxWidth: '60%'}}>{selectedUser.address || 'N/A'}</span>
                       </div>
                       
                       <div style={{marginTop:'32px'}}>
                           <button 
                                onClick={handleOpenDeleteConfirm}
                                style={{
                                    width: '100%',
                                    background:'#dc2626', 
                                    color:'white', 
                                    border:'none', 
                                    padding:'12px', 
                                    borderRadius:'6px',
                                    fontSize:'16px',
                                    fontWeight:'600',
                                    cursor:'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                               <i className="fas fa-trash-alt"></i> Remove User
                           </button>
                       </div>
                   </div>
               </div>
           </div>
       )}

       {/* Delete Confirmation Modal */}
       {showDeleteConfirm && selectedUser && (
           <div className="modal active" style={{display: 'flex', zIndex: 1100, alignItems:'center', justifyContent:'center'}}>
               <div className="modal-content" style={{
                   maxWidth:'400px', 
                   padding:'32px', 
                   borderRadius:'16px', 
                   textAlign:'center',
                   fontFamily: "'Inter', sans-serif"
               }}>
                   <div style={{
                       width: '64px',
                       height: '64px',
                       borderRadius: '50%',
                       background: '#fee2e2',
                       color: '#dc2626',
                       fontSize: '24px',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center',
                       margin: '0 auto 24px auto'
                   }}>
                       <i className="fas fa-times"></i>
                   </div>
                   
                   <h3 style={{fontSize:'24px', fontWeight:'700', color:'#111827', margin:'0 0 12px 0'}}>Delete member</h3>
                   
                   <p style={{color:'#6b7280', fontSize:'16px', margin:'0 0 24px 0', lineHeight:'1.5'}}>
                       Are you sure you want to permanently remove <br/>
                       <strong>'{selectedUser.firstName} {selectedUser.lastName}'</strong>?
                   </p>
                   
                   <div style={{background:'#f9fafb', padding:'16px', borderRadius:'8px', margin:'0 0 24px 0', textAlign:'left'}}>
                       <p style={{color:'#374151', fontSize:'14px', fontWeight:'500', margin:'0 0 8px 0', textAlign:'center'}}>This will delete</p>
                       <ul style={{margin:0, padding:'0 0 0 20px', color:'#6b7280', fontSize:'14px', listStyleType:'none', textAlign:'center'}}>
                           <li>- User account</li>
                           <li>- User data from database</li>
                           <li>- Username mapping</li>
                       </ul>
                   </div>
                   
                   <p style={{color:'#6b7280', fontSize:'14px', margin:'0 0 24px 0'}}>This action cannot be undone.</p>
                   
                   <div style={{display:'flex', gap:'12px'}}>
                       <button 
                           onClick={handleDeleteUser}
                           style={{
                               flex: 1,
                               background:'#ef4444', 
                               color:'white', 
                               border:'none', 
                               padding:'12px', 
                               borderRadius:'8px',
                               fontSize:'16px',
                               fontWeight:'600',
                               cursor:'pointer'
                           }}
                       >
                           Confirm
                       </button>
                       <button 
                           onClick={handleCloseDeleteConfirm}
                           style={{
                               flex: 1,
                               background:'#f3f4f6', 
                               color:'#374151', 
                               border:'1px solid #e5e7eb',
                               padding:'12px', 
                               borderRadius:'8px',
                               fontSize:'16px',
                               fontWeight:'600',
                               cursor:'pointer'
                           }}
                       >
                           Cancel
                       </button>
                   </div>
               </div>
           </div>
       )}
    </div>
  )
}
