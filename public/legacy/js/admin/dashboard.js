import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

let app, auth, db;
let authUnsubscribe = null;

/* ================================
   CHART MODULE REFERENCES (loaded dynamically)
================================ */
let renderSingleBinFillChart = null;
let renderFillTrendChart = null;
let updateWasteComposition = null;
let renderWasteOverviewChart = null;
let processHazardousData = null;
let updateRecentDetections = null;
let updateHazardousAlert = null;
let processMetricsData = null;

// Attempt to load chart modules — dashboard works without them
async function loadChartModules() {
  try {
    const singleBin = await import('./charts/singleBinOverview.chart.js');
    renderSingleBinFillChart = singleBin.renderSingleBinFillChart;
    renderFillTrendChart = singleBin.renderFillTrendChart;
    updateWasteComposition = singleBin.updateWasteComposition;
  } catch (e) { console.warn('Single bin chart module not available:', e.message); }

  try {
    const wasteOverview = await import('./charts/wasteOverview.chart.js');
    renderWasteOverviewChart = wasteOverview.renderWasteOverviewChart;
  } catch (e) { console.warn('Waste overview chart module not available:', e.message); }

  try {
    const hazardous = await import('./charts/hazardousAlertOverview.chart.js');
    processHazardousData = hazardous.processHazardousData;
    updateRecentDetections = hazardous.updateRecentDetections;
    updateHazardousAlert = hazardous.updateHazardousAlert;
  } catch (e) { console.warn('Hazardous alert chart module not available:', e.message); }

  try {
    const metrics = await import('./charts/metricsOverview.chart.js');
    processMetricsData = metrics.processMetricsData;
  } catch (e) { console.warn('Metrics chart module not available:', e.message); }
}

/* ================================
   STATE MANAGEMENT
================================ */
let currentSelectedBinSerial = null;
let globalHazardousState = false;
let globalHazardousCount = 0;
let previousBinCount = 0;
let previousMaintenanceItems = [];
let lastUpdateTimestamp = null;

/* ================================
   INIT
================================ */
async function initAdminDashboard() {
  try {
    const firebaseConfig = await loadEnvConfig();
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // Load chart modules (non-blocking)
    await loadChartModules();

    authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await loadUserProfile(user);
        setupSidebar();
        listenToAllBins();
        listenToRecentHazardousDetections();
      }
    });
  } catch (error) {
    console.error("Failed to initialize admin dashboard:", error);
    alert("Error loading application. Please try again later.");
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (authUnsubscribe) {
    authUnsubscribe();
  }
});

/* ================================
   USER PROFILE
================================ */
async function loadUserProfile(user) {
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const firstName = userData.firstName || 'Admin';
      
      const userNameElement = document.querySelector(".user-name");
      if (userNameElement) {
        userNameElement.textContent = firstName;
      }
    }
  } catch (error) {
    console.error("Error loading user profile:", error);
  }
}

/* ================================
   SIDEBAR
================================ */
function setupSidebar() {
  const links = document.querySelectorAll('.sidebar-nav .nav-item');
  const path = window.location.pathname.replace(/\\/g, '/');
  const file = path.split('/').pop() || 'dashboard.html';
  const current = file.toLowerCase();

  links.forEach(link => {
    const page = (link.getAttribute('data-page') || '').toLowerCase();
    link.classList.remove('active');
    if (page) {
      if (current.indexOf(page) !== -1 || (page === 'dashboard' && current === '')) {
        link.classList.add('active');
      }
    }
  });
}

