import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  deleteField,
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

let app, auth, db;
let allBins = [];
let filteredBins = [];
let currentPage = 1;
let currentFilter = 'all';
const itemsPerPage = 6;

// Clean up expired deleted bins
async function cleanupExpiredDeletedBins() {
  try {
    const now = Timestamp.now();
    const deletedCol = collection(db, "deleted");
    
    // Query for bins where autoDeleteAfter <= now
    const expiredQuery = query(deletedCol, where("autoDeleteAfter", "<=", now));
    const expiredSnapshot = await getDocs(expiredQuery);
    
    if (expiredSnapshot.empty) {
      console.log('No expired bins to delete');
      return;
    }
    
    let deleteCount = 0;
    const deletePromises = [];
    
    expiredSnapshot.forEach((docSnap) => {
      console.log(`Auto-deleting expired bin: ${docSnap.id}`);
      deletePromises.push(deleteDoc(doc(db, "deleted", docSnap.id)));
      deleteCount++;
    });
    
    await Promise.all(deletePromises);
    console.log(`Successfully auto-deleted ${deleteCount} expired bin(s)`);
  } catch (error) {
    console.error('Error cleaning up expired bins:', error);
  }
}

// Initialize Firebase
async function initArchivePage() {
  try {
    const firebaseConfig = await loadEnvConfig();
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Clean up expired deleted bins before loading
        await cleanupExpiredDeletedBins();
        await loadArchivedBins();
        setupEventListeners();
      }
    });
  } catch (error) {
    console.error("Failed to initialize:", error);
    alert("Error loading application. Please try again later.");
  }
}

// Load archived bins from Firestore
async function loadArchivedBins() {
  try {
    allBins = [];
    
    // Load from archive collection (archived and restored bins)
    const archiveCol = collection(db, "archive");
    const archiveSnapshot = await getDocs(archiveCol);
    archiveSnapshot.forEach((doc) => {
      const binData = doc.data();
      allBins.push({
        ...binData,
        id: doc.id,  // Set id AFTER spreading to ensure it's the Firestore doc ID
      });
    });
    
    // Load from deleted collection (deleted bins)
    const deletedCol = collection(db, "deleted");
    const deletedSnapshot = await getDocs(deletedCol);
    deletedSnapshot.forEach((doc) => {
      const binData = doc.data();
      allBins.push({
        ...binData,
        id: doc.id,  // Set id AFTER spreading
        status: 'deleted', // Ensure status is set to deleted
      });
    });

    // Sort by archive date (most recent first)
    allBins.sort((a, b) => {
      const dateA = parseDate(a.archiveDate || a.archivedAt);
      const dateB = parseDate(b.archiveDate || b.archivedAt);
      return dateB - dateA;
    });

    updateStats();
    applyFilters();
  } catch (error) {
    console.error("Error loading bins:", error);
    showEmptyState("Error loading archived bins. Please refresh the page.");
  }
}

// Parse date string to Date object
function parseDate(dateStr) {
  if (!dateStr) return new Date(0);
  if (dateStr.seconds) return new Date(dateStr.seconds * 1000);
  return new Date(dateStr);
}

// Update statistics
function updateStats() {
  const archived = allBins.filter(b => b.status === 'archived' || b.status === 'Archived').length;
  const deleted = allBins.filter(b => b.status === 'deleted' || b.status === 'Deleted').length;
  const restored = allBins.filter(b => b.status === 'restored' || b.status === 'Restored').length;

  document.getElementById('statTotalArchived').textContent = archived;
  document.getElementById('statDeleted').textContent = deleted;
  document.getElementById('statRestored').textContent = restored;
}

