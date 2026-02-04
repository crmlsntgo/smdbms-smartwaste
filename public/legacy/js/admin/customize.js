// Module-based Customize page (admin copy) with Firestore-backed bins and transactional serial reservation
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
  removeBtn = document.getElementById('remove-bin-btn') || document.querySelector('.config-btn--danger');
  saveBtn = document.getElementById('save-changes-btn') || document.querySelector('.config-btn--primary');
  infoToggle = document.querySelector('.info-toggle');
  infoDetails = document.querySelector('.info-details');

  removeModalOverlay = document.getElementById('remove-modal-overlay');
  removeReasonSelect = document.getElementById('remove-reason');
  modalConfirmBtn = document.getElementById('modal-confirm-btn');
  modalCancelBtn = document.getElementById('modal-cancel-btn');

  // Add integer validation for capacity and threshold inputs
  if (binCapacityInput) {
    binCapacityInput.addEventListener('input', function(e) {
      // Remove non-numeric characters except for temporary input states
      let value = e.target.value;
      // Allow empty or valid integers only
      if (value !== '' && !/^\d+$/.test(value)) {
        e.target.value = value.replace(/\D/g, '');
      }
    });
    binCapacityInput.addEventListener('blur', function(e) {
      // Ensure value is a valid integer on blur
      let value = parseInt(e.target.value, 10);
      if (isNaN(value) || value < 1) {
        e.target.value = '';
      } else {
        e.target.value = value.toString();
      }
    });
  }
  
  if (binThresholdInput) {
    binThresholdInput.addEventListener('input', function(e) {
      // Remove non-numeric characters
      let value = e.target.value;
      if (value !== '' && !/^\d+$/.test(value)) {
        e.target.value = value.replace(/\D/g, '');
      }
      // Enforce max value of 100
      let numValue = parseInt(e.target.value, 10);
      if (!isNaN(numValue) && numValue > 100) {
        e.target.value = '100';
      }
    });
    binThresholdInput.addEventListener('blur', function(e) {
      // Ensure value is a valid integer between 1-100 on blur
      let value = parseInt(e.target.value, 10);
      if (isNaN(value) || value < 1) {
        e.target.value = '';
      } else if (value > 100) {
        e.target.value = '100';
      } else {
        e.target.value = value.toString();
      }
    });
  }

  // Debug logging
  console.log('Admin customize.js: DOM elements loaded', {
    saveBtn: !!saveBtn,
    removeBtn: !!removeBtn,
    addNewBinBtn: !!addNewBinBtn
  });

  await initFirestore();
  if (auth) {
    if (auth.currentUser) {
      const role = await fetchUserRole(auth.currentUser.uid);
      if (role && (String(role).toLowerCase() === 'admin' || String(role).toLowerCase() === 'utility staff' || String(role).toLowerCase() === 'utility_staff')) {
        await loadBinsPage();
        renderBinList();
        selectBin(currentBinId);
      } else if (role) {
        showPermissionMessage('Your account does not have permission to read bins. Contact an administrator.');
      } else {
        try {
          await loadBinsFromFirestore();
          renderBinList();
          selectBin(currentBinId);
        } catch (e) {
          console.warn('admin/customize.js: load deferred until sign-in', e);
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
              await loadBinsFromFirestore();
              renderBinList();
              selectBin(currentBinId);
            } catch (e) {
              console.warn('admin/customize.js: load deferred until sign-in', e);
              showPermissionMessage('Unable to load bins due to permission restrictions. Please check Firestore rules and your user role.');
            }
          }
        } else {
          try {
            await loadBinsPage();
            renderBinList();
            selectBin(currentBinId);
          } catch (e) {
            console.warn('admin/customize.js: load deferred until sign-in', e);
            showPermissionMessage('Unable to load bins due to permission restrictions. Please sign in or check Firestore rules.');
          }
        }
      });
    }
  } else {
    await loadBinsPage();
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
    try { auth = getAuth(app); } catch (e) { console.warn('admin/customize.js: getAuth failed', e); }
    console.debug('admin/customize.js: Firestore initialized', firebaseConfig.projectId);
  } catch (e) {
    console.warn('admin/customize.js: Firestore init failed, using local data only:', e);
    db = null;
  }
}

