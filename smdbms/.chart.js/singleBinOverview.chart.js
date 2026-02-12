let fillDonut = null;
let trendLine = null;
let wasteBar = null;

/* =====================================
   FILL LEVEL – DONUT (PROTOTYPE MATCH)
===================================== */
export function renderSingleBinFillChart(canvasId, percent) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return;

  if (fillDonut) fillDonut.destroy();

  
  let mainColor = "#22c55e"; // green (0–39)
  if (percent >= 40 && percent <= 69) mainColor = "#facc15"; // yellow
  if (percent >= 70) mainColor = "#ef4444"; // red


  const centerTextPlugin = {
    id: "centerText",
    beforeDraw(chart) {
      const { ctx, width, height } = chart;
      ctx.save();

      ctx.font = "700 28px Inter";
      ctx.fillStyle = "#111827";
      ctx.textAlign = "center";
      ctx.fillText(`${percent}%`, width / 2, height / 2 - 6);

      ctx.font = "500 13px Inter";
      ctx.fillStyle = "#6b7280";
      ctx.fillText("Fill Level", width / 2, height / 2 + 16);

      ctx.restore();
    }
  };

  fillDonut = new Chart(canvas, {
    type: "doughnut",
    data: {
      datasets: [{
        data: [percent, 100 - percent],
        backgroundColor: [mainColor, "#f3f4f6"],
        borderWidth: 0
      }]
    },
        options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "78%",

      // ✅ FULL CIRCULAR DONUT (SAFE)
      circumference: 360,
      rotation: 0,

      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      }
    },
    plugins: [centerTextPlugin]
  });
}

/* =====================================
   QUICK INSIGHTS – FILL TREND (TODAY)
===================================== */
export function renderFillTrendChart(canvasId, points = []) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return;

  if (trendLine) trendLine.destroy();

  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, 100);
  gradient.addColorStop(0, "rgba(59,130,246,0.35)");
  gradient.addColorStop(1, "rgba(59,130,246,0)");

  trendLine = new Chart(canvas, {
    type: "line",
    data: {
      labels: points.map(p => p.label),
      datasets: [{
        data: points.map(p => p.value),
        borderColor: "#3b82f6",
        backgroundColor: gradient,
        fill: true,
        tension: 0.45,
        pointRadius: 0,
        borderWidth: 1.8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: false },
        filler: { propagate: true }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 9 },
            color: "#9ca3af"
          }
        },
        y: {
          display: true,
          min: 0,
          max: 100,
          grid: { 
            color: "#f3f4f6",
            drawBorder: false,
            drawTicks: true,
            tickLength: 8
          },
          ticks: {
            font: { size: 8 },
            color: "#9ca3af",
            stepSize: 25,
            padding: 12,
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    }
  });
}

/* =====================================
   WASTE COMPOSITION – BAR (PROTOTYPE)
===================================== */
export function updateWasteComposition(canvasId, data = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return;

  // Safely extract and convert data to numbers, ensure they are percentages (0-100)
  const chartData = [
    Math.min(100, Math.max(0, Number(data.recyclable) || 0)),
    Math.min(100, Math.max(0, Number(data.biodegradable) || 0)),
    Math.min(100, Math.max(0, Number(data.non_biodegradable || data.nonBio) || 0)),
    Math.min(100, Math.max(0, Number(data.general_waste || data.general) || 0))
  ];

  console.log("Chart Data Values (0-100%):", chartData); // Debug log

  if (wasteBar) {
    wasteBar.destroy();
  }

  wasteBar = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Recyclable", "Bio", "Non-Bio", "General"],
      datasets: [{
        label: "Waste Percentage",
        data: chartData,
        backgroundColor: ["#22c55e", "#84cc16", "#fb923c", "#3b82f6"],
        borderRadius: 4,
        borderSkipped: false,
        barThickness: 16,
        categoryPercentage: 0.8,
        barPercentage: 0.9
      }]
    },
    options: {
      indexAxis: 'x',
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: { 
        legend: { display: false },
        tooltip: { 
          enabled: true,
          backgroundColor: 'rgba(17, 24, 39, 0.9)',
          padding: 10,
          cornerRadius: 6,
          displayColors: false,
          callbacks: {
            title: () => null, // Hide title
            label: function(context) {
              return `${context.label}: ${Math.round(context.parsed.y)}%`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 9, weight: '500' },
            color: "#6b7280",
            padding: 8
          }
        },
        y: {
          display: true,
          beginAtZero: true,
          min: 0,
          max: 100,
          grid: { 
            color: "#f3f4f6",
            drawBorder: false,
            drawTicks: true,
            tickLength: 8
          },
          ticks: {
            font: { size: 8 },
            color: "#9ca3af",
            stepSize: 25,
            padding: 12,
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    }
  });
}

