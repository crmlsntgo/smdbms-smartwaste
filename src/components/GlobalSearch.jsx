import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuth } from 'firebase/auth'
import initFirebase from '../firebaseConfig'
import { SearchManager } from '../utils/searchManager'
import '../styles/components/global-search.css'

export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const [loading, setLoading] = useState(false)
  const searchRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    // Initialize index when auth state resolves
    initFirebase()
    const auth = getAuth()
    const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) {
            SearchManager.init(user)
        }
    })
    
    // Click outside listener
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
        unsubscribe()
        document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSearch = (e) => {
    const val = e.target.value
    setQuery(val)
    
    if (val.length >= 2) {
       const searchResults = SearchManager.search(val)
       setResults(searchResults)
       setShowResults(true)
    } else {
       setResults([])
       setShowResults(false)
    }
  }

  const handleNavigate = (item) => {
    setShowResults(false)
    setQuery('') // Optional: clear query
    
    // Determine path
    let path = '/'
    if (item.page === 'dashboard') path = '/dashboard'
    else if (item.page === 'customize') path = '/customize'
    else if (item.page === 'settings') path = '/settings'
    else if (item.page === 'archive') path = '/archive'
    
    // Add query params for highlighting or specific item focus
    // Legacy used custom navigation logic. Here we can use simple routing.
    // If it's a bin, maybe go to customize or dashboard with context?
    // Let's stick to page navigation with an optional state/hash
    
    if (item.type === 'bin') {
      // Navigate to Customize for editing or detail view as per new requirements?
      // "When results from this page appear in search, the preview should indicate..."
      // For bins, let's keep going to Customize if it's a "Bin List" search, or specifically finding a bin.
      // If found via Dashboard, go to dashboard?
      // Default behavior: go to page specified in item.
      
      const targetState = { highlightId: item.id, item: item.data }
      navigate(path, { state: targetState })
    } else {
       // For static items or archive items
       navigate(path, { state: { 
           highlightId: item.id,
           highlightTerm: query, 
           filter: item.filter, // Pass filter key (archived/restored/deleted)
           tab: item.tab, // Pass tab key (appearance/profile/password)
           disableSearchFilter: item.disableSearchFilter
       }})
    }
  }

  // Icons mapping
  const getIcon = (icon) => {
     // Simple SVG placeholders based on icon name
     switch(icon) {
         case 'trash': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
         case 'archive': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
         case 'cog': 
         case 'settings': 
         case 'cogs': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
         case 'list': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
         case 'user-cog': 
         case 'user': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
         case 'palette': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>
         case 'tag': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01"/></svg>
         case 'weight': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18"/><path d="M3 12h18"/><path d="M4 4h16v16H4z"/></svg>
         case 'barcode': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/></svg>
         case 'bell': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
         case 'map-marker': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
         case 'wifi': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
         case 'image': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
         case 'info-circle': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
         case 'key': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
         case 'chart-bar': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
         case 'exclamation-triangle': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
         case 'boxes': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
         case 'chart-pie': 
         case 'pie-chart': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
         case 'calendar': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
         case 'radiation': return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0"/><path d="M12 2v6"/><path d="M12 22v-6"/><path d="M20.66 7l-5.2 3"/><path d="M3.34 7l5.2 3"/><path d="M20.66 17l-5.2-3"/><path d="M3.34 17l5.2-3"/></svg>
         default: return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
     }
  }
  
  // Highlight text helper
  const HighlightedText = ({ text, highlight }) => {
    if (!text) return null
    
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'))
    
    return (
      <span>
        {parts.map((part, i) => {
            const isHighlight = part.toLowerCase() === highlight.toLowerCase()
            // Regex to match numbers
            const numberParts = part.split(/(\d+)/)
            return (
                <span key={i} className={isHighlight ? "sb-search-highlight" : ""}>
                    {isHighlight ? (
                        <mark>{part}</mark> 
                    ) : (
                        numberParts.map((sub, j) => 
                            /\d+/.test(sub) ? <strong key={`${i}-${j}`}>{sub}</strong> : sub
                        )
                    )}
                </span>
            )
        })}
      </span>
    )
  }

  // Group results
  const groupedResults = results.reduce((acc, item) => {
    const key = item.page || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  return (
    <div className="sb-search" ref={searchRef}>
      <div className="sb-search__icon">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
          <circle cx="11" cy="11" r="6" stroke="#98A2B3" strokeWidth="1.6" fill="none" />
          <line x1="15" y1="15" x2="20" y2="20" stroke="#98A2B3" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <input 
        id="sb-global-search"
        type="text" 
        placeholder="Search..." 
        value={query}
        onChange={handleSearch}
        onFocus={() => { if(query.length >=2) setShowResults(true) }}
        className="sb-search__input"
      />
      
      {showResults && results.length > 0 && (
        <div className="sb-search-results">
            {Object.entries(groupedResults).map(([group, items]) => (
                <div key={group} className="sb-search-group">
                    <div className="sb-search-group__title">{group}</div>
                    {items.map((item, idx) => (
                        <div 
                            key={`${item.id}-${idx}`} 
                            className="sb-search-item"
                            onClick={() => handleNavigate(item)}
                        >
                            <div className="sb-search-item__icon">
                                {getIcon(item.icon)}
                            </div>
                            <div className="sb-search-item__content">
                                <div className="sb-search-item__title">
                                    <HighlightedText text={item.title} highlight={query} />
                                </div>
                                <div className="sb-search-item__subtitle">
                                    <HighlightedText text={item.subtitle} highlight={query} />
                                </div>
                            </div>
                            <div className="sb-search-item__meta">
                                {item.type}
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
      )}
      
      {showResults && results.length === 0 && query.length >= 2 && (
          <div className="sb-search-results">
              <div className="p-4 text-center text-[var(--sb-text-muted)] text-sm">
                  No results found for "{query}"
              </div>
          </div>
      )}
    </div>
  )
}
