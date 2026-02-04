/**
 * Client-side utility to manually clean up expired deleted bins
 * This is for testing purposes when Cloud Functions are not set up
 * 
 * Usage: Call cleanupExpiredDeletedBins() from browser console or add a button to trigger it
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.2/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  Timestamp 
} from "https://www.gstatic.com/firebasejs/10.5.2/firebase-firestore.js";

let db = null;

async function initCleanup() {
  if (!db) {
    const firebaseConfig = await loadEnvConfig();
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
}

/**
 * Clean up expired deleted bins
 * This function should be called periodically (e.g., when admin visits the archive page)
 */
export async function cleanupExpiredDeletedBins() {
  await initCleanup();
  
  try {
    const now = Timestamp.now();
    const deletedCol = collection(db, "deleted");
    
    // Query for bins where autoDeleteAfter <= now
    const expiredQuery = query(deletedCol, where("autoDeleteAfter", "<=", now));
    const expiredSnapshot = await getDocs(expiredQuery);
    
    if (expiredSnapshot.empty) {
      console.log('No expired bins to delete');
      return { deleted: 0 };
    }
    
    let deleteCount = 0;
    const deletePromises = [];
    
    expiredSnapshot.forEach((docSnap) => {
      console.log(`Deleting expired bin: ${docSnap.id}`);
      deletePromises.push(deleteDoc(doc(db, "deleted", docSnap.id)));
      deleteCount++;
    });
    
    await Promise.all(deletePromises);
    console.log(`Successfully deleted ${deleteCount} expired bin(s)`);
    
    return { deleted: deleteCount };
  } catch (error) {
    console.error('Error cleaning up expired bins:', error);
    throw error;
  }
}

/**
 * Auto-run cleanup when module is loaded (useful for testing)
 * Comment out if you want manual control
 */
// NOTE: Auto-run on page load removed to avoid unexpected reads/deletes.
// To run cleanup manually, call `cleanupExpiredDeletedBins()` from the console
// or wire it to an explicit admin action/button.
