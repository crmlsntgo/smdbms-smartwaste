import { getFirestore, collection, getDocs, doc, getDoc, query, orderBy, limit } from 'firebase/firestore'
import initFirebase from '../firebaseConfig'

// Initialize Search Index Structure
const searchIndex = {
  bins: [],
  profile: [],
  archive: { stats: [], filters: [] },
  customize: [],
  settings: [],
  dashboard: [],
  users: [],
  pages: []
}

let isInitialized = false
let currentUserId = null
let currentUserRole = 'user'

function resetIndex() {
  searchIndex.bins = []
  searchIndex.profile = []
  searchIndex.archive = { stats: [], filters: [] }
  searchIndex.customize = []
  searchIndex.settings = []
  searchIndex.dashboard = []
  searchIndex.users = []
  searchIndex.pages = []
}

export const SearchManager = {
  // Initialize and build the index
  init: async (user) => {
    if (!user) {
      resetIndex()
      isInitialized = false
      currentUserId = null
      currentUserRole = 'user'
      return searchIndex
    }

    // Return existing index if already built (soft cache)
    if (isInitialized && currentUserId === user.uid && searchIndex.bins.length > 0) return searchIndex;
    
    // Reset
    resetIndex()
    currentUserId = user.uid
    
    const app = initFirebase()
    const db = getFirestore(app)

    let totalActiveBins = 0
    let archivedCount = 0
    let restoredCount = 0
    let deletedCount = 0
    let isAdmin = false

    // Resolve role first (used to scope indexed content)
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      const role = (userDoc.exists() ? (userDoc.data().role || '') : '').toLowerCase()
      isAdmin = role === 'admin'
      currentUserRole = isAdmin ? 'admin' : 'user'
    } catch (e) {
      currentUserRole = 'user'
      isAdmin = false
    }

    // 1. Index Dashboard/Bins
    try {
      const binsRef = collection(db, 'bins')
      const binsSnap = await getDocs(query(binsRef, orderBy('createdAt', 'desc'), limit(500)))
      
      binsSnap.forEach(docSnap => {
        totalActiveBins++
        const data = docSnap.data()
        const binName = data.name || data.binName || `Bin ${docSnap.id}`
        
        searchIndex.bins.push({
          type: 'bin',
          id: docSnap.id,
          name: binName,
          title: binName,
          subtitle: `${data.location || 'Unknown Location'} • ${data.fill_level || 0}% Full`,
          page: 'dashboard', 
          path: isAdmin ? '/admin/dashboard' : '/dashboard',
          icon: 'trash',
          searchText: `${binName} ${data.location || ''} ${docSnap.id} bin waste`.toLowerCase(),
          data: data
        })
      })
    } catch (e) {
      if (e.code !== 'permission-denied') console.warn("Search Index: Dashboard access skipped:", e.message)
    }

    // 2. Index Archive & Get Counts
    try {
      const archiveRef = collection(db, 'archive')
      const archiveSnap = await getDocs(query(archiveRef, orderBy('archivedAt', 'desc'), limit(500)))
      
      archiveSnap.forEach(docSnap => {
        const data = docSnap.data()
        const status = (data.status || 'archived').toLowerCase()
        if (status === 'restored') restoredCount++
        else archivedCount++

        const name = data.name || data.binName || 'Archived Item'
        // Push recent ones to search
        if (searchIndex.archive.stats.length < 50) {
            searchIndex.archive.stats.push({
                type: 'archive',
                id: docSnap.id,
                name: name,
                title: name,
                subtitle: `Archived: ${new Date(data.archivedAt?.toDate ? data.archivedAt.toDate() : data.archivedAt).toLocaleDateString()}`,
                page: 'archive',
                path: isAdmin ? '/admin/archive' : '/archive',
                icon: 'archive',
                // Removed generic 'archive', 'history', 'restored' keywords to avoid redundancy with summary items
                searchText: `${name} ${data.location || ''}`.toLowerCase(),
                data: data,
                filter: status === 'restored' ? 'restored' : 'archived',
                adminOnly: false
            })
        }
      })
    } catch (e) {
      if (e.code !== 'permission-denied') console.warn("Search Index: Archive access skipped:", e.message)
    }

    // Fetch Deleted (Admin only)
    try {
        if (isAdmin) {
             const deletedRef = collection(db, 'deleted')
             const deletedSnap = await getDocs(deletedRef)
             deletedCount = deletedSnap.size
             
             // Index a few deleted items?
             let dCount = 0
             deletedSnap.forEach(d => {
                 if(dCount < 10) {
                     const data = d.data()
                     const name = data.name || data.binName || 'Deleted Bin'
                     searchIndex.archive.stats.push({
                        type: 'archive',
                        id: d.id,
                        name: name,
                        title: name + ' (Deleted)',
                        subtitle: 'Permanently Deleted',
                        page: 'archive',
                        path: '/admin/archive',
                        icon: 'trash',
                        searchText: `${name} ${data.location || ''} deleted`.toLowerCase(),
                        data: data,
                        filter: 'deleted',
                        adminOnly: true
                     })
                     dCount++
                 }
             })
        }
    } catch (e) { console.warn("Role check/Deleted search failed", e.message) }

    // 3. Index Users page (Admin only)
    if (isAdmin) {
      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('firstName'), limit(300)))
        usersSnap.forEach((docSnap) => {
          const data = docSnap.data()
          const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.email || 'User'
          searchIndex.users.push({
            type: 'user',
            id: docSnap.id,
            title: fullName,
            subtitle: `${data.email || 'No email'} • ${data.role || 'utility staff'}`,
            page: 'users',
            path: '/admin/users',
            icon: 'user-cog',
            searchText: `${fullName} ${data.email || ''} ${data.role || ''} user users`.toLowerCase(),
            adminOnly: true,
            data
          })
        })
      } catch (e) {
        if (e.code !== 'permission-denied') console.warn('Search Index: Users access skipped:', e.message)
      }
    }

    // 4. Index Static Pages with Counts
    indexStaticContent({
        activeBins: totalActiveBins,
        archived: archivedCount,
        restored: restoredCount,
        deleted: deletedCount,
        showDeleted: isAdmin,
        isAdmin
    })

    isInitialized = true
    return searchIndex
  },

  // Perform search
  search: (query) => {
    if (!query || query.length < 2) return []
    const qLower = query.toLowerCase()
    
    let results = []
    
    // Helper to score relevance
    const calculateRelevance = (item) => {
      let score = 0
      const text = item.searchText
      const name = item.title.toLowerCase()
      
      if (name === qLower) score += 100
      else if (name.startsWith(qLower)) score += 50
      else if (name.includes(qLower)) score += 20
      
      if (text.includes(qLower)) score += 10
      
      return score
    }

    const canView = (item) => {
      if (!item) return false
      if (item.adminOnly && currentUserRole !== 'admin') return false
      if (currentUserRole !== 'admin' && (item.page === 'users' || item.filter === 'deleted')) return false
      return true
    }

    // Search Bins
    searchIndex.bins.forEach(item => {
      if (!canView(item)) return
      const score = calculateRelevance(item)
      if (score > 0) results.push({ ...item, relevance: score })
    })

    // Search Archive
    searchIndex.archive.stats.forEach(item => {
        if (!canView(item)) return
        const score = calculateRelevance(item)
        if (score > 0) results.push({ ...item, relevance: score })
    })

    // Search Static
    const staticCategories = ['customize', 'settings', 'dashboard', 'profile', 'users', 'pages'] // keys in index
    staticCategories.forEach(cat => {
        if(Array.isArray(searchIndex[cat])){
            searchIndex[cat].forEach(item => {
                if (!canView(item)) return
                const score = calculateRelevance(item)
                if (score > 0) results.push({ ...item, relevance: score })
            })
        }
    })

    // Sort
    results.sort((a, b) => b.relevance - a.relevance)
    
    return results.slice(0, 10) // Limit to 10
  }
}

