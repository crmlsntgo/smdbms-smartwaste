// Module-based Customize page with Firestore-backed bins and transactional serial reservation
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  limit,
  startAfter,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";

// No hardcoded sample bins — UI loads bins only from Firestore

let db = null;
let bins = [];
let currentBinId = null; // UI index (null when no bin selected)
let auth = null;
let authUnsubscribe = null;
let binsLastDoc = null;
let binsHasMore = true;

// DOM refs (queried during init)
let binListContainer, binSearchInput, binNameInput, binCapacityInput, binSerialInput, binThresholdInput, binLocationInput, binImageUrlInput, addNewBinBtn, removeBtn, saveBtn, infoToggle, infoDetails;
let removeModalOverlay, removeReasonSelect, modalConfirmBtn, modalCancelBtn;

async function init() {
  // query DOM
  binListContainer = document.querySelector('.bin-items');
  binSearchInput = document.querySelector('.bin-list-search input');
  binNameInput = document.getElementById('bin-name');
  binCapacityInput = document.getElementById('bin-capacity');
  binSerialInput = document.getElementById('bin-serial');
  binThresholdInput = document.getElementById('bin-threshold');
  binLocationInput = document.getElementById('bin-location');
  binImageUrlInput = document.getElementById('bin-image-url');
  addNewBinBtn = document.querySelector('.customize-add-btn');
  removeBtn = document.querySelector('.config-btn--danger');
  saveBtn = document.querySelector('.config-btn--primary');
  infoToggle = document.querySelector('.info-toggle');
  infoDetails = document.querySelector('.info-details');

  removeModalOverlay = document.getElementById('remove-modal-overlay');
  removeReasonSelect = document.getElementById('remove-reason');
  modalConfirmBtn = document.getElementById('modal-confirm-btn');
  modalCancelBtn = document.getElementById('modal-cancel-btn');

  // Input validation for capacity and threshold
  if (binCapacityInput) {
    binCapacityInput.addEventListener('input', (e) => {
      const val = e.target.value;
      // Keep only digits
      if (!/^\d*$/.test(val)) {
        e.target.value = val.replace(/\D/g, '');
      }
    });
    binCapacityInput.addEventListener('blur', (e) => {
      const val = e.target.value.trim();
      if (val !== '') {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num > 0) {
          e.target.value = num;
        } else {
          e.target.value = '';
        }
      }
    });
  }

  if (binThresholdInput) {
    binThresholdInput.addEventListener('input', (e) => {
      const val = e.target.value;
      // Keep only digits
      if (!/^\d*$/.test(val)) {
        e.target.value = val.replace(/\D/g, '');
      }
    });
    binThresholdInput.addEventListener('blur', (e) => {
      const val = e.target.value.trim();
      if (val !== '') {
        let num = parseInt(val, 10);
        if (!isNaN(num)) {
          // Clamp to 1-100
          num = Math.min(100, Math.max(1, num));
          e.target.value = num;
        } else {
          e.target.value = '';
        }
      }
    });
  }

  await initFirestore();
  // If auth is present and user not signed in yet, wait for sign-in before loading bins
  if (auth) {
    if (auth.currentUser) {
      // fetch role first and only load bins if allowed
      const role = await fetchUserRole(auth.currentUser.uid);
      if (role && (String(role).toLowerCase() === 'admin' || String(role).toLowerCase() === 'utility staff' || String(role).toLowerCase() === 'utility_staff')) {
      await loadBinsPage();
        renderBinList();
        selectBin(currentBinId);
      } else if (role) {
        showPermissionMessage('Your account does not have permission to read bins. Contact an administrator.');
      } else {
        // role not present — still attempt load but catch permission errors
        try {
          await loadBinsPage();
          renderBinList();
          selectBin(currentBinId);
        } catch (e) {
          console.warn('customize.js: load deferred until sign-in', e);
          showPermissionMessage('Unable to load bins due to permission restrictions. Please check Firestore rules and your user role.');
        }
      }
    } else {
      authUnsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          const role = await fetchUserRole(user.uid);
            if (role && (String(role).toLowerCase() === 'admin' || String(role).toLowerCase() === 'utility staff' || String(role).toLowerCase() === 'utility_staff')) {
            await loadBinsPage();
            renderBinList();
            selectBin(currentBinId);
          } else if (role) {
            showPermissionMessage('Your account does not have permission to read bins. Contact an administrator.');
          } else {
            try {
              await loadBinsPage();
              renderBinList();
              selectBin(currentBinId);
            } catch (e) {
              console.warn('customize.js: load deferred until sign-in', e);
              showPermissionMessage('Unable to load bins due to permission restrictions. Please check Firestore rules and your user role.');
            }
          }
        } else {
          // not signed in — still attempt load (in case rules allow public read)
          try {
            await loadBinsPage();
            renderBinList();
            selectBin(currentBinId);
          } catch (e) {
            console.warn('customize.js: load deferred until sign-in', e);
            showPermissionMessage('Unable to load bins due to permission restrictions. Please sign in or check Firestore rules.');
          }
        }
      });
    }
  } else {
    await loadBinsFromFirestore();
    renderBinList();
    selectBin(currentBinId);
  }
  attachEventListeners();
}

