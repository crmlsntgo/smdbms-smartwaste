import React, { useEffect, useState, useRef } from 'react'
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'
import { getFirestore, doc, getDoc, collection, onSnapshot } from 'firebase/firestore'
import initFirebase from '../firebaseConfig'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import '../styles/vendor/dashboard-style.css'
import '../styles/vendor/header.css'

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
  
  // Ref for aggregated waste composition (if needed for trend chart)
  const aggregatedWaste = useRef({ rec: 0, bio: 0, non: 0, count: 0 })

  useEffect(() => {
    const app = initFirebase()
    const auth = getAuth(app)
    const db = getFirestore(app)
    
    // Auth Check
    const authUnsub = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
            setUser(currentUser)
            // Load Profile
            try {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
                if (userDoc.exists()) {
                    setUserName(userDoc.data().firstName || 'Admin')
                }
            } catch (e) {
                console.error("Profile load error", e)
            }
        } else {
            // Redirect or handle unauth
            window.location.href = '/login'
        }
    })

    // Listen to All Bins (Aggregated Data)
    const binsUnsub = onSnapshot(collection(db, 'dashboard'), (snapshot) => {
        if (snapshot.empty) return

        let total = 0
        let active = 0
        let fillSum = 0
        let emptyCount = 0
        let aggRec = 0, aggBio = 0, aggNon = 0
        
        const loadedBins = []

        snapshot.forEach(docSnap => {
            const data = docSnap.data()
            loadedBins.push({ id: docSnap.id, ...data })
            total++
            
            // Active Bins Logic
            if (data.connectivity) {
                const conn = data.connectivity.toLowerCase()
                if (conn.includes('online') || conn.includes('strong')) active++
            }

            // Fill Logic
            if (typeof data.fill_level === 'number') {
                fillSum += data.fill_level
                if (data.fill_level >= 80) emptyCount++
            }

            // Waste Logic
            if (data.waste_composition) {
                aggRec += (data.waste_composition.recyclable || 0)
                aggBio += (data.waste_composition.biodegradable || 0)
                aggNon += (data.waste_composition.non_biodegradable || 0)
            }
        })

        setBins(loadedBins)
        setSystemStats({
            totalBins: total,
            activeBins: active,
            avgFill: total > 0 ? Math.round(fillSum / total) : 0,
            binsNeedingEmpty: emptyCount
        })

        // For the trend chart, we typically want global stats or single bin stats.
        // The original code `listenToDashboard("BIN001")` drove the top charts.
        // If we want to replicate that behavior, we should create a separate listener for "BIN001" 
        // OR just find "BIN001" in our loaded bins.
        // Let's Find BIN001 or fallback to first bin for the "Single Bin Detail" view.
        const detailBin = loadedBins.find(b => b.id === 'BIN001') || loadedBins[0] || null
        setBinDetail(detailBin)

        // Update Waste Overview (using detail bin as per original `listenToDashboard` logic)
        if (detailBin && detailBin.waste_composition) {
             setWasteComp({
                 biodegradable: detailBin.waste_composition.biodegradable || 0,
                 recyclable: detailBin.waste_composition.recyclable || 0,
                 non_biodegradable: detailBin.waste_composition.non_biodegradable || 0
             })
        }
    })

    return () => {
        authUnsub()
        binsUnsub()
    }
  }, [])

  // Helper for Conic Gradient
  const getConicGradient = (rec, bio, non) => {
      const total = rec + bio + non
      if (total === 0) return 'none'
      
      const pRec = (rec / total) * 100
      const pBio = (bio / total) * 100
      const pNon = (non / total) * 100

      const stop1 = pRec
      const stop2 = pRec + pNon // Middle segment is Non-biodegradable (orange)
      // Original JS: 
      // stop1 = pRecyc; stop2 = pRecyc + pNonBio; 
      // gradient: Green 0% stop1, Orange stop1 stop2, Lime stop2 100%
      // Wait, snippet says:
      // #4caf50 0% ${stop1}%, (Recyclable)
      // #ff9800 ${stop1}% ${stop2}%, (Non-Biodegradable??) Wait, logic:
      // In JS: `const stop2 = pRecyc + pNonBio;` 
      // but in the code it typically follows standard. Let's strictly follow the snippet.
      // Snippet: 
      // const pRecyc = (recyclable / total) * 100;
      // const pBio = (biodegradable / total) * 100;
      // const pNonBio = (non_biodegradable / total) * 100;
      // ...
      // const stop1 = pRecyc;
      // const stop2 = pRecyc + pNonBio; 
      // ...
      // #4caf50 0% ${stop1}%, (Green = Recyc)
      // #ff9800 ${stop1}% ${stop2}%, (Orange = NonBio)
      // #cddc39 ${stop2}% 100% (Lime = Bio)
      
      // But in the Legend HTML:
      // lc-green -> Recyclable
      // lc-lime -> Biodegradable
      // lc-orange -> Non-Biodegradable
      // So color mapping: Recyc=Green, Bio=Lime, NonBio=Orange.
      
      // Re-reading JS snippet:
      // const stop2 = pRecyc + pNonBio; => Middle slice is NonBio (Orange). Correct.
      
      const s1 = stop1
      const s2 = stop2

      return `conic-gradient(
          #4caf50 0% ${s1}%,
          #ff9800 ${s1}% ${s2}%,
          #cddc39 ${s2}% 100%
      )`
  }

  // Trend Chart logic
  const TrendChart = ({ data }) => {
      const total = data.recyclable + data.biodegradable + data.non_biodegradable
      const norm = val => total > 0 ? (val / total) * 100 : 0
      
      const current = {
          recyclable: norm(data.recyclable),
          biodegradable: norm(data.biodegradable),
          non_biodegradable: norm(data.non_biodegradable)
      }

      // Past data simulation from chart-utils.js
      const series = [
        { color: '#4caf50', points: [35, 40, current.recyclable] },
        { color: '#cddc39', points: [25, 28, current.biodegradable] },
        { color: '#ff9800', points: [40, 32, current.non_biodegradable] }
      ]

      const width = 300
      const height = 150
      const padding = 30
      // Map 0-100 to Y=130-30
      const mapY = val => 130 - val
      // X Coords: padding + 40, + 120, + 200
      const xCoords = [70, 150, 230]

      const months = []
      for (let i = 2; i >= 0; i--) {
          const d = new Date()
          d.setMonth(d.getMonth() - i)
          months.push(d.toLocaleString('default', { month: 'short' }))
      }

      return (
          <svg className="line-chart-svg" viewBox="0 0 300 150">
               {/* Grid */}
               {[30, 70, 110].map(y => <line key={y} x1={padding} y1={y} x2={width-10} y2={y} className="grid-line" stroke="#e0e0e0" strokeWidth="1" />)}
               {/* Labels Y */}
               <text x="10" y="140" className="trend-axis-text" fontSize="10" fill="#999">0</text>
               <text x="10" y="30" className="trend-axis-text" fontSize="10" fill="#999">100</text>
               {/* Labels X */}
               {months.map((m, i) => (
                   <text key={i} x={xCoords[i]} y="145" className="trend-axis-text" textAnchor="middle" fontSize="10" fill="#999">{m}</text>
               ))}
               {/* Series */}
               {series.map((s, si) => {
                   const pointsStr = s.points.map((val, i) => `${xCoords[i]},${mapY(val)}`).join(' ')
                   return (
                       <g key={si}>
                           <polyline points={pointsStr} fill="none" stroke={s.color} strokeWidth="2" className="chart-line" />
                           {s.points.map((val, i) => (
                               <circle key={i} cx={xCoords[i]} cy={mapY(val)} r="3" fill="white" stroke={s.color} strokeWidth="2" className="chart-dot" />
                           ))}
                       </g>
                   )
               })}
          </svg>
      )
  }

  // Formatting for Values
  const getPercent = (val, total) => total > 0 ? Math.round((val / total) * 100) : 0
  const wasteTotal = wasteComp.biodegradable + wasteComp.recyclable + wasteComp.non_biodegradable
  
  // Bin Detail Fill Color
  const getFillColor = (level) => {
      if (level >= 80) return '#f44336' // Red
      if (level >= 50) return '#ffc107' // Yellow
      return '#4caf50' // Green
  }

  return (
    <div>
      <Header />
      <div className="dashboard-wrapper">
        <Sidebar /> {/* Needs to properly highlight 'Home' (logic in Sidebar component usually handles checking path) */}
        
        <main className="main-content">
          <div className="dashboard-content">
             {/* Greeting */}
            <div className="welcome-section">
                <h2>Good morning, <span className="user-name">{userName}</span>!</h2>
                <p>Here's what's happening with your bins today</p>
            </div>

            <div className="dashboard-rows">
                {/* TOP ROW */}
                <div className="row-top">
                    {/* Waste Overview */}
                    <div className="card waste-card flex-2">
                        <div className="waste-header">
                            <h3><i className="far fa-clock"></i> Waste Overview</h3>
                            <p>Distribution and trends across waste categories</p>
                        </div>
                        <div className="waste-body">
                            <div className="charts-row">
                                <div className="donut-section">
                                    <div style={{textAlign: 'center'}}>
                                        <h4 style={{fontSize: '12px', marginBottom: '20px'}}>Current Distribution</h4>
                                        <div className="donut-chart" id="wasteDonutChart" style={{
                                            background: getConicGradient(wasteComp.recyclable, wasteComp.biodegradable, wasteComp.non_biodegradable)
                                        }}>
                                            <div className="donut-hole"></div>
                                            <div className="donut-labels">
                                                <span className="d-label recyclable">Recyclable: <span>{getPercent(wasteComp.recyclable, wasteTotal)}</span>%</span>
                                                <span className="d-label biodegradable">Biodegradable: <span>{getPercent(wasteComp.biodegradable, wasteTotal)}</span>%</span>
                                                <span className="d-label non-bio">Non-Biodegradable: <span>{getPercent(wasteComp.non_biodegradable, wasteTotal)}</span>%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="line-chart-section">
                                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
                                        <h4 style={{fontSize: '12px'}}>3-Month Trend</h4>
                                    </div>
                                    <div style={{height: '150px', width: '100%'}}>
                                        <TrendChart data={wasteComp} />
                                    </div>
                                </div>
                            </div>
                            <div className="chart-legend-cards">
                                <div className="legend-card lc-green">
                                    <div className="lc-title">Recyclable</div>
                                    <div className="lc-value"><span>{getPercent(wasteComp.recyclable, wasteTotal)}</span>%</div>
                                </div>
                                <div className="legend-card lc-lime">
                                    <div className="lc-title">Biodegradable</div>
                                    <div className="lc-value"><span>{getPercent(wasteComp.biodegradable, wasteTotal)}</span>%</div>
                                </div>
                                <div className="legend-card lc-orange">
                                    <div className="lc-title">Non-Biodegradable</div>
                                    <div className="lc-value"><span>{getPercent(wasteComp.non_biodegradable, wasteTotal)}</span>%</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* System Overview */}
                    <div className="card system-card flex-1">
                        <div className="system-header">
                            <span className="system-title">System Overview</span>
                            <span className="last-updated">Last Updated: Today, {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div className="system-body">
                            <div className="sys-stat-row">
                                <span>Active Bins</span>
                                <span className="sys-val">
                                    {systemStats.activeBins}/{systemStats.totalBins} 
                                    <span 
                                        className="badge-active" 
                                        style={{
                                            backgroundColor: systemStats.activeBins === systemStats.totalBins ? '#e8f5e9' : '#fff3e0',
                                            color: systemStats.activeBins === systemStats.totalBins ? '#2e7d32' : '#ef6c00',
                                            marginLeft: '8px', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600
                                        }}
                                    >
                                        {systemStats.activeBins === systemStats.totalBins ? 'Active' : 'Partial'}
                                    </span>
                                </span>
                            </div>
                            <div className="sys-stat-row">
                                <span>Average Fill Level</span>
                                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}>
                                    <span className="sys-val" style={{marginBottom: '4px'}}>{systemStats.avgFill}%</span>
                                    <div className="progress-track" id="avgFillProgress">
                                        <div className="progress-fill" style={{
                                            width: `${systemStats.avgFill}%`,
                                            backgroundColor: getFillColor(systemStats.avgFill)
                                        }}></div>
                                    </div>
                                </div>
                            </div>
                            <div className="sys-stat-row">
                                <span>Bins Requiring Emptying</span>
                                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}>
                                    <span className="sys-val" style={{marginBottom:'4px'}}>{systemStats.binsNeedingEmpty}</span>
                                    <div className="progress-track" id="binsEmptyingProgress">
                                        <div className="progress-fill" style={{
                                            width: `${systemStats.totalBins > 0 ? (systemStats.binsNeedingEmpty / systemStats.totalBins * 100) : 0}%`,
                                            backgroundColor: '#f44336'
                                        }}></div>
                                    </div>
                                </div>
                            </div>

                            <div className="maint-title"><i className="far fa-calendar-alt" style={{color:'#ff9800'}}></i> Maintenance Schedule</div>
                            <div className="maint-list">
                                <div className="maint-item">
                                    <div className="m-dot d-green"></div>
                                    <div className="m-content">
                                        <h4>Bin # 1 Cleaning</h4>
                                        <p>Tomorrow, 9:00 AM</p>
                                    </div>
                                </div>
                                <div className="maint-item">
                                    <div className="m-dot d-blue"></div>
                                    <div className="m-content">
                                        <h4>Bin # 2 Emptying</h4>
                                        <p>Oct 18, 4:00 PM</p>
                                    </div>
                                </div>
                                <div className="maint-item">
                                    <div className="m-dot d-purple"></div>
                                    <div className="m-content">
                                        <h4>Bin # 3 Cleaning</h4>
                                        <p>Dec 15, 10:00 AM</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM ROW */}
                <div className="row-bottom">
                    {/* Bin Detail View (Left Toggle-able) */}
                    <div className="card bin-card flex-2">
                        <div className="bin-header">
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                <span style={{width: '10px', height: '10px', background: '#00e676', borderRadius: '50%'}}></span>
                                Bin #{binDetail?.id || '01'}
                            </div>
                            <span className="bin-sub">{binDetail?.location || 'Main Building Bin'}</span>
                        </div>
                        <div className="bin-body">
                            <div className="bin-col-1">
                                <div className="fill-donut" style={{
                                    background: `conic-gradient(${getFillColor(binDetail?.fill_level || 0)} 0% ${binDetail?.fill_level || 0}%, #f0f0f0 ${binDetail?.fill_level || 0}% 100%)`
                                }}>
                                    <div className="fill-inner">
                                        <span className="fi-val">{binDetail?.fill_level || 0} %</span>
                                        <span className="fi-lbl">Fill Level</span>
                                    </div>
                                </div>
                                <div className="bin-meta">
                                    <div>Fill Rate: 4.2% per hour</div>
                                    <div>Last Emptied: 2 days ago</div>
                                </div>
                            </div>
                            <div className="bin-col-2">
                                <div><h4 style={{marginBottom: '15px', fontWeight: 700}}>Bin Status</h4></div>
                                <div className="b-stat-group">
                                    <h4><i className="fas fa-battery-three-quarters"></i> Battery</h4>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                        <div className="batt-bar"><div className="batt-fill" style={{width: '85%'}}></div></div>
                                        <span style={{fontSize: '12px', fontWeight: 600}}>85%</span>
                                    </div>
                                </div>
                                <div className="b-stat-group">
                                    <h4><i className="fas fa-wifi"></i> Connectivity</h4>
                                    <span className="conn-sig"> <i className="fas fa-signal"></i> {binDetail?.connectivity || 'Strong signal'}</span>
                                </div>
                            </div>
                            <div className="bin-col-3">
                                <h4 style={{fontSize: '14px', fontWeight: 700}}>Quick Insights</h4>
                                <div style={{fontSize: '12px', color: '#666'}}>Fill Level Today</div>
                                <div className="small-chart-box" style={{background: 'linear-gradient(to top, #e3f2fd, white)', borderBottom: '2px solid #2196f3'}}></div>
                                <div style={{fontSize: '10px', display: 'flex', justifyContent: 'space-between', color: '#999'}}>
                                    <span>10:00</span><span>12:00</span><span>14:00</span><span>16:00</span>
                                </div>
                                <div style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>Waste Composition</div>
                                <div className="small-chart-box" style={{background: 'transparent', alignItems: 'flex-end', gap: '10px'}}>
                                    <div className="sc-bar" style={{height: '40px'}}></div>
                                    <div className="sc-bar alt" style={{height: '20px'}}></div>
                                    <div className="sc-bar alt" style={{height: '35px'}}></div>
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
                                        <span className="ab-name">Bin #{bin.id}</span>
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
                                            <i className="fas fa-battery-three-quarters" style={{color: '#4caf50'}}></i> 85%
                                            <i className="fas fa-wifi" style={{color: '#4caf50', marginLeft: '8px'}}></i>
                                        </div>
                                    </div>
                                    <a href="#" className="ab-details-link" onClick={(e) => { e.preventDefault(); setBinDetail(bin); setShowAllBins(false); }}>Details <i className="fas fa-arrow-right"></i></a>
                                </div>
                            ))}
                        </div>
                        <button className="view-bins-btn" onClick={() => setShowAllBins(false)} style={{marginTop:'auto', alignSelf:'flex-end'}}>Minimize {'>'}</button>
                    </div>

                    {/* Hazard Alert (Hidden when All Bins shown) */}
                    <div className="card hazardous-card flex-0-8" style={{display: showAllBins ? 'none' : 'block'}}>
                        <div className="haz-header">
                            <i className="fas fa-exclamation-triangle"></i> Hazardous Waste Alert
                        </div>
                        <div className="haz-body">
                            <div style={{fontSize: '12px', color: '#888', marginBottom: '10px'}}>Today's Detections</div>
                            <div className="all-clear-card">
                                <div className="ac-title"><i className="fas fa-check-circle"></i> All Clear</div>
                                <div className="ac-sub">No active hazardous alerts</div>
                            </div>
                            
                            <div style={{fontSize: '12px', color: '#888', marginBottom: '10px', marginTop: '10px'}}>Recent Detections</div>
                            <div className="det-list">
                                <div className="det-item">
                                    <div className="det-info">
                                        <div>Bin #3 - Unknown</div>
                                        <div>waste</div>
                                    </div>
                                    <div className="det-time">10:45<br/>AM</div>
                                </div>
                                <div className="det-item">
                                    <div className="det-info">
                                        <div>Bin #1 - Unknown</div>
                                        <div>waste</div>
                                    </div>
                                    <div className="det-time">09:12<br/>AM</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Stack (Hidden when All Bins shown) */}
                    <div className="right-stack flex-1" style={{display: showAllBins ? 'none' : 'flex'}}>
                        <div className="mini-stat">
                            <div className="ms-content">
                                <h4>Total Bins</h4>
                                <h2>{systemStats.totalBins}</h2>
                                <span className="ms-trend"><i className="fas fa-arrow-up"></i> +2 from last month</span>
                            </div>
                            <div className="ms-icon bg-light-green"><i className="fas fa-trash"></i></div>
                        </div>

                        <div className="mini-stat">
                            <div className="ms-content">
                                <h4>Bins Rate</h4>
                                <h2>45%</h2>
                            </div>
                            <div className="ms-icon bg-light-green"><i className="fas fa-leaf"></i></div>
                        </div>

                        <div className="mini-stat">
                            <div className="ms-content">
                                <h4>Average Fill Level</h4>
                                <h2>{systemStats.avgFill}%</h2>
                            </div>
                            <div className="ms-icon bg-light-blue"><i className="fas fa-chart-bar"></i></div>
                        </div>
                    </div>
                </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
