import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter,
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

let app, auth, db;
let authUnsubscribe = null;
let allUsers = [];
let filteredUsers = [];
let sortDirection = 'asc'; // 'asc' for A-Z, 'desc' for Z-A
const USERS_PAGE_SIZE = 50;
let usersLastDoc = null;
let usersHasMore = true;

// Initialize Firebase
async function initUsersPage() {
  try {
    const firebaseConfig = await loadEnvConfig();
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
          await loadUsersPage();
          setupEventListeners();
        }
    });
  } catch (error) {
    console.error("Failed to initialize:", error);
    alert("Error loading application. Please try again later.");
  }
}

// Load a page of users from Firestore
async function loadUsersPage() {
  try {
    const usersCol = collection(db, "users");
    let q;
    if (!usersLastDoc) {
      q = query(usersCol, orderBy('firstName'), limit(USERS_PAGE_SIZE));
    } else {
      q = query(usersCol, orderBy('firstName'), startAfter(usersLastDoc), limit(USERS_PAGE_SIZE));
    }
    const usersSnapshot = await getDocs(q);

    if (!usersSnapshot.empty) {
      const page = [];
      usersSnapshot.forEach((d) => {
        const userData = d.data();
        page.push({ uid: d.id, ...userData });
      });

      // append
      allUsers = allUsers.concat(page);
      usersLastDoc = usersSnapshot.docs[usersSnapshot.docs.length - 1];
      usersHasMore = page.length === USERS_PAGE_SIZE;
    } else {
      usersHasMore = false;
    }

    // Sort by name by default
    allUsers.sort((a, b) => {
      const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
      const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
      return nameA.localeCompare(nameB);
    });

    filteredUsers = [...allUsers];
    renderUsers();
    updateUserCount();

    // show load more if more pages
    renderLoadMoreUsersControl();
  } catch (error) {
    console.error("Error loading users:", error);
    showEmptyState("Error loading users. Please refresh the page.");
  }
}

function renderLoadMoreUsersControl() {
  const container = document.getElementById('users-load-more-container');
  let wrapper = container;
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.id = 'users-load-more-container';
    wrapper.style.margin = '12px 0';
    const table = document.getElementById('usersTableBody');
    if (table && table.parentElement) table.parentElement.parentElement.appendChild(wrapper);
  }
  wrapper.innerHTML = '';
  if (usersHasMore) {
    const btn = document.createElement('button');
    btn.textContent = 'Load more users';
    btn.className = 'config-btn--primary';
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Loading...';
      await loadUsersPage();
      filteredUsers = [...allUsers];
      renderUsers();
      updateUserCount();
      btn.disabled = false;
      btn.textContent = 'Load more users';
      if (!usersHasMore) wrapper.remove();
    });
    wrapper.appendChild(btn);
  }
}