// Render table
function renderTable() {
  const tbody = document.getElementById("archive-table-body");
  const emptyState = document.getElementById("emptyState");
  const pagination = document.getElementById("pagination");
  
  if (!tbody) return;

  if (filteredBins.length === 0) {
    tbody.innerHTML = "";
    if (emptyState) emptyState.style.display = "flex";
    if (pagination) pagination.style.display = "none";
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  if (pagination) pagination.style.display = "flex";

  // Pagination
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBins = filteredBins.slice(startIndex, endIndex);

  tbody.innerHTML = paginatedBins
    .map((bin) => {
      const binId = bin.binId || bin.serial || bin.id || 'N/A';
      const binName = bin.name || bin.binName || 'Unknown Bin';
      const location = bin.location || 'Unknown Location';
      const archiveDate = formatDate(bin.archiveDate || bin.archivedAt);
      const reason = bin.reason || bin.archiveReason || 'No reason specified';
      const lastActive = formatDate(bin.lastActive || bin.lastActiveDate);
      const status = bin.status || 'Archived';
      const statusClass = status.toLowerCase();
      const isDeleted = statusClass === 'deleted';
      const isRestored = statusClass === 'restored';
      const archivedBy = bin.archivedByName || (bin.archivedBy ? 'User ID: ' + bin.archivedBy : '-');
      const modifiedBy = bin.modifiedBy || (bin.restoredBy ? 'User ID: ' + bin.restoredBy : (bin.deletedBy ? 'User ID: ' + bin.deletedBy : '-'));

      return `
        <tr data-bin-id="${bin.id}">
          <td><input type="checkbox" class="bin-checkbox" data-bin-id="${bin.id}" /></td>
          <td><span class="bin-id">#${escapeHtml(binId)}</span></td>
          <td>
            <strong>${escapeHtml(binName)}</strong>
            <div class="bin-location">${escapeHtml(location)}</div>
          </td>
          <td>${archiveDate}</td>
          <td>${escapeHtml(reason)}</td>
          <td>${lastActive}</td>
          <td>
            <span class="status-badge status-badge--${statusClass}">
              ${escapeHtml(status)}
            </span>
          </td>
          <td>${escapeHtml(archivedBy)}</td>
          <td>${escapeHtml(modifiedBy)}</td>
          <td class="action-buttons">
            ${!isDeleted && !isRestored ? `<button class="action-icon action-icon--restore" onclick="restoreBin('${bin.id}')" title="Restore">
              <i class="fas fa-undo"></i>
            </button>` : ''}
            ${!isRestored ? `<button class="action-icon action-icon--delete" onclick="confirmDelete('${bin.id}', '${escapeHtml(binName)}', '${statusClass}')" title="${isDeleted ? 'Permanently Delete' : 'Delete'}">
              <i class="fas fa-trash"></i>
            </button>` : ''}
          </td>
        </tr>
      `;
    })
    .join("");

  updatePaginationInfo();
  renderPaginationControls();
}

// Format date
function formatDate(date) {
  if (!date) return 'N/A';
  
  try {
    let dateObj;
    if (date.seconds) {
      dateObj = new Date(date.seconds * 1000);
    } else if (typeof date === 'string') {
      dateObj = new Date(date);
    } else {
      dateObj = date;
    }
    
    return dateObj.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return 'Invalid date';
  }
}

// Update pagination info
function updatePaginationInfo() {
  const totalItems = filteredBins.length;
  const startIndex = (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(startIndex + itemsPerPage - 1, totalItems);
  
  const infoElement = document.getElementById('paginationInfo');
  if (infoElement) {
    infoElement.textContent = `Showing ${startIndex}-${endIndex} of ${totalItems} entries`;
  }
}

// Render pagination controls
function renderPaginationControls() {
  const totalPages = Math.ceil(filteredBins.length / itemsPerPage);
  const controls = document.getElementById('paginationControls');
  
  if (!controls) return;
  
  let buttons = [];
  
  // Previous button
  buttons.push(`
    <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">
      Previous
    </button>
  `);
  
  // Page number buttons
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      buttons.push(`
        <button class="pagination-btn ${i === currentPage ? 'pagination-btn--active' : ''}" onclick="changePage(${i})">
          ${i}
        </button>
      `);
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      buttons.push('<span class="pagination-dots">...</span>');
    }
  }
  
  // Next button
  buttons.push(`
    <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">
      Next
    </button>
  `);
  
  controls.innerHTML = buttons.join('');
}

// Change page
window.changePage = function(page) {
  const totalPages = Math.ceil(filteredBins.length / itemsPerPage);
  if (page < 1 || page > totalPages) return;
  
  currentPage = page;
  renderTable();
};

