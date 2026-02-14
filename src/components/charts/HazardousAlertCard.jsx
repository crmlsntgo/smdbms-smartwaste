import React from 'react'

/**
 * Hazardous Alert Card Component
 * Replaces the DOM-based hazardousAlertOverview.chart.js with a pure React component.
 *
 * Props:
 *   hasHazardous: boolean
 *   detections: Array<{ bin_name, bin_id, type, gas_detected, detected_at }>
 */

function getTime(ts) {
  if (!ts) return 0
  if (typeof ts.toDate === 'function') return ts.toDate().getTime()
  if (typeof ts === 'string') return new Date(ts).getTime()
  return new Date(ts).getTime()
}

function formatDetectionTime(ts) {
  const time = getTime(ts)
  if (!time) return 'Just now'
  const now = Date.now()
  const diff = now - time
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(diff / 3600000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`
  return new Date(time).toLocaleDateString()
}

export function HazardousAlertCard({ hasHazardous = false, detections = [] }) {
  const sorted = [...detections]
    .sort((a, b) => getTime(b.detected_at) - getTime(a.detected_at))
    .slice(0, 5)

  return (
    <div className="card hazardous-card flex-0-8">
      <div className="haz-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="haz-title" style={{ marginLeft: '8px' }}>Hazardous Waste Alert</span>
      </div>
      <div className="haz-body">
        {/* Today's Detections */}
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>Today's Detections</div>

        {/* Status Box */}
        {hasHazardous ? (
          <div style={{ background: '#fee2e2', borderLeft: '4px solid #ef4444', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
            <div style={{ color: '#991b1b', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v2m0 4h.01M5.062 20h13.876c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.33 17c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Hazardous Alert
            </div>
            <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px', marginLeft: '24px' }}>
              {detections.length} hazardous detection{detections.length !== 1 ? 's' : ''}
            </div>
          </div>
        ) : (
          <div className="all-clear-card">
            <div className="ac-title">
              <i className="fas fa-check-circle"></i> All Clear
            </div>
            <div className="ac-sub">No active hazardous alerts</div>
          </div>
        )}

        {/* Recent Detections */}
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', marginTop: '10px' }}>Recent Detections</div>
        <div className="det-list">
          {sorted.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '20px 0' }}>No recent detections</div>
          ) : (
            sorted.map((d, idx) => {
              const binName = d.bin_name || d.bin_id || d.bin || 'Unknown Bin'
              const type = d.type || 'Unknown'
              const isGas = d.gas_detected
              const label = isGas ? `${binName} - ${type} - Gas` : `${binName} - ${type} - Unknown waste`
              const labelColor = isGas ? '#dc2626' : '#4CAF50'

              return (
                <div className="det-item" key={idx}>
                  <div className="det-info">
                    <div style={{ color: labelColor }}>{label}</div>
                  </div>
                  <div className="det-time">{formatDetectionTime(d.detected_at)}</div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Process hazardous data from bins array or detections array.
 * Returns { hasHazardous, detections }
 */
export function processHazardousData(input) {
  let detections = []
  let hazardousCount = 0

  if (Array.isArray(input) && input.length > 0 && input[0].detected_at) {
    detections = input.filter(d => d.hazardous_detected !== false)
    hazardousCount = detections.length
  } else {
    const bins = Array.isArray(input) ? input : [input]
    bins.forEach(bin => {
      const isHazardous = bin.hazardous_detected === true
      if (isHazardous) hazardousCount++

      if (Array.isArray(bin.recent_detections)) {
        bin.recent_detections.forEach(d => {
          detections.push({
            ...d,
            hazardous_detected: true,
            bin_id: bin.id || bin.bin_id || bin.serial,
            detected_at: d.detected_at || bin.updated_at
          })
        })
      } else if (isHazardous) {
        detections.push({
          bin_id: bin.id || bin.bin_id || bin.serial,
          type: bin.type || 'Hazardous',
          gas_detected: bin.gas_detected || false,
          hazardous_detected: true,
          detected_at: bin.updated_at || new Date()
        })
      }
    })
  }

  return { hasHazardous: hazardousCount > 0, detections }
}

export default HazardousAlertCard
