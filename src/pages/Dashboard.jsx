import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { getFirestore, doc, getDoc, collection, getDocs, onSnapshot } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { useSearchHighlight } from '../hooks/useSearchHighlight'
import initFirebase from '../firebaseConfig'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import { WasteDoughnutChart, GeneralWasteChart } from '../components/charts/WasteOverviewChart'
import { SingleBinFillChart, FillTrendChart, WasteCompositionBar } from '../components/charts/SingleBinCharts'
import { HazardousAlertCard, processHazardousData } from '../components/charts/HazardousAlertCard'
import { MetricsCards, processMetricsData } from '../components/charts/MetricsCards'
import { checkFillLevelNotifications } from '../utils/fillLevelNotifier'
import { computeMaintenanceSchedule } from '../components/charts/SystemOverviewCard'
import '../styles/vendor/dashboard-style.css'
import '../styles/vendor/header.css'

/**
 * Normalize a raw Firestore bin document into a consistent shape.
 */
function normalizeBin(docSnap) {
  const data = docSnap.data()
  const id = docSnap.id

  const name = data.name || data.binName || id
  const rawConn = data.connectivity || data.sensorStatus || 'disconnected'
  const connectivity = rawConn.charAt(0).toUpperCase() + rawConn.slice(1)
  const battery = Number(data.battery) || Number(data.battery_level) || 0

  const wc = data.waste_composition || {}
  const recyclable   = Number(wc.recyclable) || 0
  const biodegradable = Number(wc.biodegradable) || 0
  const non_biodegradable = Number(wc.non_biodegradable) || Number(wc.nonBio) || 0
  const general_waste = Number(data.general_waste) || 0

  // Compute fill_level: 
  // If explicitly provided, use it.
  // If waste_composition is present (multi-bin), average the 3 streams.
  // Otherwise default to legacy behavior (sum capped at 100).
  let fill_level = 0
  if (data.fill_level != null) {
    fill_level = Number(data.fill_level)
  } else if (data.waste_composition) {
    // User specified 3 bins: Bio, Recyclable, Non-Bio. Calculate average.
    fill_level = Math.round((recyclable + biodegradable + non_biodegradable) / 3)
  } else {
    fill_level = Math.min(100, Math.round(recyclable + biodegradable + non_biodegradable + general_waste))
  }

  const location = data.location || 'Unknown Location'
  const status = data.status || 'Active'
  const capacity = Number(data.capacity) || 100

  // Resolve lastEmptiedAt timestamp
  let lastEmptiedAt = null
  if (data.lastEmptiedAt) {
    if (data.lastEmptiedAt.toDate) lastEmptiedAt = data.lastEmptiedAt.toDate()
    else if (data.lastEmptiedAt.seconds) lastEmptiedAt = new Date(data.lastEmptiedAt.seconds * 1000)
    else lastEmptiedAt = new Date(data.lastEmptiedAt)
  }

  // Compute fill rate: fill_level as percentage of capacity
  const fill_rate = capacity > 0 ? Math.round((fill_level / capacity) * 100 * 10) / 10 : 0

  return {
    id, name, location, status, connectivity,
    battery, battery_level: battery, fill_level, general_waste, capacity,
    waste_composition: { recyclable, biodegradable, non_biodegradable },
    fill_rate,
    lastEmptiedAt,
    emptiedBy: data.emptiedBy || null,
    threshold: data.threshold || 80,
    hazardous_detected: data.hazardous_detected || false,
    gas_detected: data.gas_detected || false,
    recent_detections: data.recent_detections || [],
    updated_at: data.updated_at || data.lastConfigured || data.createdAt || null,
    createdAt: data.createdAt || null,
    _raw: data
  }
}

/**
 * Format a Date object for "Last Emptied" display.
 */
function formatLastEmptied(date) {
  if (!date || !(date instanceof Date) || isNaN(date)) return null
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  }) + ' – ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true
  })
}

