import React from 'react'

/**
 * System Overview Component
 * Renders active bins, avg fill level, bins requiring emptying, and maintenance schedule.
 * All data is passed as props — no direct DOM manipulation or Firebase calls.
 *
 * Props:
 *   activeBins: number
 *   totalBins: number
 *   averageFill: number (0-100)
 *   binsNeedingEmptying: number
 *   updatedAt: Date | string | null
 *   maintenanceItems: Array<{ binName, task, priority, time, color }>
 */

function getFillColor(fill) {
  if (fill >= 70) return '#ef4444'
  if (fill >= 40) return '#facc15'
  return '#22c55e'
}

function getDotClass(color) {
  const map = { green: 'd-green', blue: 'd-blue', purple: 'd-purple', red: 'd-red' }
  return map[color] || 'd-green'
}

export function SystemOverviewCard({
  activeBins = 0,
  totalBins = 0,
  averageFill = 0,
  binsNeedingEmptying = 0,
  updatedAt = null,
  maintenanceItems = []
}) {
  const safeFill = Math.max(0, Math.min(100, Math.round(averageFill)))
  const fillColor = getFillColor(safeFill)

  const formatTimestamp = (ts) => {
    if (!ts) return 'No data yet'
    return new Date(ts).toLocaleString()
  }

  return (
    <div className="card system-card flex-1">
      <div className="system-header">
        <span className="system-title">System Overview</span>
        <span className="last-updated">
          <i className="fas fa-sync-alt" style={{ marginRight: '6px', fontSize: '10px' }}></i>
          {formatTimestamp(updatedAt)}
        </span>
      </div>
      <div className="system-body">
        {/* Active Bins */}
        <div className="sys-stat-row">
          <span>Active Bins</span>
          <span className="sys-val">
            {activeBins}/{totalBins}
            <span
              className="badge-active"
              style={{
                backgroundColor: activeBins > 0 ? '#e8f5e9' : '#f3f4f6',
                color: activeBins > 0 ? '#2e7d32' : '#9ca3af',
                marginLeft: '8px', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600
              }}
            >
              {activeBins > 0 ? 'Active' : 'No Bins'}
            </span>
          </span>
        </div>

        {/* Average Fill Level */}
        <div className="sys-stat-row">
          <span>Average Fill Level</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span className="sys-val" style={{ marginBottom: '4px' }}>{safeFill}%</span>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${safeFill}%`, backgroundColor: fillColor }}></div>
            </div>
          </div>
        </div>

        {/* Bins Requiring Emptying */}
        <div className="sys-stat-row">
          <span>
            Bins Requiring Emptying
            <span
              style={{
                display: 'inline-block',
                width: '8px', height: '8px',
                borderRadius: '50%',
                backgroundColor: binsNeedingEmptying > 0 ? '#ef4444' : '#9ca3af',
                marginLeft: '6px'
              }}
            ></span>
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span className="sys-val" style={{ marginBottom: '4px' }}>{binsNeedingEmptying}</span>
          </div>
        </div>

        {/* Maintenance Schedule */}
        <div className="maint-title">
          <i className="fas fa-calendar-alt" style={{ color: '#ff9800' }}></i> Bins To Be Maintenanced
        </div>
        <div className="maint-list">
          {maintenanceItems.length === 0 ? (
            <span style={{ display: 'block', fontSize: '0.85rem', color: '#999' }}>
              No scheduled maintenance
            </span>
          ) : (
            maintenanceItems.slice(0, 4).map((item, idx) => (
              <div className="maint-item" key={idx}>
                <div className={`m-dot ${getDotClass(item.color)}`}></div>
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
  )
}

/**
 * Compute maintenance items from bins array.
 * Mirrors the logic from systemOverview.chart.js::updateMaintenanceSchedule
 */
export function computeMaintenanceSchedule(bins = []) {
  const items = []

  const future = (days) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return `${d.toLocaleDateString()} 10:00 AM`
  }

  bins.forEach(bin => {
    const name = bin.name || bin.binName || bin.id || 'Unknown Bin'
    const wc = bin.waste_composition || {}
    const recyclable = Number(wc.recyclable) || 0
    const biodegradable = Number(wc.biodegradable) || 0
    const nonBio = Number(wc.non_biodegradable || wc.nonBio) || 0
    const general = Number(bin.general_waste) || 0

    const streams = [
      { type: 'Recyclable', value: recyclable },
      { type: 'Biodegradable', value: biodegradable },
      { type: 'Non-Biodegradable', value: nonBio },
      { type: 'General', value: general }
    ]

    const avgFill = Math.round((recyclable + biodegradable + nonBio + general) / 4)

    if (avgFill >= 80) {
      items.push({ binName: name, task: 'Emptying', priority: 1, time: 'Today, ASAP', color: 'red' })
      return
    }

    streams.forEach(s => {
      if (s.value >= 80) {
        items.push({ binName: name, task: `Cleaning - ${s.type}`, priority: 2, time: future(1), color: 'purple' })
      }
    })
  })

  return items.slice(0, 4)
}

export default SystemOverviewCard