// Setup event listeners
function setupEventListeners() {
  // Select all checkbox
  const selectAll = document.getElementById("archive-select-all");
  if (selectAll) {
    selectAll.addEventListener("change", handleSelectAll);
  }

  // Filter tabs
  const filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const filter = tab.getAttribute('data-filter');
      handleFilterChange(filter);
      
      // Update active tab
      filterTabs.forEach((t) => t.classList.remove('filter-tab--active'));
      tab.classList.add('filter-tab--active');
    });
  });

  // Search
  const searchInput = document.getElementById("archive-search");
  if (searchInput) {
    searchInput.addEventListener("input", handleSearch);
  }

  // Restore selected button
  const restoreBtn = document.getElementById("restoreSelectedBtn");
  if (restoreBtn) {
    restoreBtn.addEventListener("click", restoreSelected);
  }

  // Delete modal buttons
  const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
  
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", hideDeleteModal);
  }
  
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", executeDelete);
  }

  // Close modal on backdrop click
  const modal = document.getElementById("deleteModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        hideDeleteModal();
      }
    });
  }
}

// Handle select all
function handleSelectAll(e) {
  const checkboxes = document.querySelectorAll(".bin-checkbox");
  checkboxes.forEach(cb => {
    cb.checked = e.target.checked;
  });
}

// Handle filter change
function handleFilterChange(filter) {
  currentFilter = filter;
  applyFilters();
}

// Apply filters based on current filter and search
function applyFilters() {
  const searchInput = document.getElementById("archive-search");
  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  
  // First, filter by status
  let statusFilteredBins = allBins;
  if (currentFilter !== 'all') {
    statusFilteredBins = allBins.filter(bin => {
      const status = String(bin.status || '').toLowerCase();
      return status === currentFilter;
    });
  }
  
  // Then apply search filter
  if (searchTerm) {
    filteredBins = statusFilteredBins.filter(bin => {
      const binId = String(bin.binId || bin.serial || bin.id || '').toLowerCase();
      const binName = String(bin.name || bin.binName || '').toLowerCase();
      const location = String(bin.location || '').toLowerCase();
      const reason = String(bin.reason || bin.archiveReason || '').toLowerCase();
      
      return binId.includes(searchTerm) || 
             binName.includes(searchTerm) || 
             location.includes(searchTerm) ||
             reason.includes(searchTerm);
    });
  } else {
    filteredBins = statusFilteredBins;
  }
  
  currentPage = 1;
  renderTable();
}

// Handle search
function handleSearch(e) {
  applyFilters();
}

// Restore single bin
window.restoreBin = async function(binId) {
  try {
    console.log('restoreBin (admin) - Called with binId:', binId);
    console.log('restoreBin (admin) - allBins array length:', allBins.length);
    console.log('restoreBin (admin) - allBins IDs:', allBins.map(b => ({ id: b.id, serial: b.serial, name: b.name })));
    
    const bin = allBins.find(b => b.id === binId);
    if (!bin) {
      console.error('restoreBin (admin) - Bin not found in allBins array. binId:', binId);
      alert('Bin not found');
      return;
    }

    console.log('restoreBin (admin) - Found bin:', { id: bin.id, serial: bin.serial, name: bin.name, status: bin.status });
    const binName = bin.name || bin.binName || binId;
    
    if (!confirm(`Restore "${binName}"?`)) {
      return;
    }

    // Move from archive collection back to bins collection
    const archiveRef = doc(db, "archive", binId);
    const binsRef = doc(db, "bins", binId);
    
    console.log('restoreBin (admin) - Attempting to read from archive collection:', binId);
    // Get archived bin data
    const archiveSnap = await getDoc(archiveRef);
    if (!archiveSnap.exists()) {
      console.error('restoreBin (admin) - Bin not found in archive collection:', binId);
      alert('Bin not found in archive');
      return;
    }
    
    console.log('restoreBin (admin) - Archive document found, restoring...');
    const binData = archiveSnap.data();
    
    // Create clean data object excluding archive fields
    const cleanedData = { ...binData };
    delete cleanedData.archivedAt;
    delete cleanedData.archiveDate;
    delete cleanedData.archiveReason;
    delete cleanedData.archivedBy;
    delete cleanedData.archivedByName;
    delete cleanedData.reason;
    delete cleanedData.status; // will be set to Available explicitly

    // Get user info for Modified By column
    let modifiedBy = auth.currentUser.email || auth.currentUser.uid;
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        modifiedBy = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email || auth.currentUser.email || auth.currentUser.uid;
      }
    } catch (e) {
      console.warn('Could not fetch user details:', e);
    }
    
    // Restore to bins collection with cleaned data
    await setDoc(binsRef, {
      ...cleanedData,
      status: "Available",
      restoredAt: Timestamp.now(),
      restoredBy: auth.currentUser.uid
    });
    
    // Remove from archive collection completely (move back)
    await deleteDoc(archiveRef);

    console.log('restoreBin (admin) - Successfully restored bin:', binId);
    alert(`"${binName}" has been restored successfully!`);
    await loadArchivedBins();
  } catch (error) {
    console.error("Error restoring bin:", error);
    alert("Failed to restore bin. Please try again.");
  }
};

