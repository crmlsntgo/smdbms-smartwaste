import React from 'react'

/**
 * Metrics Overview Cards Component
 * Replaces the DOM-based metricsOverview.chart.js with a pure React component.
 *
 * Props:
 *   totalBins: number
 *   binsChange: number (change from last month)
 *   binsRate: number (percentage 0-100)
 *   averageFillLevel: number (percentage 0-100)
 */
export function MetricsCards({ totalBins = 0, binsChange = 0, binsRate = 0, averageFillLevel = 0 }) {
  const changeDisplay = () => {
    if (binsChange > 0) {
      return (
        <span className="ms-trend" style={{ color: '#10b981' }}>
          <i className="fas fa-arrow-up"></i> +{binsChange} from last month
        </span>
      )
    }
    if (binsChange < 0) {
      return (
        <span className="ms-trend" style={{ color: '#ef4444' }}>
          <i className="fas fa-arrow-down"></i> {binsChange} from last month
        </span>
      )
    }
    return <span className="ms-trend" style={{ color: '#9ca3af' }}>No change</span>
  }

  return (
    <div className="right-stack flex-1">
      {/* Total Bins */}
      <div className="mini-stat">
        <div className="ms-content">
          <h4>Total Bins</h4>
          <h2>{totalBins}</h2>
          {changeDisplay()}
        </div>
        <div className="ms-icon bg-light-green"><i className="fas fa-trash"></i></div>
      </div>

      {/* Bins Rate */}
      <div className="mini-stat">
        <div className="ms-content">
          <h4>Bins Rate</h4>
          <h2>{binsRate}%</h2>
        </div>
        <div className="ms-icon bg-light-green"><i className="fas fa-leaf"></i></div>
      </div>

      {/* Average Fill Level */}
      <div className="mini-stat">
        <div className="ms-content">
          <h4>Average Fill Level</h4>
          <h2>{averageFillLevel}%</h2>
        </div>
        <div className="ms-icon bg-light-blue"><i className="fas fa-chart-bar"></i></div>
      </div>
    </div>
  )
}

/**
 * Process all bins data to compute metrics.
 * Returns { totalBins, binsRate, avgFill, change }
 */
export function processMetricsData(allBinsData = [], previousCount = null) {
  const totalBins = allBinsData.length
  let totalFill = 0
  let validBins = 0
  let activeBinsCount = 0

  allBinsData.forEach(bin => {
    const wc = bin.waste_composition || {}
    const val = (
      (Number(wc.recyclable) || 0) +
      (Number(wc.biodegradable) || 0) +
      (Number(wc.non_biodegradable) || Number(wc.nonBio) || 0) +
      (Number(bin.general_waste) || 0)
    ) / 4

    totalFill += val
    validBins++
    if (val > 50) activeBinsCount++
  })

  const avgFill = validBins > 0 ? Math.round(totalFill / validBins) : 0
  const binsRate = totalBins > 0 ? Math.round((activeBinsCount / totalBins) * 100) : 0
  const change = previousCount !== null ? totalBins - previousCount : 0

  return { totalBins, binsRate, avgFill, change }
}

export default MetricsCards
