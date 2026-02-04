function getBaseHtmlPath() {
  const pathname = window.location.pathname.replace(/\\/g, "/");
  const parts = pathname.split("/html/");
  if (parts.length > 1) {
    return parts[0] + "/html/";
  }
  const segments = pathname.split("/");
  const idx = segments.lastIndexOf("html");
  if (idx !== -1) {
    return segments.slice(0, idx + 1).join("/") + "/";
  }
  return "/";
}

function getBaseCssPath() {
  const pathname = window.location.pathname.replace(/\\/g, "/");
  const parts = pathname.split("/html/");
  if (parts.length > 1) {
    return parts[0] + "/css/";
  }
  const segments = pathname.split("/");
  const idx = segments.lastIndexOf("html");
  if (idx !== -1) {
    return segments.slice(0, idx).join("/") + "/css/";
  }
  return "/css/";
}

function isAdminContext() {
  const pathname = window.location.pathname.replace(/\\/g, "/");
  return pathname.indexOf("/admin/") !== -1;
}

// Generic confirmation/notification modal (reusable across pages)
function createSharedConfirmModal() {
  try {
    const modalCssPath = getBaseCssPath() + 'modal.css';
    if (!document.querySelector(`link[href="${modalCssPath}"]`)) {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = modalCssPath;
      document.head.appendChild(l);
    }
  } catch (e) {}

  let overlay = document.getElementById('sb-confirmation-modal-overlay');
  if (!overlay) {
    const tpl = document.createElement('div');
    tpl.innerHTML = `
      <div class="modal-overlay modal-overlay--toast" id="sb-confirmation-modal-overlay">
        <div class="modal-dialog modal-dialog--toast">
          <div class="modal-icon modal-icon--success">
            <i class="fas fa-check"></i>
          </div>
          <div style="flex:1;">
            <h2 class="modal-title" id="sb-confirmation-title">Success</h2>
            <p class="modal-subtitle" id="sb-confirmation-body">Operation completed.</p>
          </div>
          <button class="toast-close-btn" id="sb-confirmation-close" aria-label="Close">
            <i class="fas fa-xmark"></i>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(tpl.firstElementChild);
    overlay = document.getElementById('sb-confirmation-modal-overlay');
  }

  if (overlay.__sb_confirm_initialized) return;
  overlay.__sb_confirm_initialized = true;

  const closeBtn = overlay.querySelector('#sb-confirmation-close');
  let autoCloseTimer = null;

  function close() {
    overlay.classList.remove('active');
    if (autoCloseTimer) clearTimeout(autoCloseTimer);
  }

  if (closeBtn) closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  window.showConfirmModal = function(message, title) {
    try {
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
      const t = document.getElementById('sb-confirmation-title');
      const b = document.getElementById('sb-confirmation-body');
      if (t && title) t.textContent = title;
      if (b) b.textContent = message || '';
      overlay.classList.add('active');
      // Auto-close after 5 seconds (5000ms)
      autoCloseTimer = setTimeout(close, 5000);
    } catch (e) {
      try { alert(message); } catch (ee) {}
    }
  };
}

// ensure stub exists so pages can call before header loads
if (typeof window !== 'undefined' && !window.__sb_confirm_stub_installed) {
  window.__sb_confirm_stub_installed = true;
  window.showConfirmModal = function(msg, title) { window.__sb_requested_confirm = { msg, title }; };
}


// Lightweight stub so pages can call `showLogoutModal()` before header initializes.
if (typeof window !== 'undefined' && !window.__sb_logout_stub_installed) {
  window.__sb_logout_stub_installed = true;
  window.showLogoutModal = function () {
    try {
      window.__sb_requested_show_logout = true;
    } catch (e) {}
  };
}

async function loadGlobalHeader() {
  const container = document.querySelector("[data-app-header]");
  if (!container) return;

  const baseHtml = getBaseHtmlPath();
  const headerUrl = baseHtml + "components/header.html";

  try {
    const res = await fetch(headerUrl, { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to load header: " + res.status);
    const html = await res.text();
    container.innerHTML = html;
    
    initHeaderInteractions(container, baseHtml);
    try {
      createSharedConfirmModal();
      if (window.__sb_requested_confirm) {
        const rq = window.__sb_requested_confirm;
        try { window.showConfirmModal(rq.msg, rq.title); } catch (e) {}
        window.__sb_requested_confirm = null;
      }
    } catch (e) {}
  } catch (err) {
    console.error(err);
  }
}

function initHeaderInteractions(root, baseHtml) {
  let profileBtn = root.querySelector("#sb-profile-button");
  let dropdown = root.querySelector("#sb-profile-dropdown");

  // If header HTML didn't include a profile button, create a fallback
  if (!profileBtn) {
    const rightArea = root.querySelector(".sb-header__right");
    if (rightArea) {
      const wrapper = document.createElement("div");
      wrapper.className = "sb-profile-wrapper";

      wrapper.innerHTML = `
        <button type="button" id="sb-profile-button" class="sb-icon-button sb-profile-button" aria-haspopup="true" aria-expanded="false">
          <span class="sb-icon-button__inner sb-profile-avatar" aria-hidden="true">U</span>
        </button>
        <div class="sb-profile-menu" id="sb-profile-dropdown" hidden>
          <button type="button" class="sb-profile-menu__item" data-sb-menu-item="settings">Settings</button>
          
          <button type="button" class="sb-profile-menu__item sb-profile-menu__item--danger" data-sb-menu-item="logout">Logout</button>
        </div>
      `;

      // Insert after notification button if present, else append
      const notifBtn = rightArea.querySelector("#sb-notification-button");
      if (notifBtn && notifBtn.parentElement) {
        notifBtn.parentElement.insertBefore(wrapper, notifBtn.nextSibling);
      } else {
        rightArea.appendChild(wrapper);
      }

      profileBtn = root.querySelector("#sb-profile-button");
      dropdown = root.querySelector("#sb-profile-dropdown");
    }
  }

  if (profileBtn && dropdown) {
    const toggleDropdown = () => {
      const isHidden = dropdown.hasAttribute("hidden");
      if (isHidden) {
        dropdown.removeAttribute("hidden");
        profileBtn.setAttribute("aria-expanded", "true");
      } else {
        dropdown.setAttribute("hidden", "");
        profileBtn.setAttribute("aria-expanded", "false");
      }
    };

    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDropdown();
    });

    dropdown.addEventListener("click", (e) => {
      const item = e.target.closest("[data-sb-menu-item]");
      if (!item) return;
      const action = item.getAttribute("data-sb-menu-item");
      dropdown.setAttribute("hidden", "");
      profileBtn.setAttribute("aria-expanded", "false");
      handleProfileAction(action, baseHtml);
    });

    document.addEventListener("click", (e) => {
      if (!dropdown || dropdown.hasAttribute("hidden")) return;
      if (profileBtn.contains(e.target) || dropdown.contains(e.target)) {
        return;
      }
      dropdown.setAttribute("hidden", "");
      profileBtn.setAttribute("aria-expanded", "false");
    });
  }

  // Notification dropdown (simple implementation like profile dropdown)
  const notifBtn = root.querySelector("#sb-notification-button");
  const notifDropdown = root.querySelector("#sb-notification-dropdown");

  if (notifBtn && notifDropdown) {
    const toggleNotifications = () => {
      const isHidden = notifDropdown.hasAttribute("hidden");
      if (isHidden) {
        notifDropdown.removeAttribute("hidden");
        notifBtn.setAttribute("aria-expanded", "true");
      } else {
        notifDropdown.setAttribute("hidden", "");
        notifBtn.setAttribute("aria-expanded", "false");
      }
    };

    notifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleNotifications();
    });

    document.addEventListener("click", (e) => {
      if (!notifDropdown || notifDropdown.hasAttribute("hidden")) return;
      if (notifBtn.contains(e.target) || notifDropdown.contains(e.target)) {
        return;
      }
      notifDropdown.setAttribute("hidden", "");
      notifBtn.setAttribute("aria-expanded", "false");
    });
  }

  const searchInput = root.querySelector("#sb-global-search");
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const query = searchInput.value.trim();
        window.dispatchEvent(
          new CustomEvent("sb:global-search", { detail: { query } })
        );
      }
    });
  }
}

function handleProfileAction(action, baseHtml) {
  // Ensure shared logout modal + logic exist
  function createSharedLogoutModal() {
    // Ensure shared modal stylesheet is present (loads last so it wins)
    try {
      const modalCssPath = getBaseCssPath() + 'modal.css';
      if (!document.querySelector(`link[href="${modalCssPath}"]`)) {
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = modalCssPath;
        document.head.appendChild(l);
      }
    } catch (e) {}

    let overlay = document.getElementById('logout-modal-overlay');
    if (!overlay) {
      const tpl = document.createElement('div');
      tpl.innerHTML = `
        <div class="modal-overlay" id="logout-modal-overlay">
          <div class="modal-dialog">
            <div class="modal-icon modal-icon--logout">
              <i class="fas fa-arrow-right-from-bracket"></i>
            </div>
            <h2 class="modal-title">Are you sure you want to logout?</h2>
            <p class="modal-subtitle">We wont bother you anymore.</p>
            <div class="modal-actions">
              <button class="modal-btn modal-btn--confirm" id="modal-logout-confirm">Confirm</button>
              <button class="modal-btn modal-btn--cancel" id="modal-logout-cancel">Cancel</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(tpl.firstElementChild);
      overlay = document.getElementById('logout-modal-overlay');
    }

    // Prevent double-initialization
    if (overlay.__sb_logout_modal_initialized) return;
    overlay.__sb_logout_modal_initialized = true;

    const confirmBtn = overlay.querySelector('#modal-logout-confirm');
    const cancelBtn = overlay.querySelector('#modal-logout-cancel');

    function closeLogoutModal() {
      overlay.classList.remove('active');
    }

    function confirmLogout() {
      closeLogoutModal();
      if (typeof window.performGlobalSignOut === 'function') {
        window.performGlobalSignOut();
      }
    }

    if (confirmBtn) confirmBtn.addEventListener('click', confirmLogout);
    if (cancelBtn) cancelBtn.addEventListener('click', closeLogoutModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeLogoutModal();
    });

    window.showLogoutModal = function () {
      overlay.classList.add('active');
    };
    // If a page requested the modal before initialization, show it now
    if (window.__sb_requested_show_logout) {
      try {
        overlay.classList.add('active');
      } catch (e) {}
      window.__sb_requested_show_logout = false;
    }
  }

  // Central sign-out function used by the modal and other pages
  async function performGlobalSignOut() {
    try {
      if (window.__sb_signout_in_progress) return;
      window.__sb_signout_in_progress = true;

      try {
        const env = typeof loadEnvConfig === "function" ? await loadEnvConfig() : null;
        const [{ initializeApp }, { getAuth, signOut }] = await Promise.all([
          import("https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js"),
          import("https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js"),
        ]);

        let app;
        try {
          if (env) app = initializeApp(env);
        } catch (e) {}

        try {
          const auth = getAuth(app);
          await signOut(auth);
        } catch (e) {
          try {
            const { getAuth: _getAuth, signOut: _signOut } = await import(
              "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js"
            );
            const auth = _getAuth();
            await _signOut(auth);
          } catch (ee) {
            console.warn("Firebase signOut failed:", ee);
          }
        }
      } catch (err) {
        console.warn("Firebase signOut attempt skipped/failed:", err);
      }

      try { window.SBUser = null; } catch (e) {}
      try {
        for (let i = 0; i < localStorage.length; ) {
          const key = localStorage.key(i);
          if (!key) { i++; continue; }
          if (key.indexOf("firebase:") === 0 || key.indexOf("__sb_") === 0) {
            localStorage.removeItem(key);
            continue;
          }
          i++;
        }
        sessionStorage.clear();
      } catch (e) { console.warn(e); }

      try { if (window.indexedDB && indexedDB.deleteDatabase) indexedDB.deleteDatabase("firebaseLocalStorageDb"); } catch (e) {}

      // ensure global reference
      try { window.handleGlobalLogout = performGlobalSignOut; } catch (e) {}

      const loginUrl = baseHtml ? baseHtml + "auth/login.html" : "/html/auth/login.html";
      window.location.href = loginUrl;
    } finally {
      window.__sb_signout_in_progress = false;
    }
  }

  // expose for other scripts if needed
  try { window.performGlobalSignOut = performGlobalSignOut; } catch (e) {}

  switch (action) {
    case "profile":
      window.dispatchEvent(
        new CustomEvent("sb:open-profile", { detail: {} })
      );
      break;
    case "settings":
      // Navigate to settings page, preserving admin context if applicable
      if (isAdminContext()) {
        // If in admin context, navigate to admin settings page
        window.location.href = "settings.html";
      } else if (baseHtml) {
        window.location.href = baseHtml + "settings.html";
      } else {
        window.location.href = "/html/settings.html";
      }
      break;
    case "about":
      window.dispatchEvent(
        new CustomEvent("sb:open-about", { detail: {} })
      );
      break;
    case "logout":
      // Ensure modal exists and show it
      createSharedLogoutModal();
      if (typeof window.showLogoutModal === 'function') {
        window.showLogoutModal();
      }
      break;
    default:
      break;
  }
}

document.addEventListener("DOMContentLoaded", loadGlobalHeader);

