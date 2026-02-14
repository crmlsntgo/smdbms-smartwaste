import React from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler } from 'chart.js'
import { Doughnut, Line, Bar } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler)

/**
 * Fill Level Donut for a single bin
 * Props: percent (0-100)
 */
export function SingleBinFillChart({ percent = 0 }) {
  const safePct = Math.max(0, Math.min(100, Math.round(percent)))

  let mainColor = '#22c55e'
  if (safePct >= 40 && safePct <= 69) mainColor = '#facc15'
  if (safePct >= 70) mainColor = '#ef4444'

  const centerTextPlugin = {
    id: 'singleBinCenterText',
    afterDraw(chart) {
      const { ctx, width, height } = chart
      const currentVal = chart.data.datasets[0].data[0]
      ctx.save()
      ctx.font = '700 28px Inter, Arial'
      ctx.fillStyle = '#111827'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${currentVal}%`, width / 2, height / 2 - 6)
      ctx.font = '500 13px Inter, Arial'
      ctx.fillStyle = '#6b7280'
      ctx.fillText('Fill Level', width / 2, height / 2 + 16)
      ctx.restore()
    }
  }

  const data = {
    datasets: [{
      data: [safePct, 100 - safePct],
      backgroundColor: [mainColor, '#f3f4f6'],
      borderWidth: 0
    }]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '78%',
    circumference: 360,
    rotation: 0,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false }
    }
  }

  return <Doughnut data={data} options={options} plugins={[centerTextPlugin]} />
}

/**
 * Fill Level Trend Line Chart (sparkline)
 * Props: points - Array<{ label: string, value: number }>
 */
export function FillTrendChart({ points = [] }) {
  if (points.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: '12px' }}>No trend data</div>
  }

  const data = {
    labels: points.map(p => p.label),
    datasets: [{
      data: points.map(p => p.value),
      borderColor: '#3b82f6',
      backgroundColor: (context) => {
        const chart = context.chart
        const { ctx, chartArea } = chart
        if (!chartArea) return 'rgba(59,130,246,0.1)'
        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
        gradient.addColorStop(0, 'rgba(59,130,246,0.35)')
        gradient.addColorStop(1, 'rgba(59,130,246,0)')
        return gradient
      },
      fill: true,
      tension: 0.45,
      pointRadius: 0,
      borderWidth: 1.8
    }]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      filler: { propagate: true }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 9 }, color: '#9ca3af' }
      },
      y: {
        display: true,
        min: 0,
        max: 100,
        grid: { color: '#f3f4f6', drawBorder: false, drawTicks: true, tickLength: 8 },
        ticks: {
          font: { size: 8 },
          color: '#9ca3af',
          stepSize: 25,
          padding: 12,
          callback: (value) => value + '%'
        }
      }
    }
  }

  return <Line data={data} options={options} />
}

/**
 * Waste Composition Bar Chart
 * Props: data - { recyclable, biodegradable, non_biodegradable, general_waste }
 */
export function WasteCompositionBar({ data: wasteData = {} }) {
  const chartData = [
    Math.min(100, Math.max(0, Number(wasteData.recyclable) || 0)),
    Math.min(100, Math.max(0, Number(wasteData.biodegradable) || 0)),
    Math.min(100, Math.max(0, Number(wasteData.non_biodegradable || wasteData.nonBio) || 0)),
    Math.min(100, Math.max(0, Number(wasteData.general_waste || wasteData.general) || 0))
  ]

  const data = {
    labels: ['Recyclable', 'Bio', 'Non-Bio', 'General'],
    datasets: [{
      label: 'Waste Percentage',
      data: chartData,
      backgroundColor: ['#22c55e', '#84cc16', '#fb923c', '#3b82f6'],
      borderRadius: 4,
      borderSkipped: false,
      barThickness: 16,
      categoryPercentage: 0.8,
      barPercentage: 0.9
    }]
  }

  const options = {
    indexAxis: 'x',
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        padding: 10,
        cornerRadius: 6,
        displayColors: false,
        callbacks: {
          title: () => null,
          label: (context) => `${context.label}: ${Math.round(context.parsed.y)}%`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 9, weight: '500' }, color: '#6b7280', padding: 8 }
      },
      y: {
        display: true,
        beginAtZero: true,
        min: 0,
        max: 100,
        grid: { color: '#f3f4f6', drawBorder: false, drawTicks: true, tickLength: 8 },
        ticks: {
          font: { size: 8 },
          color: '#9ca3af',
          stepSize: 25,
          padding: 12,
          callback: (value) => value + '%'
        }
      }
    }
  }

  return <Bar data={data} options={options} />
}

export default { SingleBinFillChart, FillTrendChart, WasteCompositionBar }