// Restore selected bins
async function restoreSelected() {
  const selected = document.querySelectorAll(".bin-checkbox:checked");
  
  if (selected.length === 0) {
    alert("Please select at least one bin to restore.");
    return;
  }

  // Validate bin statuses before confirming
  const selectedBins = [];
  const alreadyRestored = [];
  const deletedBins = [];
  
  for (const checkbox of selected) {
    const binId = checkbox.getAttribute("data-bin-id");
    const bin = allBins.find(b => b.id === binId);
    
    if (bin) {
      const status = (bin.status || '').toLowerCase();
      
      if (status === 'restored') {
        alreadyRestored.push(bin.name || bin.binName || binId);
      } else if (status === 'deleted') {
        deletedBins.push(bin.name || bin.binName || binId);
      } else {
        selectedBins.push(binId);
      }
    }
  }
  
  // Show error messages for invalid selections
  if (alreadyRestored.length > 0) {
    alert(`The following bin(s) are already restored and cannot be restored again:\n\n${alreadyRestored.join('\n')}`);
    return;
  }
  
  if (deletedBins.length > 0) {
    alert(`The following bin(s) have been deleted and cannot be restored:\n\n${deletedBins.join('\n')}\n\nDeleted bins must be permanently removed or moved back to archive before restoration.`);
    return;
  }
  
  if (selectedBins.length === 0) {
    alert("No valid bins selected for restoration.");
    return;
  }

  if (!confirm(`Restore ${selectedBins.length} bin(s)?`)) {
    return;
  }

  try {
    const promises = selectedBins.map(async (binId) => {
      const archiveRef = doc(db, "archive", binId);
      const binsRef = doc(db, "bins", binId);
      
      // Get archived bin data
      const archiveSnap = await getDoc(archiveRef);
      if (!archiveSnap.exists()) return;
      
      const binData = archiveSnap.data();
      
      // Create clean data object excluding archive fields
      const cleanedData = { ...binData };
      delete cleanedData.archivedAt;
      delete cleanedData.archiveDate;
      delete cleanedData.archiveReason;
      delete cleanedData.archivedBy;
      delete cleanedData.archivedByName;
      delete cleanedData.reason;
      delete cleanedData.status;

      // Restore to bins collection
      await setDoc(binsRef, {
        ...cleanedData,
        status: "Available",
        restoredAt: Timestamp.now(),
        restoredBy: auth.currentUser.uid
      });
      
      // Remove from archive collection completely
      await deleteDoc(archiveRef);
    });

    await Promise.all(promises);
    alert(`${selectedBins.length} bin(s) restored successfully!`);
    await loadArchivedBins();
  } catch (error) {
    console.error("Error restoring bins:", error);
    alert("Failed to restore some bins. Please try again.");
  }
}

// Confirm delete
let binToDelete = null;
let binToDeleteStatus = null;

