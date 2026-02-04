import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

let app, auth, db;
let authUnsubscribe = null;

async function initAdminDashboard() {
  try {
    const firebaseConfig = await loadEnvConfig();
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await loadUserProfile(user);
        setupSidebar();
      }
    });
  } catch (error) {
    console.error("Failed to initialize admin dashboard:", error);
    alert("Error loading application. Please try again later.");
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (authUnsubscribe) {
    authUnsubscribe();
  }
});

async function loadUserProfile(user) {
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const firstName = userData.firstName || 'Admin';
      
      const userNameElement = document.querySelector(".user-name");
      if (userNameElement) {
        userNameElement.textContent = firstName;
      }
    }
  } catch (error) {
    console.error("Error loading user profile:", error);
  }
}

function setupSidebar() {
  const links = document.querySelectorAll('.sidebar-nav .nav-item');
  const path = window.location.pathname.replace(/\\/g, '/');
  const file = path.split('/').pop() || 'dashboard.html';
  const current = file.toLowerCase();

  links.forEach(link => {
    const page = (link.getAttribute('data-page') || '').toLowerCase();
    link.classList.remove('active');
    if (page) {
      if (current.indexOf(page) !== -1 || (page === 'dashboard' && current === '')) {
        link.classList.add('active');
      }
    }
  });
}

initAdminDashboard();