async function initFirestore() {
  try {
    if (typeof loadEnvConfig !== 'function') throw new Error('loadEnvConfig not found');
    const firebaseConfig = await loadEnvConfig();
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    try { auth = getAuth(app); } catch (e) { console.warn('customize.js: getAuth failed', e); }
    console.debug('customize.js: Firestore initialized', firebaseConfig.projectId);
  } catch (e) {
    console.warn('customize.js: Firestore init failed, using local data only:', e);
    db = null;
  }
}

async function loadBinsFromFirestore() {
  // Deprecated: use paginated `loadBinsPage()` instead to avoid loading entire collection.
  console.warn('loadBinsFromFirestore() is deprecated; use loadBinsPage()');
  await loadBinsPage();
}

// Paginated loader: append a page of bins to `bins`.
async function loadBinsPage() {
  if (!db) {
    bins = [];
    currentBinId = null;
    return;
  }

  try {
    const BINS_PAGE_SIZE = 200;
    const binsCol = collection(db, 'bins');
    let q;
    if (!binsLastDoc) q = query(binsCol, orderBy('createdAt', 'desc'), limit(BINS_PAGE_SIZE));
    else q = query(binsCol, orderBy('createdAt', 'desc'), startAfter(binsLastDoc), limit(BINS_PAGE_SIZE));

    const snaps = await getDocs(q);
    if (snaps.empty) {
      binsHasMore = false;
      if (!bins.length) currentBinId = null;
      return;
    }

    const page = [];
    let idx = bins.length + 1;
    snaps.forEach(d => {
      const data = d.data();
      if (data && data.status && ['archived', 'deleted'].includes(String(data.status).toLowerCase())) return;
      let createdAtMs = null;
      if (data && data.createdAt && typeof data.createdAt.toMillis === 'function') createdAtMs = data.createdAt.toMillis();
      else if (data && data.createdAt && data.createdAt.seconds) createdAtMs = (data.createdAt.seconds || 0) * 1000;
      else if (d.createTime && typeof d.createTime.toMillis === 'function') createdAtMs = d.createTime.toMillis();
      else if (d.createTime) { try { createdAtMs = new Date(d.createTime).getTime(); } catch (e) { createdAtMs = Date.now(); } }
      page.push({
        docId: d.id,
        id: idx,
        name: data.name || 'Unnamed Bin',
        capacity: data.capacity || 0,
        serial: data.serial || `SDB-${String(idx).padStart(3, '0')}`,
        threshold: data.threshold || 80,
        location: data.location || '',
        imageUrl: data.imageUrl || '',
        sensorStatus: data.sensorStatus || 'Connected',
        lastConfigured: data.lastConfigured || 'Unknown',
        status: data.status || 'Available',
        dateCreated: data.dateCreated || new Date().toLocaleDateString(),
        statusDot: data.statusDot || 'green',
        createdAtMs
      });
      idx++;
    });

    bins = bins.concat(page);
    binsLastDoc = snaps.docs[snaps.docs.length - 1];
    binsHasMore = snaps.docs.length === BINS_PAGE_SIZE;
    sortBins();
    reindexBins();
    currentBinId = bins[0]?.id || 1;
  } catch (e) {
    console.warn('Failed to load bins from Firestore (paged):', e);
    bins = [];
    currentBinId = null;
  }
}