async function loadBinsFromFirestore() {
  // Prefer paginated loading to avoid loading entire collection on the client
  console.warn('admin/customize.js: loadBinsFromFirestore() is deprecated; use loadBinsPage()');
  await loadBinsPage();
}

// Paginated loader for admin/customize: append page of bins
async function loadBinsPage() {
  if (!db) { bins = []; currentBinId = null; return; }
  try {
    const BINS_PAGE_SIZE = 200;
    const binsCol = collection(db, 'bins');
    let q;
    if (!binsLastDoc) q = query(binsCol, orderBy('createdAt', 'desc'), limit(BINS_PAGE_SIZE));
    else q = query(binsCol, orderBy('createdAt', 'desc'), startAfter(binsLastDoc), limit(BINS_PAGE_SIZE));
    const snaps = await getDocs(q);
    if (snaps.empty) { binsHasMore = false; if (!bins.length) currentBinId = null; return; }
    const page = [];
    let idx = bins.length + 1;
    snaps.forEach(d => {
      const data = d.data();
      if (data && data.status) {
        const statusLower = String(data.status).toLowerCase();
        if (['archived', 'deleted', 'restored'].includes(statusLower)) return;
      }
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
    sortBins(); reindexBins(); currentBinId = bins[0]?.id || 1;
  } catch (e) {
    console.warn('admin/customize.js: Failed to load bins (paged):', e);
    bins = []; currentBinId = null;
  }
}

function renderBinList(filter = '') {
  if (!binListContainer) return;
  sortBins();
  reindexBins();
  binListContainer.innerHTML = '';
  if (!bins || bins.length === 0) {
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
  const infoLastEl = document.getElementById('info-last-configured');
  const infoStatusEl = document.getElementById('info-status');
  const infoDateEl = document.getElementById('info-date-created');
  
  if (infoLastEl) infoLastEl.textContent = bin.lastConfigured || 'Unknown';
  if (infoStatusEl) infoStatusEl.textContent = bin.status || 'Available';
  if (infoDateEl) infoDateEl.textContent = bin.dateCreated || new Date().toLocaleDateString();
}

function updateCurrentBinData() {
  const bin = bins.find(b => b.id === currentBinId);
  if (!bin) return;
  
  // Update bin object with current input values
  if (binNameInput) bin.name = binNameInput.value;
  if (binCapacityInput) {
    const capacity = parseInt(binCapacityInput.value, 10);
    bin.capacity = isNaN(capacity) ? '' : capacity;
  }
  if (binThresholdInput) {
    const threshold = parseInt(binThresholdInput.value, 10);
    bin.threshold = isNaN(threshold) ? '' : Math.min(100, Math.max(1, threshold));
  }
  if (binLocationInput) bin.location = binLocationInput.value;
  if (binImageUrlInput) bin.imageUrl = binImageUrlInput.value;
  
  // Update preview in real-time
  updatePreview(bin);
  
  // Update bin list item name if changed
  const binItem = document.querySelector(`[data-bin-id="${currentBinId}"]`);
  if (binItem) {
    const nameEl = binItem.querySelector('.bin-item__name');
    if (nameEl) nameEl.textContent = bin.name;
    const locationEl = binItem.querySelector('.bin-item__meta span:last-child');
    if (locationEl) locationEl.textContent = bin.location;
  }
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

async function addNewBin() {
  console.log('Admin customize.js: addNewBin called');
  
  // Generate new bin ID
  const newId = bins.length > 0 ? Math.max(...bins.map(b => b.id)) + 1 : 1;
  
  // Generate serial number
  const serial = `SDB-${String(Math.floor(1000 + Math.random() * 9000))}`;
  
  // Create new bin object with default values
  const now = new Date();
  const newBin = {
    id: newId,
    name: `New Bin ${newId}`,
    capacity: 100,
    serial: serial,
    threshold: 80,
    location: 'Unassigned',
    imageUrl: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=400',