function indexStaticContent(counts = { activeBins: 0, archived: 0, restored: 0, deleted: 0, showDeleted: false, isAdmin: false }) {
  const { activeBins, archived, restored, deleted, showDeleted, isAdmin } = counts

    // 1. Customize Content
    searchIndex.customize = [
        { type: 'customize', id: 'custom-bin-list', title: 'Bin List', subtitle: `${activeBins} bins configured`, page: 'customize', path: isAdmin ? '/admin/customize' : '/customize', icon: 'list', searchText: 'bin list customize bins' },
        { type: 'customize', id: 'custom-bin-config', title: 'Bin Configuration', subtitle: 'Setup & Settings', page: 'customize', path: isAdmin ? '/admin/customize' : '/customize', icon: 'cog', searchText: 'bin configuration setup settings' },
        { type: 'customize', id: 'custom-bin-name', title: 'Bin Name', subtitle: 'Identification', page: 'customize', path: isAdmin ? '/admin/customize' : '/customize', icon: 'tag', searchText: 'bin name label identification' },
        { type: 'customize', id: 'custom-capacity', title: 'Capacity (Liters)', subtitle: 'Volume & Size', page: 'customize', path: isAdmin ? '/admin/customize' : '/customize', icon: 'weight', searchText: 'capacity liters volume size' },
        { type: 'customize', id: 'custom-serial', title: 'Bin Serial Number', subtitle: 'Device ID', page: 'customize', path: isAdmin ? '/admin/customize' : '/customize', icon: 'barcode', searchText: 'serial number identification id' },
        { type: 'customize', id: 'custom-threshold', title: 'Alert Threshold (%)', subtitle: 'Warning Level', page: 'customize', path: isAdmin ? '/admin/customize' : '/customize', icon: 'bell', searchText: 'alert threshold percentage warning level' },
        { type: 'customize', id: 'custom-location', title: 'Location', subtitle: 'Area & Place', page: 'customize', path: isAdmin ? '/admin/customize' : '/customize', icon: 'map-marker', searchText: 'location place area' },
        { type: 'customize', id: 'custom-sensor', title: 'Sensor Connection', subtitle: 'Connectivity Status', page: 'customize', path: isAdmin ? '/admin/customize' : '/customize', icon: 'wifi', searchText: 'sensor connection status connectivity' },
        { type: 'customize', id: 'custom-image', title: 'Bin Image URL', subtitle: 'Photo & Picture', page: 'customize', path: isAdmin ? '/admin/customize' : '/customize', icon: 'image', searchText: 'image url photo picture' },
        { type: 'customize', id: 'custom-info', title: 'Additional Information', subtitle: 'Details & Notes', page: 'customize', path: isAdmin ? '/admin/customize' : '/customize', icon: 'info-circle', searchText: 'additional information details notes' }
    ]
    
    // 2. Settings Content
    searchIndex.settings = [
        { type: 'settings', id: 'setting-theme', title: 'Theme', subtitle: 'Appearance Settings', page: 'settings', path: '/settings', tab: 'appearance', icon: 'palette', searchText: 'theme appearance dark light mode' },
        { type: 'settings', id: 'setting-personal', title: 'Personal Information', subtitle: 'Profile Details', page: 'settings', path: '/settings', tab: 'profile', icon: 'user', searchText: 'personal information name email contact' },
        { type: 'settings', id: 'setting-account', title: 'Account Settings', subtitle: 'Preferences', page: 'settings', path: '/settings', tab: 'profile', icon: 'cogs', searchText: 'account settings preferences' },
        { type: 'settings', id: 'setting-password', title: 'Password', subtitle: 'Security', page: 'settings', path: '/settings', tab: 'password', icon: 'key', searchText: 'password security change reset' },
        { type: 'settings', id: 'setting-archive-acc', title: 'Archive Account', subtitle: 'Danger Zone', page: 'settings', path: '/settings', tab: 'profile', icon: 'archive', searchText: 'archive account delete remove deactivate' }
    ]

    // 3. Dashboard Content
    searchIndex.dashboard = [
        { type: 'dashboard', id: 'dash-active', title: 'Active Bins', subtitle: `${activeBins} Active Bins`, page: 'dashboard', path: isAdmin ? '/admin/dashboard' : '/dashboard', icon: 'trash', searchText: 'active bins status working' },
        { type: 'dashboard', id: 'dash-fill', title: 'Fill Level', subtitle: 'Capacity Statistics', page: 'dashboard', path: isAdmin ? '/admin/dashboard' : '/dashboard', icon: 'chart-bar', searchText: 'fill level capacity percentage' },
        { type: 'dashboard', id: 'dash-empty', title: 'Bins Requiring Emptying', subtitle: 'Dashboard Widget', page: 'dashboard', path: isAdmin ? '/admin/dashboard' : '/dashboard', icon: 'exclamation-triangle', searchText: 'bins requiring emptying full alert' },
        { type: 'dashboard', id: 'dash-total', title: 'Total Bins', subtitle: `${activeBins} Total Bins`, page: 'dashboard', path: isAdmin ? '/admin/dashboard' : '/dashboard', icon: 'boxes', searchText: 'total bins count' },
        { type: 'dashboard', id: 'dash-waste', title: 'Waste Overview', subtitle: 'Distribution Chart', page: 'dashboard', path: isAdmin ? '/admin/dashboard' : '/dashboard', icon: 'chart-pie', searchText: 'waste overview distribution chart' },
        { type: 'dashboard', id: 'dash-waste-dist', title: 'Waste Distribution', subtitle: 'Type Analysis', page: 'dashboard', path: isAdmin ? '/admin/dashboard' : '/dashboard', icon: 'pie-chart', searchText: 'waste distribution recyclable biodegradable' },
        { type: 'dashboard', id: 'dash-maint', title: 'Maintenance Schedule', subtitle: 'Calendar', page: 'dashboard', path: isAdmin ? '/admin/dashboard' : '/dashboard', icon: 'calendar', searchText: 'maintenance schedule cleaning' },
        { type: 'dashboard', id: 'dash-haz', title: 'Hazardous Waste', subtitle: 'Safety Alert', page: 'dashboard', path: isAdmin ? '/admin/dashboard' : '/dashboard', icon: 'radiation', searchText: 'hazardous waste alert detection' }
    ]

      // 4. Profile Content
      searchIndex.profile = [
        { type: 'profile', id: 'profile-overview', title: 'Profile', subtitle: 'User profile overview', page: 'profile', path: '/profile', icon: 'user', searchText: 'profile account user information' }
      ]

      // 5. Public pages
      searchIndex.pages = [
        { type: 'page', id: 'page-product', title: 'Product', subtitle: 'Product page', page: 'product', path: '/product', icon: 'boxes', searchText: 'product features bins system' },
        { type: 'page', id: 'page-solutions', title: 'Solutions', subtitle: 'Solutions page', page: 'solutions', path: '/solutions', icon: 'chart-pie', searchText: 'solutions industries waste management' },
        { type: 'page', id: 'page-support', title: 'Support', subtitle: 'Support and help', page: 'support', path: '/support', icon: 'info-circle', searchText: 'support help contact faq' }
      ]

    // 4. Archive Overview
    searchIndex.archive.stats.push({
        type: 'archive',
        id: 'archive-overview',
        name: 'Total Archived Bins',
        title: 'Total Archived Bins',
        subtitle: `${archived} items archived`,
        page: 'archive',
        path: isAdmin ? '/admin/archive' : '/archive',
        filter: 'archived',
        icon: 'archive',
        searchText: 'total archived bins history count',
        disableSearchFilter: true,
        adminOnly: false,
        data: {}
    })
    
    // Restored Bins
    searchIndex.archive.stats.push({
        type: 'archive',
        id: 'restored-overview',
        name: 'Restored Bins',
        title: 'Restored Bins',
        subtitle: `${restored} items restored`,
        page: 'archive',
        path: isAdmin ? '/admin/archive' : '/archive',
        filter: 'restored',
        icon: 'archive',
        searchText: 'restored bins history recovered',
        disableSearchFilter: true,
        adminOnly: false,
        data: {}
    })

    // Deleted Bins (if admin)
    
    if (counts.showDeleted || deleted > 0) {
        searchIndex.archive.stats.push({
            type: 'archive',
            id: 'deleted-overview',
            name: 'Permanently Deleted',
            title: 'Permanently Deleted',
            subtitle: `${deleted} items deleted`,
            page: 'archive',
            path: '/admin/archive',
            filter: 'deleted',
            icon: 'trash',
            searchText: 'permanently deleted bins remove',
            disableSearchFilter: true,
            adminOnly: true,
            data: {}
        })
    }

        // 6. Admin-only pages
        if (isAdmin) {
          searchIndex.pages.push(
            { type: 'page', id: 'page-users', title: 'Users', subtitle: 'User management', page: 'users', path: '/admin/users', icon: 'users', searchText: 'users user management admin', adminOnly: true },
            { type: 'page', id: 'page-admin-dashboard', title: 'Admin Dashboard', subtitle: 'Administrative overview', page: 'dashboard', path: '/admin/dashboard', icon: 'chart-bar', searchText: 'admin dashboard overview bins', adminOnly: true },
            { type: 'page', id: 'page-admin-archive', title: 'Admin Archive', subtitle: 'Archived and deleted bins', page: 'archive', path: '/admin/archive', icon: 'archive', searchText: 'admin archive deleted bins', adminOnly: true },
            { type: 'page', id: 'page-admin-customize', title: 'Admin Customize', subtitle: 'Configure bins', page: 'customize', path: '/admin/customize', icon: 'cog', searchText: 'admin customize bin configuration', adminOnly: true }
          )
        }
}
