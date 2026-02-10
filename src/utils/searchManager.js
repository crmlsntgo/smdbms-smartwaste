import { getFirestore, collection, getDocs, doc, getDoc, query, orderBy, limit } from 'firebase/firestore'
import initFirebase from '../firebaseConfig'

// Initialize Search Index Structure
const searchIndex = {
  bins: [],
  profile: {},
  archive: { stats: [], filters: [] },
  customize: [],
  settings: [],
  dashboard: []
}

let isInitialized = false

export const SearchManager = {
  // Initialize and build the index
  init: async (user) => {
    // Return existing index if already built (soft cache)
    if (isInitialized && searchIndex.bins.length > 0) return searchIndex;
    
    // Reset
    searchIndex.bins = []
    searchIndex.archive.stats = []
    
    const app = initFirebase()
    const db = getFirestore(app)

    let totalActiveBins = 0
    let archivedCount = 0
    let restoredCount = 0
    let deletedCount = 0
    let isAdmin = false

    // 1. Index Dashboard/Bins
    try {
      const dbRef = collection(db, 'dashboard')
      const dashboardSnap = await getDocs(dbRef)
      
      dashboardSnap.forEach(doc => {
        totalActiveBins++
        const data = doc.data()
        const binName = data.name || data.binName || `Bin ${doc.id}`
        
        searchIndex.bins.push({
          type: 'bin',
          id: doc.id,
          name: binName,
          title: binName,
          subtitle: `${data.location || 'Unknown Location'} • ${data.fill_level || 0}% Full`,
          page: 'dashboard', 
          icon: 'trash',
          searchText: `${binName} ${data.location || ''} ${doc.id} bin waste`.toLowerCase(),
          data: data
        })
      })
    } catch (e) {
      if (e.code !== 'permission-denied') console.warn("Search Index: Dashboard access skipped:", e.message)
    }

    // 2. Index Archive & Get Counts
    try {
      const archiveRef = collection(db, 'archive')
      const archiveSnap = await getDocs(archiveRef)
      
      archiveSnap.forEach(doc => {
        const data = doc.data()
        const status = (data.status || 'archived').toLowerCase()
        if (status === 'restored') restoredCount++
        else archivedCount++

        const name = data.name || data.binName || 'Archived Item'
        // Push recent ones to search
        if (searchIndex.archive.stats.length < 50) {
            searchIndex.archive.stats.push({
                type: 'archive',
                id: doc.id,
                name: name,
                title: name,
                subtitle: `Archived: ${new Date(data.archivedAt?.toDate ? data.archivedAt.toDate() : data.archivedAt).toLocaleDateString()}`,
                page: 'archive',
                icon: 'archive',
                // Removed generic 'archive', 'history', 'restored' keywords to avoid redundancy with summary items
                searchText: `${name} ${data.location || ''}`.toLowerCase(),
                data: data,
                filter: status === 'restored' ? 'restored' : 'archived'
            })
        }
      })
    } catch (e) {
      if (e.code !== 'permission-denied') console.warn("Search Index: Archive access skipped:", e.message)
    }

    // Fetch Deleted (Admin only)
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists() && userDoc.data().role === 'admin') {
             isAdmin = true
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
                        icon: 'trash',
                        searchText: `${name} ${data.location || ''} deleted`.toLowerCase(),
                        data: data,
                        filter: 'deleted'
                     })
                     dCount++
                 }
             })
        }
    } catch (e) { console.warn("Role check/Deleted search failed", e.message) }

    // 3. Index Static Pages with Counts
    indexStaticContent({
        activeBins: totalActiveBins,
        archived: archivedCount,
        restored: restoredCount,
        deleted: deletedCount,
        showDeleted: isAdmin
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

    // Search Bins
    searchIndex.bins.forEach(item => {
      const score = calculateRelevance(item)
      if (score > 0) results.push({ ...item, relevance: score })
    })

    // Search Archive
    searchIndex.archive.stats.forEach(item => {
        const score = calculateRelevance(item)
        if (score > 0) results.push({ ...item, relevance: score })
    })

    // Search Static
    const staticCategories = ['customize', 'settings', 'dashboard', 'profile'] // keys in index
    staticCategories.forEach(cat => {
        if(Array.isArray(searchIndex[cat])){
            searchIndex[cat].forEach(item => {
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

function indexStaticContent(counts = { activeBins: 0, archived: 0, restored: 0, deleted: 0, showDeleted: false }) {
    const { activeBins, archived, restored, deleted, showDeleted } = counts

    // 1. Customize Content
    searchIndex.customize = [
        { type: 'customize', id: 'custom-bin-list', title: 'Bin List', subtitle: `${activeBins} bins configured`, page: 'customize', icon: 'list', searchText: 'bin list customize bins' },
        { type: 'customize', id: 'custom-bin-config', title: 'Bin Configuration', subtitle: 'Setup & Settings', page: 'customize', icon: 'cog', searchText: 'bin configuration setup settings' },
        { type: 'customize', id: 'custom-bin-name', title: 'Bin Name', subtitle: 'Identification', page: 'customize', icon: 'tag', searchText: 'bin name label identification' },
        { type: 'customize', id: 'custom-capacity', title: 'Capacity (Liters)', subtitle: 'Volume & Size', page: 'customize', icon: 'weight', searchText: 'capacity liters volume size' },
        { type: 'customize', id: 'custom-serial', title: 'Bin Serial Number', subtitle: 'Device ID', page: 'customize', icon: 'barcode', searchText: 'serial number identification id' },
        { type: 'customize', id: 'custom-threshold', title: 'Alert Threshold (%)', subtitle: 'Warning Level', page: 'customize', icon: 'bell', searchText: 'alert threshold percentage warning level' },
        { type: 'customize', id: 'custom-location', title: 'Location', subtitle: 'Area & Place', page: 'customize', icon: 'map-marker', searchText: 'location place area' },
        { type: 'customize', id: 'custom-sensor', title: 'Sensor Connection', subtitle: 'Connectivity Status', page: 'customize', icon: 'wifi', searchText: 'sensor connection status connectivity' },
        { type: 'customize', id: 'custom-image', title: 'Bin Image URL', subtitle: 'Photo & Picture', page: 'customize', icon: 'image', searchText: 'image url photo picture' },
        { type: 'customize', id: 'custom-info', title: 'Additional Information', subtitle: 'Details & Notes', page: 'customize', icon: 'info-circle', searchText: 'additional information details notes' }
    ]
    
    // 2. Settings Content
    searchIndex.settings = [
        { type: 'settings', id: 'setting-theme', title: 'Theme', subtitle: 'Appearance Settings', page: 'settings', tab: 'appearance', icon: 'palette', searchText: 'theme appearance dark light mode' },
        { type: 'settings', id: 'setting-personal', title: 'Personal Information', subtitle: 'Profile Details', page: 'settings', tab: 'profile', icon: 'user', searchText: 'personal information name email contact' },
        { type: 'settings', id: 'setting-account', title: 'Account Settings', subtitle: 'Preferences', page: 'settings', tab: 'profile', icon: 'cogs', searchText: 'account settings preferences' },
        { type: 'settings', id: 'setting-password', title: 'Password', subtitle: 'Security', page: 'settings', tab: 'password', icon: 'key', searchText: 'password security change reset' },
        { type: 'settings', id: 'setting-archive-acc', title: 'Archive Account', subtitle: 'Danger Zone', page: 'settings', tab: 'profile', icon: 'archive', searchText: 'archive account delete remove deactivate' }
    ]

    // 3. Dashboard Content
    searchIndex.dashboard = [
        { type: 'dashboard', id: 'dash-active', title: 'Active Bins', subtitle: `${activeBins} Active Bins`, page: 'dashboard', icon: 'trash', searchText: 'active bins status working' },
        { type: 'dashboard', id: 'dash-fill', title: 'Fill Level', subtitle: 'Capacity Statistics', page: 'dashboard', icon: 'chart-bar', searchText: 'fill level capacity percentage' },
        { type: 'dashboard', id: 'dash-empty', title: 'Bins Requiring Emptying', subtitle: 'Dashboard Widget', page: 'dashboard', icon: 'exclamation-triangle', searchText: 'bins requiring emptying full alert' },
        { type: 'dashboard', id: 'dash-total', title: 'Total Bins', subtitle: `${activeBins} Total Bins`, page: 'dashboard', icon: 'boxes', searchText: 'total bins count' },
        { type: 'dashboard', id: 'dash-waste', title: 'Waste Overview', subtitle: 'Distribution Chart', page: 'dashboard', icon: 'chart-pie', searchText: 'waste overview distribution chart' },
        { type: 'dashboard', id: 'dash-waste-dist', title: 'Waste Distribution', subtitle: 'Type Analysis', page: 'dashboard', icon: 'pie-chart', searchText: 'waste distribution recyclable biodegradable' },
        { type: 'dashboard', id: 'dash-maint', title: 'Maintenance Schedule', subtitle: 'Calendar', page: 'dashboard', icon: 'calendar', searchText: 'maintenance schedule cleaning' },
        { type: 'dashboard', id: 'dash-haz', title: 'Hazardous Waste', subtitle: 'Safety Alert', page: 'dashboard', icon: 'radiation', searchText: 'hazardous waste alert detection' }
    ]

    // 4. Archive Overview
    searchIndex.archive.stats.push({
        type: 'archive',
        id: 'archive-overview',
        name: 'Total Archived Bins',
        title: 'Total Archived Bins',
        subtitle: `${archived} items archived`,
        page: 'archive',
        filter: 'archived',
        icon: 'archive',
        searchText: 'total archived bins history count',
        disableSearchFilter: true,
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
        filter: 'restored',
        icon: 'archive',
        searchText: 'restored bins history recovered',
        disableSearchFilter: true,
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
            filter: 'deleted',
            icon: 'trash',
            searchText: 'permanently deleted bins remove',
            disableSearchFilter: true,
            data: {}
        })
    }
}