function renderBinList(filter = '') {
  if (!binListContainer) return;
  // ensure bins are sorted newest-first before rendering
  sortBins();
  reindexBins();
  binListContainer.innerHTML = '';
  if (!bins || bins.length === 0) {
    // show empty placeholder
    const empty = document.createElement('div');
    empty.className = 'bin-list-empty';
    empty.textContent = 'No bins available. Add a bin to get started.';
    binListContainer.appendChild(empty);
    return;
  }
  const filtered = bins.filter(bin => bin.name.toLowerCase().includes(filter.toLowerCase()));
  filtered.forEach(bin => {
    const binItem = document.createElement('div');
    binItem.className = 'bin-item' + (bin.id === currentBinId ? ' bin-item--active' : '');
    binItem.setAttribute('data-bin-id', bin.id);
    binItem.innerHTML = `
      <div class="bin-item__icon" style="background-image: url('${bin.imageUrl}')"></div>
      <div class="bin-item__name">${bin.name}</div>
      <div class="bin-item__meta">
        <span class="bin-item__dot bin-item__dot--${bin.statusDot}"></span>
        <span>${bin.location}</span>
      </div>
    `;
    binItem.addEventListener('click', () => selectBin(bin.id));
    binListContainer.appendChild(binItem);
  });
}

function selectBin(id) {
  currentBinId = id;
  const bin = bins.find(b => b.id === id);
  if (!bin) {
    clearSelection();
    return;
  }
  if (binNameInput) binNameInput.value = bin.name;
  if (binCapacityInput) binCapacityInput.value = bin.capacity;
  if (binSerialInput) binSerialInput.value = bin.serial || '';
  if (binThresholdInput) binThresholdInput.value = bin.threshold;
  if (binLocationInput) binLocationInput.value = bin.location;
  if (binImageUrlInput) binImageUrlInput.value = bin.imageUrl;
  updateAdditionalInfo(bin);
  updatePreview(bin);
  document.querySelectorAll('.bin-item').forEach(i => i.classList.remove('bin-item--active'));
  document.querySelector(`[data-bin-id="${id}"]`)?.classList.add('bin-item--active');
  if (infoDetails) infoDetails.style.display = 'none';
}

function clearSelection() {
  currentBinId = null;
  if (binNameInput) binNameInput.value = '';
  if (binCapacityInput) binCapacityInput.value = '';
  if (binSerialInput) binSerialInput.value = '';
  if (binThresholdInput) binThresholdInput.value = '';
  if (binLocationInput) binLocationInput.value = '';
  if (binImageUrlInput) binImageUrlInput.value = '';
  if (infoDetails) infoDetails.style.display = 'none';
  // preview
  const nameEl = document.querySelector('.preview-name');
  const locEl = document.querySelector('.preview-location');
  const imgEl = document.querySelector('.preview-image');
  const previewDetails = document.querySelector('.preview-details');
  if (nameEl) nameEl.textContent = 'No bin selected';
  if (locEl) locEl.innerHTML = '';
  if (imgEl) imgEl.style.backgroundImage = '';
  if (previewDetails) previewDetails.innerHTML = '';
  document.querySelectorAll('.bin-item').forEach(i => i.classList.remove('bin-item--active'));
}

