import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import {
  getAuth,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

let app, auth, db;
let presenceHandle = null;
let authUnsubscribe = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const firebaseConfig = await loadEnvConfig();
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // keep header informed about current user (avatar/displayName)
    authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Get user role from Firestore
        let userRole = null;
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            userRole = userDoc.data().role;
          }
        } catch (err) {
          console.warn('Could not fetch user role:', err);
        }
        
        // Only initialize presence for admin users to avoid permission errors
        if (userRole === 'admin') {
          try {
            const presenceModule = await import('./utils/presence.js');
            presenceHandle = await presenceModule.initPresence(app, user, { useRealtime: true });
          } catch (e) {
            console.warn('Could not initialize presence module:', e);
          }
        }
        
        const u = {
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          email: user.email || '',
        };
        window.SBUser = u;
        window.dispatchEvent(new CustomEvent('sb:set-user', { detail: u }));
        // Populate page greeting (if present)
        try {
          const nameEl = document.querySelector('.user-name');
          if (nameEl) {
            const fallback = u.email ? u.email.split('@')[0] : '';
            nameEl.textContent = u.displayName || fallback;
          }
        } catch (err) {
          console.warn('Failed to set greeting name element:', err);
        }
      } else {
        window.SBUser = null;
        window.dispatchEvent(new CustomEvent('sb:set-user', { detail: {} }));
        // Clear greeting if user signed out
        try {
          const nameEl = document.querySelector('.user-name');
          if (nameEl) nameEl.textContent = '';
        } catch (err) {}
      }
    });

    async function performLogout() {
      try {
        // Tear down presence if we set one
        try {
          if (presenceHandle) {
            const presenceModule = await import('./utils/presence.js');
            await presenceModule.tearDownPresence(app, auth.currentUser, presenceHandle);
            presenceHandle = null;
          }
        } catch (e) { console.warn('Error tearing down presence:', e); }
        
        await signOut(auth);
        window.location.href = "auth/login.html";
      } catch (error) {
        console.error("Error logging out:", error);
        alert("Error logging out. Please try again.");
      }
    }

    // Expose page-level logout but prefer the centralized sign-out if present
    // Do NOT override a global handler provided by the header; keep local function
    // available as a fallback.
    try { window.performLocalLogout = performLogout; } catch (e) {}

    const logoutBtn = document.getElementById("logoutButton");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (typeof window.showLogoutModal === 'function') {
          window.showLogoutModal();
          return;
        }
        // fallback to local sign-out
        await performLogout();
      });
    }
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
  }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (authUnsubscribe) {
    authUnsubscribe();
  }
});
