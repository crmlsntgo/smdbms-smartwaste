/* ================================
   METRICS OVERVIEW
   Manages Total Bins, Bins Rate, and Average Fill Level cards
================================ */

/* ================================
   UPDATE TOTAL BINS
================================ */
export function updateTotalBins(count = 0, change = 0) {
  const valueEl = document.getElementById("totalBinsValue");
  const changeEl = document.getElementById("totalBinsChange");

  if (valueEl) valueEl.textContent = count;

  if (changeEl) {
    if (change > 0) {
      changeEl.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 17l5-5m0 0l5 5m-5-5V7"/>
        </svg>
        <span style="color: #10b981;">+${change} from last month</span>
      `;
    } else if (change < 0) {
      changeEl.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M7 7l5 5m0 0l5-5m-5 5v10"/>
        </svg>
        <span style="color: #ef4444;">${change} from last month</span>
      `;
    } else {
      changeEl.innerHTML = `
        <span style="color: #9ca3af;">No change</span>
      `;
    }
  }
}

/* ================================
   UPDATE BINS RATE
================================ */
export function updateBinsRate(rate = 0) {
  const valueEl = document.getElementById("binsRateValue");

  if (valueEl) valueEl.textContent = `${rate}%`;
}

/* ================================
   UPDATE AVERAGE FILL LEVEL
================================ */
export function updateAverageFillLevel(avg = 0) {
  const valueEl = document.getElementById("avgFillLevelValue");

  if (valueEl) valueEl.textContent = `${avg}%`;
}

/* ================================
   PROCESS ALL BINS FOR METRICS
================================ */
export function processMetricsData(allBinsData = [], previousCount = null) {
  const totalBins = allBinsData.length;

  // Calculate average fill level
  let totalFill = 0;
  let validBins = 0;
  let activeBinsCount = 0; // for bins rate > 50%

  allBinsData.forEach(bin => {
    // Aggregated Fill Calculation
    const wc = bin.waste_composition || {};
    const val = (
      (Number(wc.recyclable) || 0) + 
      (Number(wc.biodegradable) || 0) + 
      (Number(wc.non_biodegradable) || Number(wc.nonBio) || 0) + 
      (Number(bin.general_waste) || 0)
    ) / 4;

    totalFill += val;
    validBins++;

    if (val > 50) {
      activeBinsCount++;
    }
  });

  const avgFill = validBins > 0 ? Math.round(totalFill / validBins) : 0;
  const binsRate = totalBins > 0 ? Math.round((activeBinsCount / totalBins) * 100) : 0;

  // Calculate change from previous count
  const change = previousCount !== null ? totalBins - previousCount : 0;

  // Update all three cards
  updateTotalBins(totalBins, change);
  updateBinsRate(binsRate);
  updateAverageFillLevel(avgFill);

  return { totalBins, binsRate, avgFill, change };
}