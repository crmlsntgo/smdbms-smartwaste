/* ================================
   SYSTEM OVERVIEW
================================ */
window.updateSystemOverview = function ({
  activeBins = 0,
  totalBins = 0,
  averageFill = 0,
  binsNeedingEmptying = 0,
  updatedAt
}) {
  // 🔁 ONE timestamp for EVERYTHING
  updateLastUpdate(updatedAt);

  updateActiveBins(activeBins, totalBins);
  updateAverageFillLevel(averageFill);
  updateBinsRequiringEmptying(binsNeedingEmptying, totalBins);
};

/* ================================
   LAST UPDATED
================================ */
function updateLastUpdate(ts) {
  const el = document.getElementById("lastUpdatedText");
  const icon = document.querySelector(".last-updated i");
  if (!el) return;

  if (!ts) {
    el.textContent = "No data yet";
    return;
  }

  el.textContent = new Date(ts).toLocaleString();
  
  // Animate icon briefly
  if (icon) {
    icon.classList.remove("updating");
    // Trigger reflow to restart animation
    void icon.offsetWidth;
    icon.classList.add("updating");
    
    // Remove animation class after it completes
    setTimeout(() => {
      icon.classList.remove("updating");
    }, 800);
  }
}

/* ================================
   ACTIVE BINS
================================ */
function updateActiveBins(active, total) {
  const value = document.getElementById("activeBinsValue");
  const badge = document.getElementById("activeBinsBadge");
  const bar = document.getElementById("activeBinsProgress");

  if (value) value.textContent = `${active}/${total || 0}`;

  if (badge) {
    badge.textContent = active > 0 ? "Active" : "No Bins";
    badge.style.backgroundColor = active > 0 ? "#10b981" : "#9ca3af";
  }

  if (bar && total > 0) {
    bar.style.width = `${(active / total) * 100}%`;
    bar.style.backgroundColor = "#10b981";
  }
}

/* ================================
   AVERAGE FILL LEVEL (COLOR LOGIC)
================================ */
function updateAverageFillLevel(fill) {
  const value = document.getElementById("avgFillValue");
  const bar = document.getElementById("avgFillProgress");

  const safeFill = Math.max(0, Math.min(100, Math.round(fill)));

  if (value) value.textContent = `${safeFill}%`;

  if (bar) {
    bar.style.width = `${safeFill}%`;

    let mainColor = "#22c55e"; // green (0–39)
    if (safeFill >= 40 && safeFill <= 69) mainColor = "#facc15"; // yellow
    if (safeFill >= 70) mainColor = "#ef4444"; // red

    bar.style.backgroundColor = mainColor;
  }
}

/* ================================
   BINS REQUIRING EMPTYING
   (COUNT WITH INDICATOR)
================================ */
function updateBinsRequiringEmptying(count = 0, total = 0) {
  const value = document.getElementById("binsEmptyingValue");
  const indicator = document.getElementById("binsEmptyingIndicator");

  const safeTotal = Math.max(0, Number(total));
  const safeCount = Math.max(0, Math.min(Number(count), safeTotal));

  if (value) {
    value.textContent = safeCount;
  }

  if (indicator) {
    // Gray if 0, red if > 0
    indicator.style.backgroundColor = safeCount === 0 ? "#9ca3af" : "#ef4444";
  }

  console.log(
    `📊 ${safeCount}/${safeTotal} bins requiring emptying`
  );
}



/* ================================
   MAINTENANCE SCHEDULE
================================ */
window.updateMaintenanceSchedule = function (bins = []) {
  const items = [];

  bins.forEach(bin => {
    const name = bin.name || bin.id || "Unknown Bin";
    const wc = bin.waste_composition || {};

    const recyclable = Number(wc.recyclable) || 0;
    const biodegradable = Number(wc.biodegradable) || 0;
    const nonBio = Number(wc.non_biodegradable || wc.nonBio) || 0;
    const general = Number(bin.general_waste) || 0;

    const streams = [
      { type: "Recyclable", value: recyclable },
      { type: "Biodegradable", value: biodegradable },
      { type: "Non-Biodegradable", value: nonBio },
      { type: "General", value: general }
    ];

    const avgFill = Math.round(
      (recyclable + biodegradable + nonBio + general) / 4
    );

    // 🔴 Rule: Bin requires emptying
    if (avgFill >= 80) {
      items.push(task(
        name,
        "Emptying",
        1,
        "Today, ASAP",
        "red"
      ));
      return;
    }

    // 🟣 Rule: Stream-specific cleaning
    streams.forEach(s => {
      if (s.value >= 80) {
        items.push(task(
          name,
          `Cleaning - ${s.type}`,
          2,
          future(1),
          "purple"
        ));
      }
    });
  });

  renderMaintenanceSchedule(items.slice(0, 4));
};

/* ================================
   TASK BUILDER
================================ */
function task(binName, taskName, priority, time, color) {
  return { binName, task: taskName, priority, time, color };
}

/* ================================
   HELPERS
================================ */
function future(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.toLocaleDateString()} 10:00 AM`;
}

/* ================================
   RENDER MAINTENANCE SCHEDULE
================================ */
function renderMaintenanceSchedule(data = []) {
  const list = document.querySelector(".maintenance-list");
  if (!list) return;

  list.innerHTML = "";

  if (!data.length) {
    list.innerHTML = `
      <span class="text-muted" style="display:block; font-size:0.85rem;">
        No scheduled maintenance
      </span>`;
    return;
  }

  data.forEach(item => {
    const colorClass = `m-dot d-${item.color}`;

    list.innerHTML += `
      <div class="maintenance-item">
        <span class="maintenance-dot ${colorClass}"></span>
        <div class="maintenance-info">
          <strong>${item.binName} - ${item.task}</strong>
          <span>${item.time}</span>
        </div>
      </div>
    `;
  });
}
