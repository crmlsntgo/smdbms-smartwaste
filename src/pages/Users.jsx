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
    if(!confirm(`Are you sure you want to delete ${selectedUser.firstName}? This action cannot be undone.`)) return

    try {
        const app = initFirebase()
        const db = getFirestore(app)
        
        // Delete from 'users' collection
        await deleteDoc(doc(db, 'users', selectedUser.uid))
        
        // Note: For 'usernames' collection update, we'd need the username.
        // Assuming we have username in user object or fetch it.
        // Legacy code implies standard Firebase Auth deletion handles auth, 
        // but Firestore data needs manual cleanup.
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
           <div className="modal" style={{display: 'flex'}}>
               <div className="modal-content user-modal-content" style={{maxWidth:'500px'}}>
                   <div className="modal-header">
                       <h3>User Details</h3>
                       <button className="modal-close" onClick={() => setSelectedUser(null)}>
                           <i className="fas fa-times"></i>
                       </button>
                   </div>
                   <div className="modal-body">
                       <div style={{textAlign:'center', marginBottom:'20px'}}>
                            <div className="avatar-circle" style={{
                                width:'80px', height:'80px', fontSize:'28px', margin:'0 auto',
                                backgroundColor: getAvatarColor(selectedUser.uid)
                            }}>
                                {getInitials(selectedUser.firstName, selectedUser.lastName)}
                            </div>
                            <h2 style={{marginTop:'10px', fontSize:'20px'}}>{selectedUser.firstName} {selectedUser.lastName}</h2>
                            <p style={{color:'#666'}}>{selectedUser.email}</p>
                       </div>
                       
                       <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'20px'}}>
                           <div>
                               <label style={{fontSize:'12px', color:'#888'}}>Role</label>
                               <div style={{fontWeight:'500'}}>{selectedUser.role || 'Utility Staff'}</div>
                           </div>
                           <div>
                               <label style={{fontSize:'12px', color:'#888'}}>Username</label>
                               <div style={{fontWeight:'500'}}>{selectedUser.username || 'N/A'}</div>
                           </div>
                           <div>
                               <label style={{fontSize:'12px', color:'#888'}}>Phone</label>
                               <div style={{fontWeight:'500'}}>{selectedUser.phone || 'N/A'}</div>
                           </div>
                            <div>
                               <label style={{fontSize:'12px', color:'#888'}}>Address</label>
                               <div style={{fontWeight:'500'}}>{selectedUser.address || 'N/A'}</div>
                           </div>
                       </div>
                       
                       <div style={{borderTop:'1px solid #eee', paddingTop:'15px', display:'flex', justifyContent:'flex-end', gap:'10px'}}>
                           <button 
                                className="config-btn config-btn--danger" 
                                onClick={handleDeleteUser}
                                style={{background:'#ef4444', color:'white', border:'none', padding:'8px 16px', borderRadius:'4px'}}
                            >
                               <i className="fas fa-trash"></i> Remove User
                           </button>
                           <button 
                                className="config-btn" 
                                onClick={() => setSelectedUser(null)}
                                style={{background:'#f3f4f6', border:'none', padding:'8px 16px', borderRadius:'4px'}}
                            >
                               Close
                           </button>
                       </div>
                   </div>
               </div>
           </div>
       )}
    </div>
  )
}