/* ================================
   SINGLE BIN VIEW & TOGGLE
================================ */
function setupViewBinsToggle(buttonId) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  const rightOverviewPanel = document.getElementById("rightOverviewPanel");
  const selectBinsPanel = document.getElementById("selectBinsPanel");
  if (!rightOverviewPanel || !selectBinsPanel) return;

  btn.addEventListener("click", () => {
    const isBinsPanelHidden = selectBinsPanel.classList.contains("hidden");

    if (isBinsPanelHidden) {
      rightOverviewPanel.classList.add("hidden");
      rightOverviewPanel.classList.remove("fade-in");
      selectBinsPanel.classList.remove("hidden");
      selectBinsPanel.classList.remove("slide-out-left");
      selectBinsPanel.classList.add("slide-in-right");
      btn.innerHTML = 'Minimize <i class="fas fa-chevron-left"></i>';
    } else {
      selectBinsPanel.classList.remove("slide-in-right");
      selectBinsPanel.classList.add("slide-out-left");
      setTimeout(() => {
        selectBinsPanel.classList.add("hidden");
        selectBinsPanel.classList.remove("slide-out-left");
        rightOverviewPanel.classList.remove("hidden");
        rightOverviewPanel.classList.add("fade-in");
      }, 350);
      btn.innerHTML = 'View Bins <i class="fas fa-chevron-right"></i>';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupViewBinsToggle("viewBinsBtn");
});

/* ================================
   BINS GRID
================================ */
function renderBinsGrid(activeBins) {
  const binsList = document.getElementById("binsList");
  if (!binsList) return;

  if (activeBins.length === 0) {
    binsList.innerHTML = '<p class="loading-text">No active bins available</p>';
    return;
  }

  binsList.innerHTML = activeBins.map(bin => {
    const wc = bin.waste_composition || {};
    const vRec = Number(wc.recyclable) || 0;
    const vBio = Number(wc.biodegradable) || 0;
    const vNon = Number(wc.non_biodegradable || wc.nonBio) || 0;
    const vGen = Number(bin.general_waste) || 0;
    const fillLevel = Math.round((vRec + vBio + vNon + vGen) / 4);

    const fillClass = fillLevel >= 90 ? "danger" : fillLevel >= 75 ? "warning" : "";
    const isActive = currentSelectedBinSerial === bin.serial;

    const s = (bin.status || "").toLowerCase();
    const isAvailable = s === "available" || s === "active";
    const displayStatus = isAvailable ? "Available" : "Unavailable";
    const statusClass = isAvailable ? "" : "offline";

    return `
      <div class="bin-card ${isActive ? "active" : ""}" data-bin-serial="${bin.serial}">
        <div class="bin-card-header">
          <div>
            <div class="bin-card-title">${bin.name || `Bin ${(bin.serial || '').replace("BIN", "")}`}</div>
            <div class="bin-card-location">${bin.location || "No location"}</div>
          </div>
          <div class="bin-status-indicator ${statusClass}">
            <div class="bin-status-dot"></div>
            <span>${displayStatus}</span>
          </div>
        </div>
        <div class="bin-card-stats">
          <div class="bin-card-stat">
            <span class="bin-card-stat-label">Fill Level</span>
            <span class="bin-card-stat-value">${fillLevel}%</span>
          </div>
          <div class="fill-level-mini">
            <div class="fill-level-mini-bar ${fillClass}" style="width: ${fillLevel}%"></div>
          </div>
          <div class="bin-card-stat">
            <span class="bin-card-stat-label">Battery</span>
            <span class="bin-card-stat-value">${bin.battery || 0}%</span>
          </div>
          <div class="bin-card-stat">
            <span class="bin-card-stat-label">Connectivity</span>
            <span class="bin-card-stat-value">${bin.connectivity || "Unknown"}</span>
          </div>
        </div>
        <div class="bin-card-footer">
          <span>${new Date(bin.last_emptied?.seconds * 1000 || Date.now()).toLocaleDateString()}</span>
          <span>Last emptied</span>
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll(".bin-card").forEach(card => {
    card.addEventListener("click", () => {
      const binSerial = card.dataset.binSerial;
      currentSelectedBinSerial = binSerial;
      document.querySelectorAll(".bin-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      listenToSingleBin(binSerial);
    });
  });
}

/* ================================
   SINGLE BIN LISTENER
================================ */
function listenToSingleBin(binSerial) {
  const ref = doc(db, "bins", binSerial);

  onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    updateSingleBinUI(snap.data(), binSerial);
  });
}

function updateSingleBinUI(data, binId) {
  const title = document.getElementById("binTitle");
  if (title) {
    const binName = data.name || `Bin${(binId || '').replace("BIN", "")}`;
    title.innerHTML = `${binName} <span style="color: #d1d5db; font-weight: 500;">(${binId})</span>`;
  }

  const locationEl = document.getElementById("binLocation");
  if (locationEl) locationEl.textContent = data.location || "Main Building Bin";

  // Compute aggregated fill level from waste types
  const wc = data.waste_composition || {};
  const vRec = Number(wc.recyclable) || 0;
  const vBio = Number(wc.biodegradable) || 0;
  const vNon = Number(wc.non_biodegradable || wc.nonBio) || 0;
  const vGen = Number(data.general_waste) || 0;
  const computedFill = Math.round((vRec + vBio + vNon + vGen) / 4);

  if (renderSingleBinFillChart) {
    renderSingleBinFillChart("singleBinFillChart", computedFill);
  }

  const batteryBar = document.getElementById("batteryProgress");
  if (batteryBar) {
    const batt = data.battery ?? 0;
    batteryBar.style.width = `${batt}%`;
    const battPercent = document.getElementById("batteryPercent");
    if (battPercent) battPercent.textContent = `${batt}%`;
  }

  const connText = document.getElementById("binConnectivity");
  const connIcon = document.getElementById("connectivityIcon");
  if (connText) {
    const status = data.connectivity || "Unknown";
    connText.textContent = status;
    if (connIcon) {
      connIcon.style.color =
        status.includes("Strong") ? "#10b981" :
        status.includes("Medium") ? "#f59e0b" :
        "#ef4444";
    }
  }

  if (updateWasteComposition) {
    updateWasteComposition("wasteCompositionChart", {
      ...(data.waste_composition || {}),
      general_waste: data.general_waste,
      non_biodegradable: data.waste_composition?.non_biodegradable || data.waste_composition?.nonBio
    });
  }

  if (renderFillTrendChart) {
    renderFillTrendChart("fillTrendChart", generateTrendData(computedFill));
  }
}

function generateTrendData(current) {
  const now = new Date();
  return Array.from({ length: 6 }).map((_, i) => ({
    label: `${(now.getHours() - (5 - i) + 24) % 24}:00`,
    value: Math.max(0, Math.min(100, current - i * 4))
  }));
}

/* ================================
   ALL BINS + SYSTEM OVERVIEW
================================ */
function listenToAllBins() {
  onSnapshot(collection(db, "bins"), (snap) => {
    const allBins = [];

    let bio = 0;
    let rec = 0;
    let non = 0;
    let generalWasteTotal = 0;
    let generalWasteCount = 0;

    snap.forEach(d => {
      const data = { id: d.id, ...d.data() };
      allBins.push(data);

      const w = d.data().waste_composition;
      if (w) {
        bio += Number(w.biodegradable || 0);
        rec += Number(w.recyclable || 0);
        non += Number(w.non_biodegradable || 0);
      }

      const generalWasteValue = Number(d.data().general_waste || 0);
      generalWasteTotal += generalWasteValue;
      generalWasteCount++;
    });

    /* METRICS OVERVIEW */
    if (processMetricsData) {
      processMetricsData(allBins);
    }

    /* WASTE OVERVIEW (PERCENTAGE) */
    const totalWaste = bio + rec + non;
    let generalWastePercentage = 0;
    if (generalWasteCount > 0) {
      generalWastePercentage = Math.round(generalWasteTotal / generalWasteCount);
    }

    const wastePercentages =
      totalWaste > 0
        ? {
            biodegradable: Math.round((bio / totalWaste) * 100),
            recyclable: Math.round((rec / totalWaste) * 100),
            non_biodegradable: Math.round((non / totalWaste) * 100),
            general_waste: generalWastePercentage
          }
        : {
            biodegradable: 0,
            recyclable: 0,
            non_biodegradable: 0,
            general_waste: generalWastePercentage
          };

    if (renderWasteOverviewChart) {
      renderWasteOverviewChart(wastePercentages);
    }

    /* HAZARDOUS OVERVIEW */
    const hazardousBins = allBins.filter(b => b.hazardous_detected === true);
    globalHazardousState = hazardousBins.length > 0;

    if (updateHazardousAlert) {
      updateHazardousAlert(globalHazardousState, globalHazardousCount);
    }

    /* SYSTEM OVERVIEW — filter out archived/deleted */
    const activeBins = allBins.filter(b => {
      const s = (b.status || "").toLowerCase();
      return !["archived", "deleted", "restored"].includes(s);
    });

    renderBinsGrid(activeBins);

    // Aggregated stats
    const avgFill =
      activeBins.length
        ? Math.round(
            activeBins.reduce((s, b) => {
              const wc = b.waste_composition || {};
              const val = ((Number(wc.recyclable) || 0) + (Number(wc.biodegradable) || 0) + (Number(wc.non_biodegradable || wc.nonBio) || 0) + (Number(b.general_waste) || 0)) / 4;
              return s + val;
            }, 0) / activeBins.length
          )
        : 0;

    const needEmptying = activeBins.filter(b => {
      const wc = b.waste_composition || {};
      const val = ((Number(wc.recyclable) || 0) + (Number(wc.biodegradable) || 0) + (Number(wc.non_biodegradable || wc.nonBio) || 0) + (Number(b.general_waste) || 0)) / 4;
      return val >= 80;
    }).length;

    // Track maintenance items for change detection
    let maintenanceItems = [];
    activeBins.forEach(bin => {
      const wc = bin.waste_composition || {};
      const recyclable = Number(wc.recyclable) || 0;
      const biodegradable = Number(wc.biodegradable) || 0;
      const nonBio = Number(wc.non_biodegradable || wc.nonBio) || 0;
      const general = Number(bin.general_waste) || 0;
      const binAvgFill = Math.round((recyclable + biodegradable + nonBio + general) / 4);

      if (binAvgFill >= 80) {
        maintenanceItems.push({ bin: bin.serial || bin.id, type: "emptying", fill: binAvgFill });
      } else {
        const streams = [
          { type: "recyclable", value: recyclable },
          { type: "biodegradable", value: biodegradable },
          { type: "non_biodegradable", value: nonBio },
          { type: "general", value: general }
        ];
        streams.forEach(s => {
          if (s.value >= 80) {
            maintenanceItems.push({ bin: bin.serial || bin.id, type: `cleaning-${s.type}`, fill: s.value });
          }
        });
      }
    });

    // Detect maintenance changes
    let maintenanceChanged = false;
    if (maintenanceItems.length !== previousMaintenanceItems.length) {
      maintenanceChanged = true;
    } else {
      for (let i = 0; i < maintenanceItems.length; i++) {
        const current = maintenanceItems[i];
        const previous = previousMaintenanceItems.find(p => p.bin === current.bin);
        if (!previous || previous.type !== current.type) {
          maintenanceChanged = true;
          break;
        }
      }
    }
    previousMaintenanceItems = JSON.parse(JSON.stringify(maintenanceItems));

    const binAdded = activeBins.length > previousBinCount;
    previousBinCount = activeBins.length;

    if (binAdded || maintenanceChanged) {
      lastUpdateTimestamp = Date.now();
    }

    // Determine most recent update time
    let mostRecentUpdateTime = lastUpdateTimestamp;
    if (!mostRecentUpdateTime && allBins.length > 0) {
      const timestamps = allBins
        .map(b => {
          const lastEmptied = b.last_emptied?.seconds ? b.last_emptied.seconds * 1000 : null;
          const lastUpdated = b.last_updated?.seconds ? b.last_updated.seconds * 1000 : null;
          const lastReported = b.last_reported?.seconds ? b.last_reported.seconds * 1000 : null;
          const createdAt = b.created_at?.seconds ? b.created_at.seconds * 1000 : null;
          return lastUpdated || lastReported || lastEmptied || createdAt || 0;
        })
        .filter(t => t > 0);

      if (timestamps.length > 0) {
        mostRecentUpdateTime = Math.max(...timestamps);
      }
    }

    if (window.updateSystemOverview) {
      window.updateSystemOverview({
        activeBins: activeBins.length,
        totalBins: allBins.length,
        averageFill: avgFill,
        binsNeedingEmptying: needEmptying,
        updatedAt: mostRecentUpdateTime
      });
    }

    if (window.updateMaintenanceSchedule) {
      window.updateMaintenanceSchedule(activeBins);
    }

    /* AUTO SELECT FIRST BIN */
    const firstActive = activeBins[0];
    if (firstActive?.serial && !currentSelectedBinSerial) {
      currentSelectedBinSerial = firstActive.serial;
      listenToSingleBin(firstActive.serial);
    }
  });
}

/* ================================
   HAZARDOUS DETECTIONS LISTENER
================================ */
function listenToRecentHazardousDetections() {
  const q = query(
    collection(db, "hazardous_detections"),
    orderBy("detected_at", "desc"),
    limit(10)
  );

  onSnapshot(q, (snapshot) => {
    const detections = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      detections.push({
        ...data,
        id: docSnap.id,
        bin_id: data.bin_id || "Unknown Bin",
        detected_at: data.detected_at
      });
    });

    if (updateRecentDetections) {
      updateRecentDetections(detections);
    }

    globalHazardousCount = detections.length;
    if (updateHazardousAlert) {
      updateHazardousAlert(globalHazardousState, globalHazardousCount);
    }
  }, (error) => {
    console.error("Error fetching hazardous detections:", error);
    const container = document.getElementById("recentDetectionsList");
    if (container) {
      container.innerHTML = `<div class="detection-item" style="color: red; padding: 10px;">Error loading detections. Check console.</div>`;
    }
  });
}

initAdminDashboard();
