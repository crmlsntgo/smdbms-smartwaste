/* ================================
   HAZARDOUS ALERT OVERVIEW
================================ */

/* ================================
   UPDATE HAZARDOUS ALERT STATUS
================================ */
export function updateHazardousAlert(hasHazardous = false, count = 0) {
  const statusBox = document.getElementById("hazardousStatusBox");
  const statusIcon = document.getElementById("hazardousStatusIcon");
  const statusText = document.getElementById("hazardousStatusText");
  const statusMessage = document.getElementById("hazardousStatusMessage");
  if (!statusBox) return;

  if (hasHazardous) {
    statusBox.classList.add("status-alert");
    statusBox.classList.remove("status-all-clear");

    if (statusIcon) {
      statusIcon.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
             width="20" height="20">
          <path d="M12 9v2m0 4h.01M5.062 20h13.876c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.33 17c-.77 1.333.192 3 1.732 3z"/>
        </svg>`;
    }

    if (statusText) statusText.textContent = "Hazardous Alert";
    if (statusMessage) {
      statusMessage.textContent =
        `${count} hazardous detection${count !== 1 ? "s" : ""}`;
    }
  } else {
    statusBox.classList.remove("status-alert");
    statusBox.classList.add("status-all-clear");

    if (statusIcon) {
      statusIcon.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="#059669"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
             width="20" height="20">
          <path d="M9 12l2 2 4-4"/>
          <circle cx="12" cy="12" r="9"/>
        </svg>`;
    }

    if (statusText) statusText.textContent = "All Clear";
    if (statusMessage) statusMessage.textContent = "No hazardous detections";
  }
}

/* ================================
   UPDATE RECENT DETECTIONS LIST
================================ */
export function updateRecentDetections(detections = []) {
  const container = document.getElementById("recentDetectionsList");
  if (!container) {
    console.warn("⚠️ recentDetectionsList element not found");
    return;
  }

  if (!detections.length) {
    container.innerHTML = `<div class="no-detections">No recent detections</div>`;
    return;
  }

  const sorted = [...detections]
    .sort((a, b) => getTime(b.detected_at) - getTime(a.detected_at))
    .slice(0, 5);

  container.innerHTML = sorted.map(d => {
    const binName = d.bin_name || d.bin_id || d.bin || "Unknown Bin";
    const type = d.type || "Unknown";
    
    let label;
    let labelStyle = "";

    if (d.gas_detected) {
      label = `${binName} - ${type} - Gas`;
      labelStyle = 'style="color: #dc2626;"';
    } else {
      label = `${binName} - ${type} - Unknown waste`;
      labelStyle = 'style="color: #4CAF50;"';

    }

    return `
      <div class="detection-item">
        <div class="detection-info">
          <div class="detection-bin-type" ${labelStyle}>${label}</div>
          <div class="detection-time">${formatDetectionTime(d.detected_at)}</div>
        </div>
      </div>`;
  }).join("");

  console.log("✅ Updated recent detections:", sorted.length);
}

/* ================================
   PROCESS HAZARDOUS DATA
================================ */
export function processHazardousData(input) {
  console.log("🚨 processHazardousData called with:", input);

  let detections = [];
  let hazardousCount = 0;

  // Check if input is already an array of detections from hazardous_detection collection
  if (Array.isArray(input) && input.length > 0 && input[0].detected_at) {
    // Direct detections array from hazardous_detection collection
    detections = input.filter(d => d.hazardous_detected !== false);
    hazardousCount = detections.length;
    
    console.log("📋 Processing detections array:", {
      total: input.length,
      hazardous: hazardousCount
    });
  } else {
    // Legacy format: bins array with hazardous flags
    const bins = Array.isArray(input) ? input : [input];

    bins.forEach(bin => {
      const isHazardous = bin.hazardous_detected === true;

      if (isHazardous) hazardousCount++;

      // Event-based detections
      if (Array.isArray(bin.recent_detections)) {
        bin.recent_detections.forEach(d => {
          detections.push({
            ...d,
            hazardous_detected: true,
            bin_id: bin.id || bin.bin_id || bin.serial,
            detected_at: d.detected_at || bin.updated_at
          });
        });
      }
      // Fallback: hazardous snapshot with no history
      else if (isHazardous) {
        detections.push({
          bin_id: bin.id || bin.bin_id || bin.serial,
          type: bin.type || "Hazardous",
          gas_detected: bin.gas_detected || false,
          hazardous_detected: true,
          detected_at: bin.updated_at || new Date()
        });
      }
    });
  }

  updateHazardousAlert(hazardousCount > 0, detections.length);
  // updateRecentDetections(detections); // Removed to prevent overwriting real data from the listeners

  return detections;
}

/* ================================
   HELPERS
================================ */
function getTime(ts) {
  if (!ts) return 0;
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  if (typeof ts === 'string') return new Date(ts).getTime();
  return new Date(ts).getTime();
}

function formatDetectionTime(ts) {
  const time = getTime(ts);
  if (!time) return "Just now";

  const date = new Date(time);
  const now = new Date();
  const diff = now - time;

  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString();
}