export default function Dashboard() {
  const [userName, setUserName] = useState('')
  const [wasteData, setWasteData] = useState({ recyclable: 0, biodegradable: 0, non_biodegradable: 0 })
  const [fillLevel, setFillLevel] = useState(0)
  const [totalBins, setTotalBins] = useState(0)
  const [viewAllBins, setViewAllBins] = useState(false)
  const [user, setUser] = useState(null)
  const [bins, setBins] = useState([])
  const [binDetail, setBinDetail] = useState(null)
  const [systemStats, setSystemStats] = useState({ activeBins: 0, totalBins: 0, avgFill: 0, binsNeedingEmpty: 0 })
  const [lastUpdated, setLastUpdated] = useState(null)
  const [hazardousData, setHazardousData] = useState({ hasHazardous: false, detections: [] })
  const [loading, setLoading] = useState(true)
  
  const { getHighlightClass } = useSearchHighlight()
  
  // Stable Firebase refs
  const app = useMemo(() => initFirebase(), [])
  const db = useMemo(() => getFirestore(app), [app])
  const auth = useMemo(() => getAuth(app), [app])

  /**
   * One-time fetch of all active bins from the 'bins' collection.
   */
  // Auth listener
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(currentUser => {
      if (currentUser) {
        setUser(currentUser)
        setUserName(currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'User'))
      } else {
         window.location.href = '/login'
      }
    })
    return () => unsubscribeAuth()
  }, [auth])

  // Real-time bins listener
  useEffect(() => {
    if (!user) return

    setLoading(true)
    const q = collection(db, 'bins')

    const unsubscribe = onSnapshot(q, async (binsSnap) => {
      try {
        const loadedBins = []
        binsSnap.forEach(docSnap => {
          const bin = normalizeBin(docSnap)
          const s = bin.status.toLowerCase()
          if (s !== 'archived' && s !== 'emptied') {
            loadedBins.push(bin)
          }
        })

        // Compute system stats
        let active = 0, fillSum = 0, emptyCount = 0
        loadedBins.forEach(bin => {
          const conn = bin.connectivity.toLowerCase()
          if (conn.includes('online') || conn.includes('strong') || conn.includes('connected')) {
            active++
          }
          fillSum += bin.fill_level
          if (bin.fill_level >= (bin.threshold || 80)) emptyCount++
        })

        const total = loadedBins.length

        setBins(loadedBins)
        setTotalBins(total)
        setLastUpdated(new Date())
        setSystemStats({
          totalBins: total,
          activeBins: active,
          avgFill: total > 0 ? Math.round(fillSum / total) : 0,
          binsNeedingEmpty: emptyCount
        })

        // Handle binDetail selection
        setBinDetail(prev => {
          // 1. Try to load from localStorage first if no prev exists
          if (!prev) {
             const storedId = localStorage.getItem('ud_selected_bin');
             if (storedId) {
                const foundStored = loadedBins.find(b => b.id === storedId);
                if (foundStored) return foundStored;
             }
          }

          // 2. Keep current selection if valid
          const targetId = prev ? prev.id : null 
          let found = null
          if (targetId) {
              found = loadedBins.find(b => b.id === targetId)
          }

          // 3. Fallback to first bin if nothing selected or found
          const result = found || loadedBins[0] || null
          
          if (result) {
              localStorage.setItem('ud_selected_bin', result.id)
          }
          return result
        })

        // Process hazardous data from bins
        const hazResult = processHazardousData(loadedBins)
        setHazardousData(hazResult)

        // Check fill levels
        checkFillLevelNotifications(db, loadedBins)

        setLoading(false)
      } catch (err) {
        console.error('Error in snapshot listener', err)
        setLoading(false)
      }
    }, (error) => {
      console.error('Snapshot error:', error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user, db])

  // Save selection whenever binDetail changes
  useEffect(() => {
      if (binDetail && binDetail.id) {
          localStorage.setItem('ud_selected_bin', binDetail.id);
      }
  }, [binDetail])

  // Sync wasteData and fillLevel with binDetail
  useEffect(() => {
    if (binDetail) {
      setWasteData({
        recyclable: binDetail.waste_composition.recyclable,
        biodegradable: binDetail.waste_composition.biodegradable,
        non_biodegradable: binDetail.waste_composition.non_biodegradable
      })
      setFillLevel(binDetail.fill_level)
    }
  }, [binDetail])

  // Derived state for Waste Overview Chart
  const { pRecyc, pBio, pNonBio } = useMemo(() => {
      const total = wasteData.recyclable + wasteData.biodegradable + wasteData.non_biodegradable
      if (total === 0) return { pRecyc: 0, pBio: 0, pNonBio: 0 }
      return {
          pRecyc: Math.round((wasteData.recyclable / total) * 100),
          pBio: Math.round((wasteData.biodegradable / total) * 100),
          pNonBio: Math.round((wasteData.non_biodegradable / total) * 100)
      }
  }, [wasteData])

  // General waste average
  const generalWaste = useMemo(() => {
      if (bins.length === 0) return 0
      let total = 0
      bins.forEach(b => { total += Number(b.general_waste) || Number(b.fill_level) || 0 })
      return Math.round(total / bins.length)
  }, [bins])

  // Metrics
  const metrics = useMemo(() => processMetricsData(bins), [bins])

  // Maintenance schedule
  const maintenanceItems = useMemo(() => computeMaintenanceSchedule(bins), [bins])

  // Fill trend points
  const fillTrendPoints = useMemo(() => {
      if (!binDetail) return []
      const level = binDetail.fill_level || 0
      const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00']
      return hours.map((label, i) => ({
          label,
          value: Math.max(0, Math.min(100, Math.round(level * (0.4 + (i * 0.12)))))
      }))
  }, [binDetail])

  // Bin waste composition
  const binWasteData = useMemo(() => {
      if (!binDetail) return {}
      const wc = binDetail.waste_composition || {}
      return {
          recyclable: wc.recyclable || 0,
          biodegradable: wc.biodegradable || 0,
          non_biodegradable: wc.non_biodegradable || 0,
          general_waste: binDetail.general_waste || 0
      }
  }, [binDetail])

  // Fill color helper
  const getFillColor = (level) => {
      if (level >= 80) return '#f44336'
      if (level >= 50) return '#ffc107'
      return '#4caf50'
  }

  const getBatteryLevel = (bin) => {
      if (!bin) return 85
      return bin.battery_level || bin.battery || 85
  }

  return (
    <div>
      <Header />
      <div className="dashboard-wrapper">
        <Sidebar auth={auth} db={db} />
        <main className="main-content">
          <div className="dashboard-content">
            {/* Greeting Section */}
            <div className="welcome-section">
                <h2>Good morning, <span className="user-name">{userName}</span>!</h2>
                <p>Here's what's happening with your bins today</p>
            </div>

            <div className="dashboard-rows">
                {/* TOP ROW */}
                <div className="row-top">
                    {/* Waste Overview */}
                    <div id="dash-waste" className={`card waste-card flex-2 ${getHighlightClass('dash-waste')}`}>
                        <div className="waste-header">
                            <h3>
                                <svg style={{width:'18px',height:'18px',marginRight:'8px'}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                Waste Overview
                            </h3>
                            <p>Distribution and trends across waste categories</p>
                        </div>
                        <div className="waste-body">
                            <div className="charts-row" style={{ alignItems: 'flex-start' }}>
                                {/* Current Distribution - Chart.js Doughnut */}
                                <div id="dash-waste-dist" className={`donut-section ${getHighlightClass('dash-waste-dist')}`}>
                                    <div style={{textAlign: 'center', width: '100%'}}>
                                        <h4 style={{fontSize: '12px', marginBottom: '10px'}}>Current Distribution</h4>
                                        <div style={{maxWidth: '280px', margin: '0 auto'}}>
                                            <WasteDoughnutChart
                                                recyclable={pRecyc}
                                                biodegradable={pBio}
                                                non_biodegradable={pNonBio}
                                            />
                                        </div>
                                    </div>
                                </div>
                                {/* General Waste - Chart.js Ring */}
                                <div className="donut-section">
                                    <div style={{textAlign: 'center', width: '100%'}}>
                                        <h4 style={{fontSize: '12px', marginBottom: '10px'}}>General Waste</h4>
                                        <div style={{maxWidth: '280px', margin: '0 auto'}}>
                                            <GeneralWasteChart value={generalWaste} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* Summary Cards */}
                            <div className="chart-legend-cards">
                                <div className="legend-card lc-green">
                                    <div className="lc-title">Recyclable</div>
                                    <div className="lc-value"><span>{pRecyc}</span>%</div>
                                </div>
                                <div className="legend-card lc-lime">
                                    <div className="lc-title">Biodegradable</div>
                                    <div className="lc-value"><span>{pBio}</span>%</div>
                                </div>
                                <div className="legend-card lc-orange">
                                    <div className="lc-title">Non-Biodegradable</div>
                                    <div className="lc-value"><span>{pNonBio}</span>%</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* System Overview */}
                    <div className="card system-card flex-1">
                        <div className="system-header">
                            <span className="system-title">System Overview</span>
                            <span className="last-updated">
                                <i className="fas fa-sync-alt" style={{ marginRight: '6px', fontSize: '10px' }}></i>
                                {lastUpdated ? lastUpdated.toLocaleString() : 'Loading...'}
                            </span>
                        </div>
                        <div className="system-body">
                            <div id="dash-active" className={`sys-stat-row ${getHighlightClass('dash-active')}`}>
                                <span>Active Bins</span>
                                <span className="sys-val">
                                    {systemStats.activeBins}/{systemStats.totalBins}
                                    <span className="badge-active" style={{
                                        backgroundColor: systemStats.activeBins > 0 ? '#e8f5e9' : '#f3f4f6',
                                        color: systemStats.activeBins > 0 ? '#2e7d32' : '#9ca3af',
                                        marginLeft: '8px', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600
                                    }}>
                                        {systemStats.activeBins > 0 ? 'Active' : 'No Bins'}
                                    </span>
                                </span>
                            </div>
                            <div id="dash-empty" className={`sys-stat-row ${getHighlightClass('dash-empty')}`}>
                                <span>
                                    Bins Requiring Emptying
                                    <span style={{
                                        display: 'inline-block', width: '8px', height: '8px',
                                        borderRadius: '50%',
                                        backgroundColor: systemStats.binsNeedingEmpty > 0 ? '#ef4444' : '#9ca3af',
                                        marginLeft: '6px'
                                    }}></span>
                                </span>
                                <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
                                     <span className="sys-val" style={{marginBottom:'4px'}}>{systemStats.binsNeedingEmpty}</span>
                                </div>
                            </div>

                            <div id="dash-maint" className={`maint-title ${getHighlightClass('dash-maint')}`}>
                                <i className="fas fa-calendar-alt" style={{color:'#ff9800'}}></i> Bins To Be Maintenanced
                            </div>
                            <div className="maint-list">
                                {maintenanceItems.length === 0 ? (
                                    <span style={{ display: 'block', fontSize: '0.85rem', color: '#999' }}>No scheduled maintenance</span>
                                ) : (
                                    maintenanceItems.map((item, idx) => (
                                        <div className="maint-item" key={idx}>
                                            <div className={`m-dot d-${item.color === 'red' ? 'red' : item.color === 'blue' ? 'blue' : item.color === 'purple' ? 'purple' : 'green'}`}></div>
                                            <div className="m-content">
                                                <h4>{item.binName} - {item.task}</h4>
                                                <p>{item.time}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM ROW */}
                <div className="row-bottom">
                     {/* Single Bin Detail */}
                    <div className="card bin-card flex-2">
                        <div className="bin-header">
                            <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                <span style={{
                                    width:'10px', height:'10px',
                                    background: binDetail?.connectivity?.toLowerCase().includes('online') || binDetail?.connectivity?.toLowerCase().includes('strong') ? '#00e676' : '#9ca3af',
                                    borderRadius:'50%'
                                }}></span>
                                {binDetail?.name || 'Bin #01'}
                            </div>
                            <span className="bin-sub">{binDetail?.location || 'Main Building Bin'}</span>
                        </div>
                        <div className="bin-body">
                            {/* Fill Level Donut (Chart.js) */}
                            <div className="bin-col-1">
                                <div style={{width: '160px', height: '160px', margin: '0 auto 20px'}}>
                                    <SingleBinFillChart percent={fillLevel} />
                                </div>
                                <div className="bin-meta">
                                    <div><i className="fas fa-tachometer-alt" style={{color:'#027a64', marginRight:'6px'}}></i>Fill Rate: {binDetail?.fill_rate || 0}%</div>
                                    <div><i className="fas fa-clock" style={{color:'#027a64', marginRight:'6px'}}></i>Last Emptied: {binDetail?.lastEmptiedAt ? formatLastEmptied(binDetail.lastEmptiedAt) : 'Never'}</div>
                                </div>
                            </div>
                            {/* Status Col */}
                            <div className="bin-col-2">
                                <div>
                                    <h4 style={{marginBottom:'15px', fontWeight:'700'}}>Bin Status</h4>
                                </div>
                                <div className="b-stat-group">
                                    <h4><i className="fas fa-battery-three-quarters"></i> Battery</h4>
                                    <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                        <div className="batt-bar">
                                            <div className="batt-fill" style={{
                                                width: `${getBatteryLevel(binDetail)}%`,
                                                background: getBatteryLevel(binDetail) > 20 ? '#4caf50' : '#f44336'
                                            }}></div>
                                        </div>
                                        <span style={{fontSize:'12px', fontWeight:'600'}}>{getBatteryLevel(binDetail)}%</span>
                                    </div>
                                </div>
                                <div className="b-stat-group">
                                    <h4><i className="fas fa-wifi"></i> Connectivity</h4>
                                    <span className="conn-sig">
                                        <i className="fas fa-signal"></i> {binDetail?.connectivity || 'Strong signal'}
                                    </span>
                                </div>
                            </div>
                            {/* Quick Insights (Chart.js) */}
                            <div className="bin-col-3">
                                <h4 style={{fontSize:'14px', fontWeight:'700'}}>Quick Insights</h4>
                                <div style={{fontSize:'12px', color:'#666'}}>Fill Level Today</div>
                                <div style={{height: '90px', marginBottom: '8px'}}>
                                    <FillTrendChart points={fillTrendPoints} />
                                </div>
                                <div style={{fontSize:'12px', color:'#666', marginTop:'5px'}}>Waste Composition</div>
                                <div style={{height: '90px'}}>
                                    <WasteCompositionBar data={binWasteData} />
                                </div>
                            </div>
                        </div>
                         <button className="view-bins-btn" onClick={() => setViewAllBins(!viewAllBins)}>
                             {viewAllBins ? 'Minimize >' : 'View Bins >'}
                         </button>
                    </div>

                    {/* All Bins View (Hidden by Default) */}
                    <div className="card all-bins-card" id="allBinsView" style={{display: viewAllBins ? 'flex' : 'none'}}>
                        <div className="ab-outer-header">All Bins</div>
                        <div className="ab-list-container">
                            {bins.map(bin => (
                                <div className="ab-item" key={bin.id} onClick={() => { setBinDetail(bin); setViewAllBins(false); }}>
                                    <div className="ab-header">
                                        <span className={`ab-status-dot ${bin.fill_level >= 80 ? 'dot-orange' : 'dot-green'}`}></span>
                                        <span className="ab-name">{bin.name}</span>
                                        {bin.fill_level >= 80 && <i className="fas fa-exclamation-triangle ab-alert-icon" style={{color: '#ff9800'}}></i>}
                                    </div>
                                    <div className="ab-loc">{bin.location || 'Unknown Location'}</div>
                                    <div className="ab-stats">
                                        <div className="ab-fill-group">
                                            <span className="ab-label">Fill Level</span>
                                            <div className="ab-progress-track">
                                                <div className="ab-progress-fill" style={{width: `${bin.fill_level || 0}%`, background: getFillColor(bin.fill_level || 0)}}></div>
                                            </div>
                                            <span className="ab-val">{bin.fill_level || 0}%</span>
                                        </div>
                                        <div className="ab-conn">
                                            <i className="fas fa-battery-three-quarters" style={{color: '#4caf50'}}></i> {getBatteryLevel(bin)}%
                                            <i className="fas fa-wifi" style={{color: '#4caf50', marginLeft: '8px'}}></i>
                                        </div>
                                    </div>
                                    <a href="#" className="ab-details-link" onClick={(e) => { e.preventDefault(); setBinDetail(bin); setViewAllBins(false); }}>Details <i className="fas fa-arrow-right"></i></a>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Hazardous Alert - Dynamic */}
                    <div style={{display: viewAllBins ? 'none' : 'block', flex: '0.8'}} id="dash-haz">
                        <HazardousAlertCard
                            hasHazardous={hazardousData.hasHazardous}
                            detections={hazardousData.detections}
                        />
                    </div>

                    {/* Right Stats - Dynamic Metrics */}
                    <div style={{display: viewAllBins ? 'none' : 'flex', flex: '1'}}>
                        <MetricsCards
                            totalBins={metrics.totalBins}
                            binsChange={metrics.change}
                            binsRate={metrics.binsRate}
                            averageFillLevel={metrics.avgFill}
                        />
                    </div>
                </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