function updatePreview(bin) {
  const nameEl = document.querySelector('.preview-name');
  const locEl = document.querySelector('.preview-location');
  const imgEl = document.querySelector('.preview-image');
  if (nameEl) nameEl.textContent = bin.name;
  if (locEl) locEl.innerHTML = `<i class="fas fa-location-dot"></i> ${bin.location}`;
  if (imgEl) imgEl.style.backgroundImage = `url('${bin.imageUrl}')`;
  const previewDetails = document.querySelector('.preview-details');
  if (previewDetails) previewDetails.innerHTML = `
    <div class="preview-detail-row"><span class="detail-label">Capacity</span><span class="detail-value">${bin.capacity} Liters</span></div>
    <div class="preview-detail-row"><span class="detail-label">Alert Threshold</span><span class="detail-value">${bin.threshold}%</span></div>
    <div class="preview-detail-row"><span class="detail-label">Sensor Status</span><span class="detail-value detail-value--connected">${bin.sensorStatus}</span></div>
  `;
}

function updateAdditionalInfo(bin) {
  if (!infoDetails) return;
  infoDetails.innerHTML = `
    <div class="info-row"><span class="info-label">Last Configured:</span><span class="info-value">${bin.lastConfigured}</span></div>
    <div class="info-row"><span class="info-label">Status:</span><span class="info-value">${bin.status}</span></div>
    <div class="info-row"><span class="info-label">Date Created:</span><span class="info-value">${bin.dateCreated}</span></div>
  `;
}

function reindexBins() {
  for (let i = 0; i < bins.length; i++) {
    bins[i].id = i + 1;
  }
}

function sortBins() {
  bins.sort((a, b) => {
    const aMs = a.createdAtMs || 0;
    const bMs = b.createdAtMs || 0;
    if (aMs !== bMs) return bMs - aMs; // newest first
    return (b.id || 0) - (a.id || 0);
  });
}

function attachEventListeners() {
  if (binSearchInput) binSearchInput.addEventListener('input', (e) => renderBinList(e.target.value));
  [binNameInput, binCapacityInput, binThresholdInput, binLocationInput, binImageUrlInput].forEach(i => { if (i) i.addEventListener('input', updateCurrentBinData); });
  if (infoToggle) infoToggle.addEventListener('click', (e) => { e.preventDefault(); const isVisible = infoDetails.style.display !== 'none'; infoDetails.style.display = isVisible ? 'none' : 'block'; infoToggle.innerHTML = isVisible ? '<i class="fas fa-chevron-down"></i> Additional information' : '<i class="fas fa-chevron-up"></i> Additional information'; });
  if (addNewBinBtn) addNewBinBtn.addEventListener('click', addNewBin);
  if (removeBtn) removeBtn.addEventListener('click', removeBin);
  if (saveBtn) saveBtn.addEventListener('click', saveBin);
  if (removeReasonSelect) removeReasonSelect.addEventListener('change', updateConfirmButtonState);
  if (modalConfirmBtn) modalConfirmBtn.addEventListener('click', confirmRemoveBin);
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeRemoveModal);
  if (removeModalOverlay) removeModalOverlay.addEventListener('click', (e) => { if (e.target === removeModalOverlay) closeRemoveModal(); });
}

// Fetch the user's role from /users/{uid}
async function fetchUserRole(uid) {
  if (!db) return null;
  try {
    const uDoc = await getDoc(doc(db, 'users', uid));
    if (uDoc.exists()) {
      const data = uDoc.data();
      return data.role || null;
    }
    return null;
  } catch (e) {
    console.warn('Failed to fetch user role:', e);
    return null;
  }
}

function showPermissionMessage(message) {
  console.warn('Permission:', message);
  const container = document.querySelector('.bin-items');
  if (container) {
    container.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'bin-list-permission-error';
    el.innerHTML = `<strong>Permission error:</strong> ${escapeHtml(message)}<br/><small>Check your Firestore rules and ensure your user has the correct role in the users collection.</small>`;
    container.appendChild(el);
  }
}
