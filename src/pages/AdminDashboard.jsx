import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, doc, getDoc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore'
import initFirebase from '../firebaseConfig'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import { WasteDoughnutChart, GeneralWasteChart } from '../components/charts/WasteOverviewChart'
import { SystemOverviewCard, computeMaintenanceSchedule } from '../components/charts/SystemOverviewCard'
import { SingleBinFillChart, FillTrendChart, WasteCompositionBar } from '../components/charts/SingleBinCharts'
import { HazardousAlertCard, processHazardousData } from '../components/charts/HazardousAlertCard'
import { MetricsCards, processMetricsData } from '../components/charts/MetricsCards'
import { checkFillLevelNotifications } from '../utils/fillLevelNotifier'
import '../styles/vendor/dashboard-style.css'
import '../styles/vendor/header.css'

/**
 * Normalize a raw Firestore bin document into a consistent shape
 * that all dashboard cards and charts can consume.
 */
function normalizeBin(docSnap) {
  const data = docSnap.data()
  const id = docSnap.id

  // Resolve name: server writes "name", Customize writes "binName"
  const name = data.name || data.binName || id

  // Resolve connectivity: server writes "connectivity", Customize writes "sensorStatus"
  const rawConn = data.connectivity || data.sensorStatus || 'disconnected'
  const connectivity = rawConn.charAt(0).toUpperCase() + rawConn.slice(1)

  // Resolve battery: server writes "battery", some code expects "battery_level"
  const battery = Number(data.battery) || Number(data.battery_level) || 0

  // Resolve waste composition
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
    id,
    name,
    location,
    status,
    connectivity,
    battery,
    battery_level: battery,
    fill_level,
    general_waste,
    capacity,
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
 * e.g. "Feb 13, 2026 – 3:45 PM"
 */
function formatLastEmptied(date) {
  if (!date || !(date instanceof Date) || isNaN(date)) return null
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  }) + ' – ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true
  })
}

