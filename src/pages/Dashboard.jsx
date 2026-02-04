import React, { useEffect, useState, useMemo } from 'react'
import { getFirestore, doc, onSnapshot, collection } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import initFirebase from '../firebaseConfig'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import '../styles/vendor/dashboard-style.css'
import '../styles/vendor/header.css'

export default function Dashboard() {
  const [userName, setUserName] = useState('')
  const [wasteData, setWasteData] = useState({ recyclable: 0, biodegradable: 0, non_biodegradable: 0 })
  const [fillLevel, setFillLevel] = useState(0)
  const [totalBins, setTotalBins] = useState(15)
  const [viewAllBins, setViewAllBins] = useState(false)
  
  // Initialize Firebase once
  const app = initFirebase()
  const db = getFirestore(app)
  const auth = getAuth(app)

  useEffect(() => {
    // Auth Listener
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      if (user) {
        setUserName(user.displayName || (user.email ? user.email.split('@')[0] : 'User'))
      } else {
         window.location.href = '/login'
      }
    })

    // Bin subscription (BIN001)
    const dashboardRef = doc(db, 'dashboard', 'BIN001')
    const unsubscribeBin = onSnapshot(dashboardRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data()
            
            // Update waste composition
            if (data.waste_composition) {
                setWasteData({
                    recyclable: data.waste_composition.recyclable || 0,
                    biodegradable: data.waste_composition.biodegradable || 0,
                    non_biodegradable: data.waste_composition.non_biodegradable || 0
                })
            }
            // Update fill level
            if (typeof data.fill_level === 'number') {
                setFillLevel(data.fill_level)
            }
        }
    }, (error) => {
        console.error("Error listening to dashboard:", error)
    })

    // Total Bins subscription
    const binsRef = collection(db, 'dashboard')
    const unsubscribeTotal = onSnapshot(binsRef, (snap) => {
        setTotalBins(snap.size)
    }, (error) => {
        console.error("Error listening to total bins:", error)
    })

    return () => {
        unsubscribeAuth()
        unsubscribeBin()
        unsubscribeTotal()
    }
  }, [])

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

  // Donut Chart Gradient
  const stop1 = pRecyc
  const stop2 = pRecyc + pNonBio
  const wasteGradient = `conic-gradient(
      #4caf50 0% ${stop1}%,
      #ff9800 ${stop1}% ${stop2}%,
      #cddc39 ${stop2}% 100%
  )`

  // Fill Level Gradient
  let fillColor = '#4caf50'
  if (fillLevel > 50) fillColor = '#ffc107'
  if (fillLevel > 80) fillColor = '#f44336'
  
  const fillGradient = `conic-gradient(
      ${fillColor} 0% ${fillLevel}%,
      #f0f0f0 ${fillLevel}% 100%
  )`

  // Trend Chart Logic
  const trendData = useMemo(() => {
    // Simulate past data for visual effect (matching legacy chart-utils.js logic)
    // Legacy maps 0-100% to Y=130-30
    const mapY = (val) => 130 - val
    const xCoords = [70, 150, 230] // Adjusted slightly from legacy for fit
    
    // Normalize current data to 0-100 range relative to total
    const total = wasteData.recyclable + wasteData.biodegradable + wasteData.non_biodegradable || 1
    const norm = (val) => (val / total) * 100

    return [
       { color: '#4caf50', points: [35, 40, norm(wasteData.recyclable)] },
       { color: '#cddc39', points: [25, 28, norm(wasteData.biodegradable)] },
       { color: '#ff9800', points: [40, 32, norm(wasteData.non_biodegradable)] }
    ].map(series => {
        const points = series.points.map((val, i) => `${xCoords[i]},${mapY(val)}`).join(' ')
        const dots = series.points.map((val, i) => ({ cx: xCoords[i], cy: mapY(val) }))
        return { ...series, pointsStr: points, dots }
    })
  }, [wasteData])

  // Generate last 3 months labels
  const monthLabels = useMemo(() => {
    const now = new Date()
    const months = []
    for (let i = 2; i >= 0; i--) {
        const d = new Date()
        d.setDate(1) // Fix: Prevent month rollover on 31st (e.g. Jan 31 -> Nov 31 -> Dec 1)
        d.setMonth(now.getMonth() - i)
        months.push(d.toLocaleString('default', { month: 'short' }))
    }
    return months
  }, [])

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
                    <div className="card waste-card flex-2">
                        <div className="waste-header">
                            <h3><i className="far fa-clock"></i> Waste Overview</h3>
                            <p>Distribution and trends across waste categories</p>
                        </div>
                        <div className="waste-body">
                            <div className="charts-row">
                                {/* Current Distribution */}
                                <div className="donut-section">
                                    <div style={{textAlign: 'center'}}>
                                        <h4 style={{fontSize: '12px', marginBottom: '20px'}}>Current Distribution</h4>
                                        <div className="donut-chart" style={{background: wasteGradient}}>
                                            <div className="donut-hole"></div>
                                            <div className="donut-labels">
                                                <span className="d-label recyclable">Recyclable: <span>{pRecyc}</span>%</span>
                                                <span className="d-label biodegradable">Biodegradable: <span>{pBio}</span>%</span>
                                                <span className="d-label non-bio">\Non-Biodegradable: <span>{pNonBio}</span>%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* 3 Month Trend */}
                                <div className="line-chart-section">
                                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '15px'}}>
                                        <h4 style={{fontSize: '12px'}}>3-Month Trend</h4>
                                    </div>
                                    <div style={{height: '150px', width: '100%'}}>
                                        <svg className="line-chart-svg" viewBox="0 0 300 150">
                                            {/* Grid Lines */}
                                            {[30, 70, 110].map(y => (
                                                <line key={y} x1="30" y1={y} x2="290" y2={y} className="grid-line" />
                                            ))}
                                            {/* Y Axis Labels */}
                                            <text x="10" y="140" className="trend-axis-text">0</text>
                                            <text x="10" y="30" className="trend-axis-text">100</text>
                                            
                                            {/* X Axis Labels */}
                                            {monthLabels.map((m, i) => (
                                                <text key={i} x={[70, 150, 230][i]} y="145" className="trend-axis-text">{m}</text>
                                            ))}

                                            {/* Data Series */}
                                            {trendData.map((series, idx) => (
                                                <React.Fragment key={idx}>
                                                    <polyline 
                                                        points={series.pointsStr} 
                                                        fill="none" 
                                                        stroke={series.color} 
                                                        strokeWidth="2" 
                                                        className="chart-line" 
                                                    />
                                                    {series.dots.map((dot, dIdx) => (
                                                        <circle 
                                                            key={dIdx}
                                                            cx={dot.cx} 
                                                            cy={dot.cy} 
                                                            r="3" 
                                                            fill="white" 
                                                            stroke={series.color} 
                                                            strokeWidth="2" 
                                                            className="chart-dot" 
                                                        />
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            {/* Legend Cards */}
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
                            <span className="last-updated">Last Updated: Today, 12:45 PM</span>
                        </div>
                        <div className="system-body">
                            {/* Stats List */}
                            <div className="sys-stat-row">
                                <span>Active Bins</span>
                                <span className="sys-val"><span>12/15</span> <span className="badge-active">Active</span></span>
                            </div>
                            <div className="sys-stat-row">
                                <span>Average Fill Level</span>
                                <div style={{display:'flex', flexDirection:'column', alignItems:'flexEnd'}}>
                                    <span className="sys-val" style={{marginBottom:'4px'}}>{fillLevel}%</span>
                                    <div className="progress-track"><div className="progress-fill" style={{width: `${fillLevel}%`, background: '#ffc107'}}></div></div>
                                </div>
                            </div>
                            <div className="sys-stat-row">
                                <span>Bins Requiring Emptying</span>
                                <div style={{display:'flex', flexDirection:'column', alignItems:'flexEnd'}}>
                                     <span className="sys-val" style={{marginBottom:'4px'}}>3</span>
                                     <div className="progress-track"><div className="progress-fill" style={{width: '30%', background: '#f44336'}}></div></div>
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
                                 <div className="maint-item">
                                    <div className="m-dot d-purple"></div>
                                    <div className="m-content">
                                        <h4>Bin # 4 Cleaning</h4>
                                        <p>Dec 15, 10:00 AM</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM ROW */}
                <div className="row-bottom">
                     {/* Bin #01 */}
                    <div className="card bin-card flex-2">
                        <div className="bin-header">
                            <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                <span style={{width:'10px', height:'10px', background:'#00e676', borderRadius:'50%'}}></span>
                                Bin #01
                            </div>
                            <span className="bin-sub">Main Building Bin</span>
                        </div>
                        <div className="bin-body">
                            {/* Donut Col */}
                            <div className="bin-col-1">
                                <div className="fill-donut" style={{background: fillGradient}}>
                                    <div className="fill-inner">
                                        <span className="fi-val"><span>{fillLevel}</span> %</span>
                                        <span className="fi-lbl">Fill Level</span>
                                    </div>
                                </div>
                                <div className="bin-meta">
                                    <div>Fill Rate: 4.2% per hour</div>
                                    <div>Last Emptied: 2 days ago</div>
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
                                        <div className="batt-bar"><div className="batt-fill"></div></div>
                                        <span style={{fontSize:'12px', fontWeight:'600'}}>85%</span>
                                    </div>
                                </div>
                                 <div className="b-stat-group">
                                    <h4><i className="fas fa-wifi"></i> Connectivity</h4>
                                    <span className="conn-sig"> <i className="fas fa-signal"></i> Strong signal</span>
                                </div>
                            </div>
                            {/* KPI Col */}
                            <div className="bin-col-3">
                                <h4 style={{fontSize:'14px', fontWeight:'700'}}>Quick Insights</h4>
                                 <div style={{fontSize:'12px', color:'#666'}}>Fill Level Today</div>
                                 {/* Area chart mock */}
                                 <div className="small-chart-box" style={{background: 'linear-gradient(to top, #e3f2fd, white)', borderBottom: '2px solid #2196f3'}}>
                                     {/* Mock time axis */}
                                 </div>
                                 <div style={{fontSize:'10px', display:'flex', justifyContent:'space-between', color:'#999'}}>
                                     <span>10:00</span><span>12:00</span><span>14:00</span><span>16:00</span>
                                 </div>
                                 
                                 <div style={{fontSize:'12px', color:'#666', marginTop:'5px'}}>Waste Composition</div>
                                  <div className="small-chart-box" style={{background:'transparent', alignItems:'flex-end', gap:'10px'}}>
                                       <div className="sc-bar" style={{height:'40px'}}></div>
                                       <div className="sc-bar alt" style={{height:'20px'}}></div>
                                       <div className="sc-bar alt" style={{height:'35px'}}></div>
                                  </div>
                            </div>
                        </div>
                         <button className="view-bins-btn" onClick={() => setViewAllBins(!viewAllBins)}>
                             {viewAllBins ? 'Minimize >' : 'View Bins >'}
                         </button>
                    </div>

                    {/* Hazard Alert (Toggleable) */}
                    <div className={`card hazardous-card flex-0-8 ${viewAllBins ? 'hidden' : ''}`} id="hazardCard">
                         <div className="haz-header">
                            <i className="fas fa-exclamation-triangle"></i> Hazardous Waste Alert
                        </div>
                        <div className="haz-body">
                            <div style={{fontSize:'12px', color:'#888', marginBottom:'10px'}}>Today's Detections</div>
                            <div className="all-clear-card">
                                <div className="ac-title"><i className="fas fa-check-circle"></i> All Clear</div>
                                <div className="ac-sub">No active hazardous alerts</div>
                            </div>
                            
                            <div style={{fontSize:'12px', color:'#888', marginBottom:'10px'}}>Recent Detections</div>
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
                                  <div className="det-item">
                                     <div className="det-info">
                                         <div>Bin #2 - Unknown</div>
                                         <div>substance</div>
                                     </div>
                                     <div className="det-time">Yesterday</div>
                                 </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Stats Stack (Toggleable) */}
                    <div className={`right-stack flex-1 ${viewAllBins ? 'hidden' : ''}`} id="rightStack">
                        <div className="mini-stat">
                            <div className="ms-content">
                                <h4>Total Bins</h4>
                                <h2><span>{totalBins}</span></h2>
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
                                <h2>68%</h2>
                            </div>
                             <div className="ms-icon bg-light-blue"><i className="fas fa-chart-bar"></i></div>
                        </div>
                    </div>

                    {/* All Bins View (Hidden by Default) */}
                    <div className={`card all-bins-card ${viewAllBins ? 'visible-flex' : ''}`} id="allBinsView">
                        <div className="ab-outer-header">All Bins</div>
                        <div className="ab-list-container">
                            {/* Bin #01 */}
                            <div className="ab-item">
                                <div className="ab-header">
                                    <span className="ab-status-dot dot-green"></span>
                                    <span className="ab-name">Bin #01</span>
                                    <i className="fas fa-exclamation-triangle ab-alert-icon" style={{color: '#ff9800', opacity: 0}}></i>
                                </div>
                                <div className="ab-loc">Main Processing Area</div>
                                <div className="ab-stats">
                                    <div className="ab-fill-group">
                                        <span className="ab-label">Fill Level</span>
                                        <div className="ab-progress-track"><div className="ab-progress-fill" style={{width: '78%', background: '#ffc107'}}></div></div>
                                        <span className="ab-val">78%</span>
                                    </div>
                                    <div className="ab-conn">
                                        <i className="fas fa-battery-three-quarters" style={{color: '#4caf50'}}></i> 85%
                                        <i className="fas fa-wifi" style={{color: '#4caf50', marginLeft: '8px'}}></i>
                                    </div>
                                </div>
                                <a href="#" className="ab-details-link">Details <i className="fas fa-arrow-right"></i></a>
                            </div>
                            {/* Bin #02 */}
                            <div className="ab-item">
                                <div className="ab-header">
                                    <span className="ab-status-dot dot-orange"></span>
                                    <span className="ab-name">Bin #02</span>
                                    <i className="fas fa-exclamation-triangle ab-alert-icon" style={{color: '#ff9800'}}></i>
                                </div>
                                <div className="ab-loc">Cafeteria</div>
                                <div className="ab-stats">
                                    <div className="ab-fill-group">
                                        <span className="ab-label">Fill Level</span>
                                        <div className="ab-progress-track"><div className="ab-progress-fill" style={{width: '92%', background: '#f44336'}}></div></div>
                                        <span className="ab-val">92%</span>
                                    </div>
                                    <div className="ab-conn">
                                        <i className="fas fa-battery-three-quarters" style={{color: '#4caf50'}}></i> 72%
                                        <i className="fas fa-wifi" style={{color: '#ff9800', marginLeft: '8px'}}></i>
                                    </div>
                                </div>
                                <div style={{fontSize: '10px', color: '#f44336', marginTop: '5px', fontWeight: '600'}}><i className="fas fa-exclamation-circle"></i> 1 Alert</div>
                                <a href="#" className="ab-details-link">Details <i className="fas fa-arrow-right"></i></a>
                            </div>
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