window.confirmDelete = function(binId, binName, status) {
  binToDelete = binId;
  binToDeleteStatus = status || 'archived';
  const modal = document.getElementById("deleteModal");
  const nameElement = document.getElementById("deleteBinName");
  
  if (nameElement) {
    nameElement.textContent = binName;
  }
  
  // Update modal message based on status
  const modalText = document.querySelector('#deleteModal .modal-text');
  if (modalText && binToDeleteStatus === 'deleted') {
    modalText.textContent = `Are you sure you want to permanently delete "${binName}"? This action cannot be undone.`;
  }
  
  if (modal) {
    modal.classList.add('active');
  }
};

// Execute delete
async function executeDelete() {
  if (!binToDelete) return;

  try {
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    if (confirmBtn) confirmBtn.disabled = true;

    console.log('Delete action for bin:', binToDelete, 'with status:', binToDeleteStatus);
    
    // Get user info for Modified By column
    let modifiedBy = auth.currentUser.email || auth.currentUser.uid;
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        modifiedBy = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.email || auth.currentUser.email || auth.currentUser.uid;
      }
    } catch (e) {
      console.warn('Could not fetch user details:', e);
    }
    
    if (binToDeleteStatus === 'deleted') {
      // Permanently delete from both archive and deleted collections
      const archiveRef = doc(db, "archive", binToDelete);
      const deletedRef = doc(db, "deleted", binToDelete);
      
      // Delete from both collections
      await deleteDoc(deletedRef);
      
      // Check if it exists in archive and delete from there too
      const archiveSnap = await getDoc(archiveRef);
      if (archiveSnap.exists()) {
        await deleteDoc(archiveRef);
      }
      
      console.log('Bin permanently deleted:', binToDelete);
      await loadArchivedBins();
      hideDeleteModal();
      alert("Bin permanently deleted from the system.");
    } else {
      // Move to deleted collection (soft delete)
      const archiveRef = doc(db, "archive", binToDelete);
      const deletedRef = doc(db, "deleted", binToDelete);
      
      // Get bin data from archive
      const archiveSnap = await getDoc(archiveRef);
      if (!archiveSnap.exists()) {
        throw new Error('Bin not found in archive');
      }
      
      const binData = archiveSnap.data();
      
      // Move to deleted collection with deletion metadata
      await setDoc(deletedRef, {
        ...binData,
        status: 'deleted',
        deletedAt: Timestamp.now(),
        deletedBy: auth.currentUser.uid,
        modifiedBy: modifiedBy,
        modifiedAt: Timestamp.now(),
        // For testing: auto-delete after 1 minute (60 seconds)
        // For production: use 30 days (30 * 24 * 60 * 60 seconds = 2592000)
        autoDeleteAfter: Timestamp.fromMillis(Date.now() + (60 * 1000)) // 1 minute
      });
      
      // Delete from archive collection (not update - to avoid duplication)
      await deleteDoc(archiveRef);
      
      console.log('Bin moved to deleted collection:', binToDelete);
      await loadArchivedBins();
      hideDeleteModal();
      alert("Bin moved to deleted collection. It will be permanently removed after 30 days.");
    }
  } catch (error) {
    console.error("Error deleting bin:", error);
    alert("Failed to delete bin. Please try again.");
  } finally {
    const confirmBtn = document.getElementById("confirmDeleteBtn");
    if (confirmBtn) confirmBtn.disabled = false;
    binToDelete = null;
  }
}

// Hide delete modal
function hideDeleteModal() {
  const modal = document.getElementById("deleteModal");
  if (modal) {
    modal.classList.remove('active');
  }
  binToDelete = null;
  binToDeleteStatus = null;
}

// Show empty state
function showEmptyState(message = "No archived bins found") {
  const tbody = document.getElementById("archive-table-body");
  const emptyState = document.getElementById("emptyState");
  const pagination = document.getElementById("pagination");
  
  if (tbody) tbody.innerHTML = "";
  if (emptyState) {
    emptyState.style.display = "flex";
    const p = emptyState.querySelector("p");
    if (p) p.textContent = message;
  }
  if (pagination) pagination.style.display = "none";
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on load
initArchivePage();
