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
    sensorStatus: 'Connected',
    lastConfigured: 'Just now',
    status: 'Available',
    dateCreated: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    statusDot: 'green'
  };

  if (db) {
    if (!auth || !auth.currentUser) {
      showNotification('You must be signed in to add a new bin', 'error');
      return;
    }
    try {
      const created = await reserveSerialAndCreateBin(newBin);
      if (created) {
        newBin.docId = created.docId;
        newBin.serial = created.serial;
      } else {
        // Fallback: create without serial reservation
        const createdBy = auth.currentUser.uid;
        await setDoc(doc(db, 'bins', serial), {
          ...newBin,
          serial,
          status: 'Available',
          createdAt: serverTimestamp(),
          createdBy
        });
        newBin.docId = serial;
      }
    } catch (e) {
      console.error('admin/customize.js: Error during transactional create:', e);
      newBin.serial = `SDB-${Math.floor(1000 + Math.random() * 9000)}`;
    }
  }

  newBin.createdAtMs = Date.now();
  bins.unshift(newBin);
  sortBins();
  reindexBins();
  currentBinId = newBin.id;
  renderBinList();
  selectBin(currentBinId);
  showNotification('New bin created successfully');
}

// Transactional serial reservation and bin creation
async function reserveSerialAndCreateBin(binData, attempts = 10) {
  for (let i = 0; i < attempts; i++) {
    const serial = `SDB-${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      const result = await runTransaction(db, async (tx) => {
        const serialRef = doc(db, 'serials', serial);
        const serialSnap = await tx.get(serialRef);
        if (serialSnap.exists()) throw new Error('serial_exists');

        const binRef = doc(db, 'bins', serial);
        const createdBy = auth && auth.currentUser ? auth.currentUser.uid : null;

        const data = {
          ...binData,
          serial,
          status: 'Available',
          createdAt: serverTimestamp(),
          createdBy
        };

        tx.set(binRef, data);
        tx.set(serialRef, {
          binId: serial,
          reservedAt: serverTimestamp(),
          archived: false,
          createdBy
        });

        return { docId: serial, serial };
      });
      return result;
    } catch (err) {
      if (err.message === 'serial_exists') continue;
      console.warn('Serial reservation transaction error:', err);
    }
  }
  return null;
}

function removeBin() { showRemoveModal(); }

function showRemoveModal() {
  if (removeReasonSelect) removeReasonSelect.value = '';
  if (removeModalOverlay) removeModalOverlay.classList.add('active');
  updateConfirmButtonState();
}

function closeRemoveModal() {
  if (removeModalOverlay) removeModalOverlay.classList.remove('active');
  if (removeReasonSelect) removeReasonSelect.value = '';
}

function updateConfirmButtonState() {
  if (modalConfirmBtn) modalConfirmBtn.disabled = !(removeReasonSelect && removeReasonSelect.value !== '');
}

async function confirmRemoveBin() {
  const reason = removeReasonSelect ? removeReasonSelect.value : '';
  if (!reason) return;
  const currentBin = bins.find(b => b.id === currentBinId);
  if (!currentBin) {
    closeRemoveModal();
    return;
  }

  const binDocId = currentBin.docId || currentBin.serial;
  if (!binDocId) {
    showNotification('Cannot archive bin: invalid bin identifier', 'error');
    closeRemoveModal();
    return;
  }

  let persisted = false;
  if (db && binDocId) {
    const now = new Date();
    try {
      // Get user info for Archived By field
      let archivedByName = auth.currentUser.email || auth.currentUser.uid;
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          archivedByName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email || auth.currentUser.email || auth.currentUser.uid;
        }
      } catch (e) {
        console.warn('Could not fetch user details:', e);
      }

      // Move bin to archive collection transactionally
      await runTransaction(db, async (tx) => {
        const binRef = doc(db, 'bins', binDocId);
        const archiveRef = doc(db, 'archive', binDocId);
        const serialRef = doc(db, 'serials', binDocId || '');

        // All reads before writes
        const binSnap = await tx.get(binRef);
        if (!binSnap.exists()) throw new Error('Bin not found');

        const binData = binSnap.data();
        const sSnap = await tx.get(serialRef);

        // Write: archive the bin
        tx.set(archiveRef, {
          ...binData,
          status: 'archived',
          archivedAt: serverTimestamp(),
          archiveDate: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          archiveReason: reason,
          reason: reason,
          lastActive: currentBin.lastConfigured || now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          archivedBy: auth.currentUser.uid,
          archivedByName: archivedByName
        });

        // Delete from bins collection
        tx.delete(binRef);

        // Update serial if exists
        if (sSnap.exists()) tx.update(serialRef, { archived: true, archivedAt: serverTimestamp(), archiveReason: reason });
      });
      persisted = true;
    } catch (e) {
      console.warn('Transaction failed, trying fallback:', e);
      // Fallback: non-transactional
      try {
        let archivedByName = auth.currentUser.email || auth.currentUser.uid;
        const binRef = doc(db, 'bins', binDocId);
        const archiveRef = doc(db, 'archive', binDocId);

        const binSnap = await getDoc(binRef);
        if (!binSnap.exists()) throw new Error('Bin not found');

        const binData = binSnap.data();

        await setDoc(archiveRef, {
          ...binData,
          status: 'archived',
          archivedAt: serverTimestamp(),
          archiveDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          archiveReason: reason,
          reason: reason,
          lastActive: currentBin.lastConfigured || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          archivedBy: auth.currentUser.uid,
          archivedByName: archivedByName
        });

        await deleteDoc(binRef);
        persisted = true;
      } catch (e2) {
        console.error('Fallback archive failed:', e2);
      }
    }
  }

  if (!persisted) {
    showNotification(`Failed to archive "${currentBin.name}". Check console for details.`, 'error');
    closeRemoveModal();
    return;
  }

  bins = bins.filter(b => b.id !== currentBinId);
  sortBins();
  reindexBins();
  currentBinId = bins[0]?.id || 1;
  renderBinList();
  selectBin(currentBinId);
  showNotification(`Bin "${currentBin.name}" moved to archive`);
  closeRemoveModal();
}

async function saveBin() {
  const bin = bins.find(b => b.id === currentBinId);
  if (!bin) return showNotification('No bin selected', 'error');

  const capacity = parseInt(bin.capacity, 10);
  const threshold = parseInt(bin.threshold, 10);

  if (isNaN(capacity) || capacity < 1) {
    showNotification('Capacity must be a valid positive integer', 'error');
    return;
  }

  if (isNaN(threshold) || threshold < 1 || threshold > 100) {
    showNotification('Threshold must be an integer between 1 and 100', 'error');
    return;
  }

  if (db) {
    if (!auth || !auth.currentUser) {
      showNotification('You must be signed in to save changes', 'error');
      return;
    }
    try {
      if (bin.docId) {
        const now = new Date();
        const lastConfigured = now.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' });
        const infoStatusEl = document.getElementById('info-status');
        const status = infoStatusEl ? infoStatusEl.textContent.trim() : (bin.status || null);
        const dateCreated = bin.dateCreated || now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        await updateDoc(doc(db, 'bins', bin.docId), {
          name: bin.name,
          capacity: Number(bin.capacity) || 0,
          threshold: Number(bin.threshold) || 0,
          location: bin.location,
          imageUrl: bin.imageUrl,
          lastConfigured: lastConfigured,
          status: status,
          dateCreated: dateCreated,
          updatedAt: serverTimestamp(),
        });
        bin.lastConfigured = lastConfigured;
        bin.status = status;
        bin.dateCreated = dateCreated;
        const infoLastEl = document.getElementById('info-last-configured');
        const infoDateEl = document.getElementById('info-date-created');
        if (infoLastEl) infoLastEl.textContent = lastConfigured;
        if (infoDateEl) infoDateEl.textContent = dateCreated;
      } else {
        const createdBy = auth.currentUser.uid;
        const now = new Date();
        const dateCreated = bin.dateCreated || now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const lastConfigured = bin.lastConfigured || now.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' });
        const infoStatusEl = document.getElementById('info-status');
        const status = infoStatusEl ? infoStatusEl.textContent.trim() : (bin.status || null);

        const docRef = await addDoc(collection(db, 'bins'), { ...bin, createdAt: serverTimestamp(), createdBy, lastConfigured, status, dateCreated });
        bin.docId = docRef.id;
        bin.createdAtMs = Date.now();
        bin.lastConfigured = lastConfigured;
        bin.status = status;
        bin.dateCreated = dateCreated;
        const infoLastEl = document.getElementById('info-last-configured');
        const infoDateEl = document.getElementById('info-date-created');
        if (infoLastEl) infoLastEl.textContent = lastConfigured;
        if (infoDateEl) infoDateEl.textContent = dateCreated;
      }
      showNotification('Changes saved successfully');
    } catch (e) {
      console.error('admin/customize.js: Failed to save bin:', e);
      showNotification(`Failed to save changes: ${e.message || e}`, 'error');
    }
  } else {
    showNotification('Changes saved locally (Firestore not available)');
  }
}

function attachEventListeners() {
  if (binSearchInput) binSearchInput.addEventListener('input', (e) => renderBinList(e.target.value));
  [binNameInput, binCapacityInput, binThresholdInput, binLocationInput, binImageUrlInput].forEach(i => {
    if (i) i.addEventListener('input', updateCurrentBinData);
  });
  if (infoToggle) infoToggle.addEventListener('click', (e) => {
    e.preventDefault();
    const isVisible = infoDetails.style.display !== 'none';
    infoDetails.style.display = isVisible ? 'none' : 'block';
    infoToggle.innerHTML = isVisible ? '<i class="fas fa-chevron-down"></i> Additional information' : '<i class="fas fa-chevron-up"></i> Additional information';
  });
  if (addNewBinBtn) addNewBinBtn.addEventListener('click', addNewBin);
  if (removeBtn) removeBtn.addEventListener('click', removeBin);
  if (saveBtn) saveBtn.addEventListener('click', saveBin);
  if (removeReasonSelect) removeReasonSelect.addEventListener('change', updateConfirmButtonState);
  if (modalConfirmBtn) modalConfirmBtn.addEventListener('click', confirmRemoveBin);
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeRemoveModal);
  if (removeModalOverlay) removeModalOverlay.addEventListener('click', (e) => { if (e.target === removeModalOverlay) closeRemoveModal(); });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification notification--${type}`;
  notification.innerHTML = `
    <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(notification);
  notification.style.cssText = `position: fixed; bottom: 20px; right: 20px; background: ${type === 'error' ? '#ef4444' : '#10b981'}; color: white; padding: 12px 16px; border-radius: 6px; display: flex; align-items: center; gap: 8px; font-size: 13px; z-index: 1000; animation: slideIn 0.3s ease;`;
  setTimeout(() => { notification.style.animation = 'slideOut 0.3s ease'; setTimeout(() => notification.remove(), 300); }, 3000);
}

const style = document.createElement('style');
style.textContent = `@keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }`;
document.head.appendChild(style);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (authUnsubscribe) authUnsubscribe();
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
