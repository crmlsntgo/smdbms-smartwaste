import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

import {
  renderSingleBinFillChart,
  renderFillTrendChart,
  updateWasteComposition
} from "./charts/singleBinOverview.chart.js";

import { renderWasteOverviewChart } from "./charts/wasteOverview.chart.js";

import {
  processHazardousData,
  updateRecentDetections,
  updateHazardousAlert // Added import
} from "./charts/hazardousAlertOverview.chart.js";

import {
  processMetricsData
} from "./charts/metricsOverview.chart.js";


/* ================================
   FIREBASE INIT
================================ */
const firebaseConfig = {
  apiKey: "AIzaSyDvbE-uPNh1BIi-NIriLtdF2vlbDCpa2yQ",
  authDomain: "smart-dustbin-d35ee.firebaseapp.com",
  projectId: "smart-dustbin-d35ee",
  storageBucket: "smart-dustbin-d35ee.firebasestorage.app",
  messagingSenderId: "263444985366",
  appId: "1:263444985366:web:3bac9c1b4dbcbbdec92737"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

/* ================================
   INIT
================================ */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "auth/login.html";
    return;
  }

  await loadUserProfile(user);
  setupSidebar();
  listenToAllBins();
  listenToRecentHazardousDetections();
});

/* ================================
   USER PROFILE
================================ */
async function loadUserProfile(user) {
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const el = document.querySelector(".user-name");
      if (el) el.textContent = `, ${snap.data().firstName || ""}`;
    }
  } catch (e) {
    console.error("Profile load error:", e);
  }
}

/* ================================
   SIDEBAR
================================ */
function setupSidebar() {
  const current = location.pathname.toLowerCase();
  document.querySelectorAll(".nav-item").forEach(link => {
    const page = link.dataset.page?.toLowerCase() || "";
    link.classList.toggle("active", current.includes(page));
  });
}

/* ================================
   SINGLE BIN & MODAL SETUP
================================ */
let currentSelectedBinSerial = null;

function setupViewBinsToggle(buttonId) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  const rightOverviewPanel = document.getElementById("rightOverviewPanel");
  const selectBinsPanel = document.getElementById("selectBinsPanel");

  if (!rightOverviewPanel || !selectBinsPanel) return;

  btn.addEventListener("click", () => {
    const isBinsPanelHidden = selectBinsPanel.classList.contains("hidden");

    if (isBinsPanelHidden) {
      // VIEW BINS ACTION (Show Bins, Hide Overview)
      
      // 1. Hide Overview
      rightOverviewPanel.classList.add("hidden");
      rightOverviewPanel.classList.remove("fade-in");

      // 2. Show Bins with Animation
      selectBinsPanel.classList.remove("hidden");
      selectBinsPanel.classList.remove("slide-out-left");
      selectBinsPanel.classList.add("slide-in-right");

      // 3. Update Button
      btn.innerHTML = 'Minimize <i class="fas fa-chevron-left"></i>';

    } else {
      // MINIMIZE ACTION (Hide Bins, Show Overview)

      // 1. Animate Bins Out
      selectBinsPanel.classList.remove("slide-in-right");
      selectBinsPanel.classList.add("slide-out-left");

      // 2. Wait for animation, then hide Bins and Show Overview
      setTimeout(() => {
        selectBinsPanel.classList.add("hidden");
        selectBinsPanel.classList.remove("slide-out-left");

        rightOverviewPanel.classList.remove("hidden");
        rightOverviewPanel.classList.add("fade-in");
      }, 350); 

      // 3. Update Button
      btn.innerHTML = 'View Bins <i class="fas fa-chevron-right"></i>';
    }
  });
}

function setupBinsModal() {
}

document.addEventListener('DOMContentLoaded', () => {
  setupViewBinsToggle("viewBinsBtn");
  setupBinsModal();
});

