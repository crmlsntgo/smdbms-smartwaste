import React, { useRef, useEffect } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

const COLORS = {
  recyclable: '#4CAF50',
  biodegradable: '#8BC34A',
  nonbio: '#FF9800',
  general: '#3b82f6',
  gray: '#e5e7eb'
}

/**
 * Waste Distribution Doughnut Chart
 * Props: recyclable, biodegradable, non_biodegradable (percentages 0-100)
 */
export function WasteDoughnutChart({ recyclable = 0, biodegradable = 0, non_biodegradable = 0 }) {
  const total = recyclable + biodegradable + non_biodegradable
  const hasData = total > 0

  const data = {
    labels: hasData ? ['Recyclable', 'Biodegradable', 'Non-Biodegradable'] : ['No Data'],
    datasets: [{
      data: hasData ? [recyclable, biodegradable, non_biodegradable] : [1],
      backgroundColor: hasData ? [COLORS.recyclable, COLORS.biodegradable, COLORS.nonbio] : [COLORS.gray],
      borderWidth: 0
    }]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '70%',
    layout: {
      padding: 40
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: hasData,
        callbacks: {
          label: ctx => `${ctx.label}: ${ctx.parsed}%`
        }
      }
    }
  }

  const floatingLabelsPlugin = {
    id: 'floatingLabels',
    afterDraw(chart) {
      if (!hasData) return
      const { ctx, chartArea: { width, height } } = chart
      const meta = chart.getDatasetMeta(0)
      
      meta.data.forEach((element, index) => {
        // Skip hidden or zero values
        if (element.hidden || chart.data.datasets[0].data[index] === 0) return

        const { x, y, outerRadius, startAngle, endAngle } = element
        const midAngle = startAngle + (endAngle - startAngle) / 2
        
        // Calculate position outside the doughnut
        const extraRadius = 20
        const labelR = outerRadius + extraRadius
        
        const labelX = x + Math.cos(midAngle) * labelR
        const labelY = y + Math.sin(midAngle) * labelR

        const labelText = chart.data.labels[index]
        const valueText = chart.data.datasets[0].data[index] + '%'
        const color = chart.data.datasets[0].backgroundColor[index]

        ctx.save()
        
        // Determine alignment
        const isRight = labelX > x
        ctx.textAlign = isRight ? 'left' : 'right'
        ctx.textBaseline = 'middle'

        // Draw Label Name
        ctx.font = '600 10px Inter, sans-serif'
        ctx.fillStyle = color
        ctx.fillText(labelText + ':', labelX, labelY - 6)

        // Draw Value
        ctx.font = 'bold 10px Inter, sans-serif'
        ctx.fillStyle = '#1f2937' // dark gray
        ctx.fillText(valueText, labelX, labelY + 6)
        
        ctx.restore()
      })
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <Doughnut 
        data={data} 
        options={options} 
        plugins={[floatingLabelsPlugin]}
        key={`waste-${recyclable}-${biodegradable}-${non_biodegradable}`} 
      />
    </div>
  )
}

/**
 * General Waste Progress Ring
 * Props: value (percentage 0-100)
 */
export function GeneralWasteChart({ value = 0 }) {
  const percent = Math.max(0, Math.min(100, Number(value) || 0))

  const centerTextPlugin = {
    id: 'generalWasteCenterText',
    afterDraw(chart) {
      const { ctx, chartArea } = chart
      if (!chartArea) return
      const cx = (chartArea.left + chartArea.right) / 2
      const cy = (chartArea.top + chartArea.bottom) / 2
      const currentPercent = chart.data.datasets[0].data[0]

      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#1f2937'
      ctx.font = 'bold 32px Inter, sans-serif'
      ctx.fillText(`${currentPercent}%`, cx, cy - 6)
      ctx.font = '13px Inter, sans-serif'
      ctx.fillStyle = '#6b7280'
      ctx.fillText('Fill Level', cx, cy + 18)
      ctx.restore()
    }
  }

  const data = {
    labels: ['Used', 'Remaining'],
    datasets: [{
      data: [percent, 100 - percent],
      backgroundColor: [COLORS.general, COLORS.gray],
      borderWidth: 0
    }]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '72%',
    layout: {
      padding: 40
    },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false }
    }
  }

  return <Doughnut data={data} options={options} plugins={[centerTextPlugin]} />
}

export default { WasteDoughnutChart, GeneralWasteChart }
