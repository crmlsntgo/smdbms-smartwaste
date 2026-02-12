let wasteDoughnutChart;
let generalWasteChart;

const COLORS = {
  recyclable: "#4CAF50",
  biodegradable: "#8BC34A",
  nonbio: "#FF9800",
  general: "#3b82f6",
  gray: "#e5e7eb"
};

/* ================================
   PUBLIC RENDER FUNCTION
================================ */
export function renderWasteOverviewChart(data) {
  console.log("📊 renderWasteOverviewChart called with:", data);

  const {
    recyclable = 0,
    biodegradable = 0,
    non_biodegradable = 0,
    general_waste = 0
  } = data;

  updateSummary(recyclable, biodegradable, non_biodegradable);
  renderDoughnut(recyclable, biodegradable, non_biodegradable);
  renderGeneralWaste(general_waste);
}

/* ================================
   SUMMARY CARDS
================================ */
function updateSummary(r, b, n) {
  const recyclableEl = document.getElementById("recyclablePercent");
  const bioEl = document.getElementById("biodegradablePercent");
  const nonBioEl = document.getElementById("nonBioPercent");

  if (recyclableEl) recyclableEl.textContent = `${r}%`;
  if (bioEl) bioEl.textContent = `${b}%`;
  if (nonBioEl) nonBioEl.textContent = `${n}%`;
}

/* ================================
   MAIN WASTE DOUGHNUT
================================ */
function renderDoughnut(r, b, n) {
  const canvas = document.getElementById("wasteDoughnut");
  if (!canvas) {
    console.warn("❌ Canvas 'wasteDoughnut' not found");
    return;
  }

  if (wasteDoughnutChart) wasteDoughnutChart.destroy();

  wasteDoughnutChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Recyclable", "Biodegradable", "Non-Biodegradable"],
      datasets: [{
        data: [r, b, n],
        backgroundColor: [
          COLORS.recyclable,
          COLORS.biodegradable,
          COLORS.nonbio
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.parsed}%`
          }
        }
      }
    }
  });

  console.log("✅ Main doughnut chart rendered");
}

/* ================================
   GENERAL WASTE PROGRESS RING
================================ */
export function renderGeneralWaste(value) {
  const canvas = document.getElementById("generalWastePie");
  
  if (!canvas) {
    console.warn("❌ Canvas 'generalWastePie' not found in DOM");
    return;
  }

  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  
  console.log("🗑️ Rendering general waste chart:", {
    inputValue: value,
    calculatedPercent: percent,
    canvasFound: !!canvas
  });

  // CREATE ONCE
  if (!generalWasteChart) {
    console.log("Creating NEW general waste chart");
    
    generalWasteChart = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: ["Used", "Remaining"],
        datasets: [{
          data: [percent, 100 - percent],
          backgroundColor: [COLORS.general, COLORS.gray],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: "72%",
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      },
      plugins: [{
        id: "centerText",
        afterDraw(chart) {
          const { ctx, chartArea } = chart;
          const cx = (chartArea.left + chartArea.right) / 2;
          const cy = (chartArea.top + chartArea.bottom) / 2;
          
          // Get current percent from chart data
          const currentPercent = chart.data.datasets[0].data[0];

          ctx.save();
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          ctx.fillStyle = "#1f2937";
          ctx.font = "bold 32px Arial";
          ctx.fillText(`${currentPercent}%`, cx, cy - 6);

          ctx.font = "13px Arial";
          ctx.fillStyle = "#6b7280";
          ctx.fillText("Fill Level", cx, cy + 18);

          ctx.restore();
        }
      }]
    });

    console.log("✅ General waste chart created successfully");
    return;
  }

  // UPDATE ONLY
  console.log("Updating existing general waste chart");
  generalWasteChart.data.datasets[0].data = [percent, 100 - percent];
  generalWasteChart.update();
  console.log("✅ General waste chart updated");
}