export default function AdminDashboard() {
  const [user, setUser] = useState(null)
  const [userName, setUserName] = useState('')
  const [bins, setBins] = useState([])
  const [binDetail, setBinDetail] = useState(null)
  const [systemStats, setSystemStats] = useState({
      totalBins: 0,
      activeBins: 0,
      avgFill: 0,
      binsNeedingEmpty: 0
  })
  const [wasteComp, setWasteComp] = useState({
      biodegradable: 0,
      recyclable: 0,
      non_biodegradable: 0
  })
  const [showAllBins, setShowAllBins] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [hazardousData, setHazardousData] = useState({ hasHazardous: false, detections: [] })
  const [loading, setLoading] = useState(true)

  // Stable Firebase refs
  const app = useMemo(() => initFirebase(), [])
  const db = useMemo(() => getFirestore(app), [app])
  const auth = useMemo(() => getAuth(app), [app])

  // Auth check
  useEffect(() => {
    const authUnsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
          if (userDoc.exists()) {
            setUserName(userDoc.data().firstName || 'Admin')
          }
        } catch (e) {
          console.error('Profile load error', e)
        }
      } else {
        window.location.href = '/login'
      }
    })
    return () => authUnsub()
  }, [auth, db])

  // Real-time bins listener
  useEffect(() => {
    if (!user) return

    setLoading(true)
    const q = collection(db, 'bins')

    const unsubscribe = onSnapshot(q, async (binsSnap) => {
      try {
        // Filter active bins
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
        setLastUpdated(new Date())
        setSystemStats({
          totalBins: total,
          activeBins: active,
          avgFill: total > 0 ? Math.round(fillSum / total) : 0,
          binsNeedingEmpty: emptyCount
        })

        // Handle binDetail selection
        setBinDetail(prev => {
          // Keep current selection if valid, else default
          const targetId = prev ? prev.id : 'BIN001'
          const found = loadedBins.find(b => b.id === targetId)
          return found || loadedBins[0] || null
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

  // Sync waste composition with binDetail
  useEffect(() => {
    if (binDetail) {
      setWasteComp({
        biodegradable: binDetail.waste_composition.biodegradable,
        recyclable: binDetail.waste_composition.recyclable,
        non_biodegradable: binDetail.waste_composition.non_biodegradable
      })
    }
  }, [binDetail])

  // Compute waste percentages
  const wasteTotal = wasteComp.biodegradable + wasteComp.recyclable + wasteComp.non_biodegradable
  const getPercent = (val, total) => total > 0 ? Math.round((val / total) * 100) : 0
  const pRecyc = getPercent(wasteComp.recyclable, wasteTotal)
  const pBio = getPercent(wasteComp.biodegradable, wasteTotal)
  const pNonBio = getPercent(wasteComp.non_biodegradable, wasteTotal)

  // Compute general waste (average of all bins' general_waste or fill_level)
  const generalWaste = useMemo(() => {
      if (bins.length === 0) return 0
      let total = 0
      bins.forEach(b => { total += Number(b.general_waste) || Number(b.fill_level) || 0 })
      return Math.round(total / bins.length)
  }, [bins])

  // Compute metrics from bins
  const metrics = useMemo(() => processMetricsData(bins), [bins])

  // Compute maintenance schedule from bins
  const maintenanceItems = useMemo(() => computeMaintenanceSchedule(bins), [bins])

  // Bin fill trend points (simulated from current data)
  const fillTrendPoints = useMemo(() => {
      if (!binDetail) return []
      const level = binDetail.fill_level || 0
      const hours = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00']
      return hours.map((label, i) => ({
          label,
          value: Math.max(0, Math.min(100, Math.round(level * (0.4 + (i * 0.12)))))
      }))
  }, [binDetail])

  // Bin waste composition for bar chart
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

  // Battery level from bin data
  const getBatteryLevel = (bin) => {
      if (!bin) return 85
      return bin.battery_level || bin.battery || 85
  }

  return (
    <div>
      <Header />
      <div className="dashboard-wrapper">
        <Sidebar />
        
        <main className="main-content">
          <div className="dashboard-content">
             {/* Greeting */}
            <div className="welcome-section">
                <h2>Good morning, <span className="user-name">{userName}</span>!</h2>
                <p>Here's what's happening with your bins today</p>
            </div>

            <div className="dashboard-rows">
                {/* TOP ROW: Waste Overview + System Overview */}
                <div className="row-top">
                    {/* Waste Overview Card */}
                    <div className="card waste-card flex-2">
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
                                <div className="donut-section">
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

                    {/* System Overview - Dynamic */}
                    <SystemOverviewCard
                        activeBins={systemStats.activeBins}
                        totalBins={systemStats.totalBins}
                        averageFill={systemStats.avgFill}
                        binsNeedingEmptying={systemStats.binsNeedingEmpty}
                        updatedAt={lastUpdated}
                        maintenanceItems={maintenanceItems}
                    />
                </div>

                {/* BOTTOM ROW: Single Bin + Hazardous + Metrics */}
                <div className="row-bottom">
                    {/* Single Bin Detail Card */}
                    <div className="card bin-card flex-2">
                        <div className="bin-header">
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                <span style={{
                                    width: '10px', height: '10px',
                                    background: binDetail?.connectivity?.toLowerCase().includes('online') || binDetail?.connectivity?.toLowerCase().includes('strong') ? '#00e676' : '#9ca3af',
                                    borderRadius: '50%'
                                }}></span>
                                {binDetail?.name || 'Bin #01'}
                            </div>
                            <span className="bin-sub">{binDetail?.location || 'Main Building Bin'}</span>
                        </div>
                        <div className="bin-body">
                            {/* Col 1: Fill Level Donut (Chart.js) */}
                            <div className="bin-col-1">
                                <div style={{width: '160px', height: '160px', margin: '0 auto 20px'}}>
                                    <SingleBinFillChart percent={binDetail?.fill_level || 0} />
                                </div>
                                <div className="bin-meta">
                                    <div><i className="fas fa-tachometer-alt" style={{color:'#027a64', marginRight:'6px'}}></i>Fill Rate: {binDetail?.fill_rate || 0}%</div>
                                    <div><i className="fas fa-clock" style={{color:'#027a64', marginRight:'6px'}}></i>Last Emptied: {binDetail?.lastEmptiedAt ? formatLastEmptied(binDetail.lastEmptiedAt) : 'Never'}</div>
                                </div>
                            </div>
                            {/* Col 2: Bin Status */}
                            <div className="bin-col-2">
                                <div><h4 style={{marginBottom: '15px', fontWeight: 700}}>Bin Status</h4></div>
                                <div className="b-stat-group">
                                    <h4><i className="fas fa-battery-three-quarters"></i> Battery</h4>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                        <div className="batt-bar">
                                            <div className="batt-fill" style={{
                                                width: `${getBatteryLevel(binDetail)}%`,
                                                background: getBatteryLevel(binDetail) > 20 ? '#4caf50' : '#f44336'
                                            }}></div>
                                        </div>
                                        <span style={{fontSize: '12px', fontWeight: 600}}>{getBatteryLevel(binDetail)}%</span>
                                    </div>
                                </div>
                                <div className="b-stat-group">
                                    <h4><i className="fas fa-wifi"></i> Connectivity</h4>
                                    <span className="conn-sig">
                                        <i className="fas fa-signal"></i> {binDetail?.connectivity || 'Strong signal'}
                                    </span>
                                </div>
                            </div>
                            {/* Col 3: Quick Insights (Chart.js) */}
                            <div className="bin-col-3">
                                <h4 style={{fontSize: '14px', fontWeight: 700}}>Quick Insights</h4>
                                {/* Fill Level Trend */}
                                <div style={{fontSize: '12px', color: '#666'}}>Fill Level Today</div>
                                <div style={{height: '90px', marginBottom: '8px'}}>
                                    <FillTrendChart points={fillTrendPoints} />
                                </div>
                                {/* Waste Composition Bar */}
                                <div style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>Waste Composition</div>
                                <div style={{height: '90px'}}>
                                    <WasteCompositionBar data={binWasteData} />
                                </div>
                            </div>
                        </div>
                        <button className="view-bins-btn" onClick={() => setShowAllBins(!showAllBins)}>
                            {showAllBins ? 'Minimize >' : 'View Bins >'}
                        </button>
                    </div>
                
                    {/* All Bins View (Hidden by default) */}
                    <div className="card all-bins-card" id="allBinsView" style={{display: showAllBins ? 'flex' : 'none'}}>
                        <div className="ab-outer-header">All Bins</div>
                        <div className="ab-list-container">
                            {bins.map(bin => (
                                <div className="ab-item" key={bin.id} onClick={() => { setBinDetail(bin); setShowAllBins(false); }}>
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
                                                <div className="ab-progress-fill" style={{
                                                    width: `${bin.fill_level || 0}%`, 
                                                    background: getFillColor(bin.fill_level || 0)
                                                }}></div>
                                            </div>
                                            <span className="ab-val">{bin.fill_level || 0}%</span>
                                        </div>
                                        <div className="ab-conn">
                                            <i className="fas fa-battery-three-quarters" style={{color: '#4caf50'}}></i> {getBatteryLevel(bin)}%
                                            <i className="fas fa-wifi" style={{color: bin.connectivity?.toLowerCase().includes('strong') ? '#4caf50' : '#ff9800', marginLeft: '8px'}}></i>
                                        </div>
                                    </div>
                                    <a href="#" className="ab-details-link" onClick={(e) => { e.preventDefault(); setBinDetail(bin); setShowAllBins(false); }}>Details <i className="fas fa-arrow-right"></i></a>
                                </div>
                            ))}
                        </div>
                        
                    </div>

                    {/* Hazardous Alert Card - Dynamic */}
                    <div style={{display: showAllBins ? 'none' : 'block', flex: '0.8'}}>
                        <HazardousAlertCard
                            hasHazardous={hazardousData.hasHazardous}
                            detections={hazardousData.detections}
                        />
                    </div>

                    {/* Right Stats - Dynamic Metrics */}
                    <div style={{display: showAllBins ? 'none' : 'flex', flex: '1'}}>
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
