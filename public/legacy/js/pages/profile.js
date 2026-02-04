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

// Helper to safely set element text content
function safeSetText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const firebaseConfig = await loadEnvConfig();
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Use one-time fetch instead of real-time snapshot to reduce reads
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          const userData = (userDoc && userDoc.exists()) ? userDoc.data() : {};

          // Populate profile card
          const fullName = userData.displayName || `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || user.displayName || 'User';
          safeSetText('profile-name', fullName);
          safeSetText('profile-email', user.email || '—');
          safeSetText('profile-role', userData.role || 'User');
          safeSetText('profile-identifier', userData.username || user.email?.split('@')[0] || '—');

          // Set avatar (use photo URL or initials)
          const avatarImg = document.getElementById('avatar-img');
          const avatarWrapper = document.getElementById('profile-avatar');
          if (avatarImg && avatarWrapper) {
            // remove any existing initials node
            const existingInitials = avatarWrapper.querySelector('.initials');
            if (user.photoURL) {
              if (existingInitials) existingInitials.remove();
              avatarImg.src = user.photoURL;
              avatarImg.style.display = 'block';
            } else {
              avatarImg.style.display = 'none';
              const initials = ((userData.firstName || user.displayName || '').split(' ').map(n => n[0]).join('') || (user.email || 'U')[0]).toUpperCase().slice(0,2);
              let span = existingInitials;
              if (!span) {
                span = document.createElement('span');
                span.className = 'initials';
                avatarWrapper.appendChild(span);
              }
              span.textContent = initials;
            }
          }

          // Populate personal information
          safeSetText('info-first-name', userData.firstName || '—');
          safeSetText('info-last-name', userData.lastName || '—');
          safeSetText('info-username', userData.username || user.email?.split('@')[0] || '—');
          safeSetText('info-email', user.email || '—');
          safeSetText('info-phone', userData.phone || '—');
          safeSetText('info-role', userData.role || 'User');

          // Populate address
          safeSetText('info-address', userData.address || '—');
          safeSetText('info-city', userData.city || '—');
          
          // If you need real-time updates in future, consider re-enabling onSnapshot only for that component
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
      } else {
        // user signed out — clear displayed fields
        safeSetText('profile-name', '—');
        safeSetText('profile-email', '—');
        safeSetText('profile-role', '—');
        safeSetText('profile-identifier', '—');
        safeSetText('info-first-name', '—');
        safeSetText('info-last-name', '—');
        safeSetText('info-username', '—');
        safeSetText('info-email', '—');
        safeSetText('info-phone', '—');
        safeSetText('info-role', '—');
        safeSetText('info-address', '—');
        safeSetText('info-city', '—');
        const avatarImg = document.getElementById('avatar-img');
        if (avatarImg) avatarImg.style.display = 'none';
        const avatarWrapper = document.getElementById('profile-avatar');
        if (avatarWrapper) {
          const existingInitials = avatarWrapper.querySelector('.initials');
          if (existingInitials) existingInitials.remove();
        }
      }
    });
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