// Render users in table
function renderUsers() {
  const tbody = document.getElementById("usersTableBody");
  const emptyState = document.getElementById("emptyState");
  
  if (!tbody) return;

  if (filteredUsers.length === 0) {
    tbody.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  tbody.innerHTML = filteredUsers
    .map((user) => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No Name';
      const initials = getInitials(user.firstName, user.lastName);
      const avatarColor = getAvatarColor(user.uid);
      const email = user.email || 'No email';
      const role = user.role || 'utility staff';
      const roleClass = role.toLowerCase().replace(' ', '-');
      const roleDisplay = role.charAt(0).toUpperCase() + role.slice(1);

      return `
        <tr data-uid="${user.uid}">
          <td class="checkbox-col">
            <input type="checkbox" class="user-checkbox" data-uid="${user.uid}" />
          </td>
          <td>
            <div class="user-avatar">
              <div class="avatar-circle" style="background-color: ${avatarColor}">
                ${initials}
              </div>
              <span class="user-name-text">${escapeHtml(fullName)}</span>
            </div>
          </td>
          <td>${escapeHtml(email)}</td>
          <td>
            <span class="role-badge ${roleClass}">${escapeHtml(roleDisplay)}</span>
          </td>
          <td class="actions-col">
            <button class="actions-btn" onclick="showUserDetails('${user.uid}')" title="View Details">
              <i class="fas fa-ellipsis-v"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

// Get user initials
function getInitials(firstName, lastName) {
  const first = (firstName || '').trim().charAt(0).toUpperCase();
  const last = (lastName || '').trim().charAt(0).toUpperCase();
  return first + last || '?';
}

// Get avatar color based on UID
function getAvatarColor(uid) {
  const colors = [
    '#027a64', '#1976d2', '#7b1fa2', '#c2185b',
    '#d32f2f', '#f57c00', '#388e3c', '#0097a7',
  ];
  const index = (uid || '').charCodeAt(0) % colors.length;
  return colors[index];
}

// Update user count
function updateUserCount() {
  const countElement = document.getElementById("userCount");
  if (countElement) {
    const count = filteredUsers.length;
    countElement.textContent = `${count} user${count !== 1 ? 's' : ''}`;
  }
}

// Show empty state
function showEmptyState(message = "No users found") {
  const tbody = document.getElementById("usersTableBody");
  const emptyState = document.getElementById("emptyState");
  
  if (tbody) tbody.innerHTML = "";
  if (emptyState) {
    emptyState.style.display = "block";
    const p = emptyState.querySelector("p");
    if (p) p.textContent = message;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Search
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", handleSearch);
  }

  // Filters
  const roleFilter = document.getElementById("roleFilter");
  
  if (roleFilter) {
    roleFilter.addEventListener("change", applyFilters);
  }

  // Select all checkbox
  const selectAll = document.getElementById("selectAll");
  if (selectAll) {
    selectAll.addEventListener("change", handleSelectAll);
  }

  // Close modal
  const closeModal = document.getElementById("closeModal");
  if (closeModal) {
    closeModal.addEventListener("click", hideModal);
  }

  // Close modal on backdrop click
  const modal = document.getElementById("userModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        hideModal();
      }
    });
  }

  // Name column sorting
  const sortableHeader = document.querySelector('th.sortable[data-sort="name"]');
  if (sortableHeader) {
    sortableHeader.style.cursor = 'pointer';
    sortableHeader.addEventListener('click', toggleNameSort);
  }
}

// Handle search
function handleSearch(e) {
  const searchTerm = e.target.value.toLowerCase().trim();
  applyFilters();
}

// Apply filters
function applyFilters() {
  const searchTerm = document.getElementById("searchInput")?.value.toLowerCase().trim() || '';
  const roleFilter = document.getElementById("roleFilter")?.value || '';

  filteredUsers = allUsers.filter(user => {
    // Search filter
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
    const email = (user.email || '').toLowerCase();
    const matchesSearch = !searchTerm || 
      fullName.includes(searchTerm) || 
      email.includes(searchTerm);

    // Role filter
    const userRole = (user.role || 'utility staff').toLowerCase();
    const matchesRole = !roleFilter || userRole === roleFilter.toLowerCase();

    return matchesSearch && matchesRole;
  });

  renderUsers();
  updateUserCount();
}

// Toggle name sorting
function toggleNameSort() {
  // Toggle direction
  sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  
  // Update sort icon
  const sortIcon = document.querySelector('th.sortable[data-sort="name"] i');
  if (sortIcon) {
    sortIcon.className = sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
  }
  
  // Sort the current filtered users
  filteredUsers.sort((a, b) => {
    const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
    const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
    
    if (sortDirection === 'asc') {
      return nameA.localeCompare(nameB);
    } else {
      return nameB.localeCompare(nameA);
    }
  });
  
  renderUsers();
}

// Handle select all
function handleSelectAll(e) {
  const checkboxes = document.querySelectorAll(".user-checkbox");
  checkboxes.forEach(cb => {
    cb.checked = e.target.checked;
  });
}

// Show user details modal
window.showUserDetails = async function(uid) {
  const user = allUsers.find(u => u.uid === uid);
  if (!user) return;

  const modal = document.getElementById("userModal");
  const modalBody = document.getElementById("modalBody");
  
  if (!modal || !modalBody) return;

  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'No Name';
  const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(',', '') : 'Unknown';

  modalBody.innerHTML = `
    <div class="user-detail-row">
      <span class="detail-label">Full Name:</span>
      <span class="detail-value">${escapeHtml(fullName)}</span>
    </div>
    <div class="user-detail-row">
      <span class="detail-label">Email:</span>
      <span class="detail-value">${escapeHtml(user.email || 'No email')}</span>
    </div>
    <div class="user-detail-row">
      <span class="detail-label">Identifier:</span>
      <span class="detail-value">${escapeHtml(user.identifier || user.username || 'N/A')}</span>
    </div>
    <div class="user-detail-row">
      <span class="detail-label">Role:</span>
      <span class="detail-value">${escapeHtml(user.role || 'utility staff')}</span>
    </div>
    <div class="user-detail-row">
      <span class="detail-label">Created:</span>
      <span class="detail-value">${createdAt}</span>
    </div>
    <div class="user-detail-row">
      <span class="detail-label">User ID:</span>
      <span class="detail-value" style="font-family: monospace; font-size: 12px;">${escapeHtml(user.uid)}</span>
    </div>
    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
      <button 
        class="modal-btn modal-btn--danger" 
        onclick="confirmRemoveUser('${user.uid}', '${escapeHtml(fullName).replace(/'/g, "\\'")}')"
        style="width: 100%; padding: 12px; background-color: #d32f2f; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: background-color 0.2s;"
        onmouseover="this.style.backgroundColor='#b71c1c'"
        onmouseout="this.style.backgroundColor='#d32f2f'"
      >
        <i class="fas fa-trash-alt"></i> Remove User
      </button>
    </div>
  `;

  modal.style.display = "flex";
};

// Hide modal
function hideModal() {
  const modal = document.getElementById("userModal");
  if (modal) {
    modal.style.display = "none";
  }
}

// Confirm remove user
window.confirmRemoveUser = function(uid, userName) {
  if (!confirm(`Are you sure you want to permanently remove "${userName}"?\n\nThis will delete:\n- User account\n- User data from database\n- Username mapping\n\nThis action cannot be undone.`)) {
    return;
  }
  executeRemoveUser(uid);
};
