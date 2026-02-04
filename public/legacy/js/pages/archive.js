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
  limit,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

let app, auth, db;
let authUnsubscribe = null;
let allBins = [];
let filteredBins = [];
const ARCHIVE_FETCH_LIMIT = 500; // soft limit to avoid fetching extremely large collections on the client
let currentPage = 1;
let currentFilter = 'all';
let userRole = null;
let binToDelete = null;
const itemsPerPage = 6;

// Initialize Firebase
async function initArchivePage() {
  try {
    const firebaseConfig = await loadEnvConfig();
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await checkUserRole(user);
        await loadArchivedBins();
        setupEventListeners();
      }
    });
  } catch (error) {
    console.error("Failed to initialize:", error);
    alert("Error loading application. Please try again later.");
  }
}

// Check user role to determine permissions
async function checkUserRole(user) {
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      userRole = userDoc.data().role;
      
      // Hide deleted filter tab for utility staff (only show for admins)
      const deletedTab = document.querySelector('.filter-tab--deleted');
      if (deletedTab) {
        if (userRole === 'admin') {
          deletedTab.style.display = '';
        } else {
          deletedTab.style.display = 'none';
        }
      }
    }
  } catch (error) {
    console.error("Error checking user role:", error);
  }
}

// Load archived bins from Firestore
async function loadArchivedBins() {
  try {
    allBins = [];
    
    // Load recent documents from archive collection (use limit to avoid huge fetches)
    const archiveQuery = query(collection(db, "archive"), orderBy('archivedAt', 'desc'), limit(ARCHIVE_FETCH_LIMIT));
    const archiveSnapshot = await getDocs(archiveQuery);
    archiveSnapshot.forEach((docSnap) => {
      const binData = docSnap.data();
      allBins.push({
        ...binData,
        id: docSnap.id,  // Set id AFTER spreading to ensure it's the Firestore doc ID
      });
    });
    
    // Load from deleted collection only if user is admin
    if (userRole === 'admin') {
      const deletedQuery = query(collection(db, "deleted"), orderBy('autoDeleteAfter', 'desc'), limit(ARCHIVE_FETCH_LIMIT));
      const deletedSnapshot = await getDocs(deletedQuery);
      deletedSnapshot.forEach((docSnap) => {
        const binData = docSnap.data();
        allBins.push({
          ...binData,
          id: docSnap.id,  // Set id AFTER spreading
          status: 'deleted',
        });
      });
    }

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

// Format date for display
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

// Update statistics
function updateStats() {
  const archived = allBins.filter(b => b.status === 'archived' || b.status === 'Archived').length;
  const restored = allBins.filter(b => b.status === 'restored' || b.status === 'Restored').length;

  document.getElementById('statTotalArchived').textContent = archived;
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
    if (emptyState) {
      emptyState.style.display = "flex";
      emptyState.querySelector("p").textContent = 
        currentFilter === 'all' ? "No archived bins found" : `No ${currentFilter} bins found`;
    }
    if (pagination) pagination.style.display = "none";
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  if (pagination) pagination.style.display = "flex";

  // Pagination
  const totalPages = Math.ceil(filteredBins.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const paginatedBins = filteredBins.slice(start, end);

  tbody.innerHTML = paginatedBins
    .map(
      (bin) => {
        const binId = bin.binId || bin.serial || bin.id;
        const binName = bin.name || bin.binName || 'Unknown Bin';
        const location = bin.location || 'Unknown Location';
        const archiveDate = formatDate(bin.archiveDate || bin.archivedAt);
        const reason = bin.reason || bin.archiveReason || 'No reason specified';
        const lastActive = formatDate(bin.lastActive || bin.lastConfigured);
        const status = bin.status || 'archived';
        const statusLower = status.toLowerCase();
        const isDeleted = statusLower === 'deleted';
        const isRestored = statusLower === 'restored';
        
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
        <span class="status-badge status-badge--${statusLower}">
          ${escapeHtml(status)}
        </span>
      </td>
      <td>
        ${!isDeleted && !isRestored ? `
          <button class="action-icon action-icon--restore" onclick="restoreBin('${bin.id}')" title="Restore">
            <i class="fas fa-redo"></i>
          </button>
        ` : ''}
        ${!isDeleted && userRole === 'admin' ? `
          <button class="action-icon action-icon--delete" onclick="showDeleteModal('${bin.id}')" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        ` : ''}
      </td>
    </tr>
  `;
      }
    )
    .join('');

  updatePaginationInfo();
  renderPaginationControls();
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
window.changePage = function (page) {
  const totalPages = Math.ceil(filteredBins.length / itemsPerPage);
  if (page < 1 || page > totalPages) return;
  
  currentPage = page;
  renderTable();
  window.scrollTo({ top: 0, behavior: "smooth" });
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
  