function renderBinsGrid(activeBins) {
  const binsList = document.getElementById("binsList");
  if (!binsList) return;

  if (activeBins.length === 0) {
    binsList.innerHTML = '<p class="loading-text">No active bins available</p>';
    return;
  }

  binsList.innerHTML = activeBins.map(bin => {
    // Compute aggregated fill level
    const wc = bin.waste_composition || {};
    const vRec = Number(wc.recyclable) || 0;
    const vBio = Number(wc.biodegradable) || 0;
    const vNon = Number(wc.non_biodegradable || wc.nonBio) || 0;
    const vGen = Number(bin.general_waste) || 0;
    const fillLevel = Math.round((vRec + vBio + vNon + vGen) / 4);

    const fillClass = fillLevel >= 90 ? "danger" : fillLevel >= 75 ? "warning" : "";
    const isActive = currentSelectedBinSerial === bin.serial;

    // Normalize status: "active"/"Available" -> "Available", else "Unavailable"
    const s = (bin.status || "").toLowerCase();
    const isAvailable = s === "available" || s === "active";
    const displayStatus = isAvailable ? "Available" : "Unavailable";
    const statusClass = isAvailable ? "" : "offline";

    return `
      <div class="bin-card ${isActive ? "active" : ""}" data-bin-serial="${bin.serial}">
        <div class="bin-card-header">
          <div>
            <div class="bin-card-title">${bin.name || `Bin ${bin.serial.replace("BIN", "")}`}</div>
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
    const binName = data.name || `Bin${binId.replace("BIN", "")}`;
    title.innerHTML = `${binName} <span style="color: #d1d5db; font-weight: 500;">(${binId})</span>`;
  }

  const location = document.getElementById("binLocation");
  if (location) location.textContent = data.location || "Main Building Bin";

  // Compute aggregated fill level from 4 waste types (Average)
  const wc = data.waste_composition || {};
  const vRec = Number(wc.recyclable) || 0;
  const vBio = Number(wc.biodegradable) || 0;
  const vNon = Number(wc.non_biodegradable || wc.nonBio) || 0;
  const vGen = Number(data.general_waste) || 0;

  const computedFill = Math.round((vRec + vBio + vNon + vGen) / 4);

  renderSingleBinFillChart(
    "singleBinFillChart",
    computedFill
  );

  const batteryBar = document.getElementById("batteryProgress");
  if (batteryBar) {
    const batt = data.battery ?? 0;
    batteryBar.style.width = `${batt}%`;
    document.getElementById("batteryPercent").textContent = `${batt}%`;
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

  updateWasteComposition("wasteCompositionChart", {
    ...(data.waste_composition || {}),
    general_waste: data.general_waste,   // Pull form root if exists
    non_biodegradable: data.waste_composition?.non_biodegradable || data.waste_composition?.nonBio // Handle potential key mismatch
  });
  renderFillTrendChart("fillTrendChart", generateTrendData(computedFill));
}

function generateTrendData(current) {
  const now = new Date();
  return Array.from({ length: 6 }).map((_, i) => ({
    label: `${(now.getHours() - (5 - i) + 24) % 24}:00`,
    value: Math.max(0, Math.min(100, current - i * 4))
  }));
}

/* ================================
   STATE MANAGEMENT
================================ */
let globalHazardousState = false;
let globalHazardousCount = 0;
let previousBinCount = 0;
let previousMaintenanceItems = [];
let lastUpdateTimestamp = null;

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

      // Get general_waste value (should be 0-100 percentage)
      const generalWasteValue = Number(d.data().general_waste || 0);
      generalWasteTotal += generalWasteValue;
      generalWasteCount++;
    });

    /* ===============================
       METRICS OVERVIEW
    ================================ */
    processMetricsData(allBins);

    /* ===============================
       WASTE OVERVIEW (PERCENTAGE)
    ================================ */
    const totalWaste = bio + rec + non;

    // Calculate average general waste percentage
    let generalWastePercentage = 0;
    if (generalWasteCount > 0) {
      generalWastePercentage = Math.round(generalWasteTotal / generalWasteCount);
    }

    console.log("🗑️ General Waste Calculation:", {
      generalWasteTotal,
      generalWasteCount,
      generalWastePercentage
    });

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

    console.log("📊 Waste Percentages being sent:", wastePercentages);

    renderWasteOverviewChart(wastePercentages);

    /* ===============================
       HAZARDOUS OVERVIEW (UPDATED)
    ================================ */
    // Check for any active hazardous bin
    const hazardousBins = allBins.filter(b => b.hazardous_detected === true);
    globalHazardousState = hazardousBins.length > 0;
    
    // Update the UI with current state and count
    updateHazardousAlert(globalHazardousState, globalHazardousCount);

    /* ===============================
       SYSTEM OVERVIEW
    ================================ */
    // Show all bins that are not archived/deleted
    const activeBins = allBins.filter(b => {
      const s = (b.status || "").toLowerCase();
      return !["archived", "deleted", "restored"].includes(s);
    });

    renderBinsGrid(activeBins);

    // Compute aggregated stats
    const avgFill =
      activeBins.length
        ? Math.round(
            activeBins.reduce((s, b) => {
               const wc = b.waste_composition || {};
               const val = ((Number(wc.recyclable)||0) + (Number(wc.biodegradable)||0) + (Number(wc.non_biodegradable || wc.nonBio)||0) + (Number(b.general_waste)||0))/4;
               return s + val;
            }, 0) / activeBins.length
          )
        : 0;

    const needEmptying = activeBins.filter(b => {
        const wc = b.waste_composition || {};
        const val = ((Number(wc.recyclable)||0) + (Number(wc.biodegradable)||0) + (Number(wc.non_biodegradable || wc.nonBio)||0) + (Number(b.general_waste)||0))/4;
        return val >= 80;
    }).length;

    // Track maintenance items to detect when a bin is flagged for cleaning/emptying
    let maintenanceItems = [];
    activeBins.forEach(bin => {
      const wc = bin.waste_composition || {};
      const recyclable = Number(wc.recyclable) || 0;
      const biodegradable = Number(wc.biodegradable) || 0;
      const nonBio = Number(wc.non_biodegradable || wc.nonBio) || 0;
      const general = Number(bin.general_waste) || 0;
      const avgFill = Math.round((recyclable + biodegradable + nonBio + general) / 4);

      if (avgFill >= 80) {
        maintenanceItems.push({ bin: bin.serial || bin.id, type: "emptying", fill: avgFill });
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

    // Check if maintenance items changed (new bin flagged or existing bin status changed)
    let maintenanceChanged = false;
    
    // Check if length changed
    if (maintenanceItems.length !== previousMaintenanceItems.length) {
      maintenanceChanged = true;
    } else {
      // Check if any item is different (comparing bins and types)
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

    // Check if a new bin was added
    const binAdded = activeBins.length > previousBinCount;
    previousBinCount = activeBins.length;

    // Update timestamp if bins added or maintenance status changed
    if (binAdded || maintenanceChanged) {
      lastUpdateTimestamp = Date.now();
      console.log("🔄 Updated 'Last Updated' - Bins: " + activeBins.length + ", Maintenance Items: " + maintenanceItems.length);
    }

    // Use the tracked timestamp, or fall back to most recent bin update time
    let mostRecentUpdateTime = lastUpdateTimestamp;
    
    if (!mostRecentUpdateTime && allBins.length > 0) {
      const timestamps = allBins
        .map(b => {
          // Check for various timestamp fields that indicate bin updates
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

    window.updateSystemOverview({
      activeBins: activeBins.length,
      totalBins: allBins.length,
      averageFill: avgFill,
      binsNeedingEmptying: needEmptying,
      updatedAt: mostRecentUpdateTime
    });

    if (window.updateMaintenanceSchedule) {
      window.updateMaintenanceSchedule(activeBins);
    } else {
      console.warn("⚠️ updateMaintenanceSchedule not found on window");
    }

    /* ===============================
       AUTO SELECT FIRST BIN
    ================================ */
    const firstActive = activeBins[0];
    if (firstActive?.serial) {
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
    snapshot.forEach((doc) => {
      const data = doc.data();
      detections.push({
        ...data,
        id: doc.id,
        // Ensure properties match what updateRecentDetections expects
        bin_id: data.bin_id || "Unknown Bin",
        detected_at: data.detected_at 
      });
    });
    updateRecentDetections(detections);
    
    // Update global count based on fetched detections
    globalHazardousCount = detections.length;
    updateHazardousAlert(globalHazardousState, globalHazardousCount);

  }, (error) => {
    console.error("🔥 Error fetching hazardous detections:", error);
    const container = document.getElementById("recentDetectionsList");
    if (container) {
      container.innerHTML = `<div class="detection-item" style="color: red; padding: 10px;">Error loading detections. Check console.</div>`;
    }
  });
}