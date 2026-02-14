import { collection, doc, setDoc, getDocs, query, where, serverTimestamp, orderBy, limit } from 'firebase/firestore';

/**
 * Fill-level thresholds and their messages.
 * Checked in descending order so only the highest applicable alert fires per bin.
 */
const THRESHOLDS = [
  { min: 90, key: 'full',        message: bin => `${bin.name}: The bin is full. Immediate emptying required.`, icon: '🔴' },
  { min: 80, key: 'needs_empty', message: bin => `${bin.name}: The bin needs emptying.`, icon: '🟠' },
  { min: 70, key: 'almost_full', message: bin => `${bin.name}: The bin is almost full.`, icon: '⚠' },
];

/**
 * Check all bins' fill levels and write notifications to the 'notifications' collection.
 * Uses a dedup key (binId + threshold key) to avoid creating duplicate notifications
 * for the same bin at the same threshold level.
 *
 * @param {Firestore} db - Firestore instance
 * @param {Array} bins - Array of normalized bin objects
 */
export async function checkFillLevelNotifications(db, bins) {
  if (!db || !bins || bins.length === 0) return;

  try {
    // Fetch recent notifications to avoid duplicates (last 50 should cover all bins)
    const notifCol = collection(db, 'notifications');
    const recentSnap = await getDocs(query(notifCol, orderBy('createdAt', 'desc'), limit(50)));
    
    const existingKeys = new Set();
    recentSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.dedupKey && !data.dismissed) {
        existingKeys.add(data.dedupKey);
      }
    });

    const newNotifications = [];

    for (const bin of bins) {
      const fillLevel = bin.fill_level || 0;

      // Find the highest matching threshold
      for (const threshold of THRESHOLDS) {
        if (fillLevel >= threshold.min) {
          const dedupKey = `${bin.id}_${threshold.key}`;
          
          if (!existingKeys.has(dedupKey)) {
            newNotifications.push({
              binId: bin.id,
              binName: bin.name || bin.id,
              fillLevel,
              thresholdKey: threshold.key,
              dedupKey,
              message: threshold.message(bin),
              icon: threshold.icon,
              type: 'fill_level',
              dismissed: false,
              createdAt: serverTimestamp()
            });
          }
          break; // Only the highest threshold per bin
        }
      }
    }

    // Write new notifications (batch)
    for (const notif of newNotifications) {
      const notifRef = doc(notifCol, notif.dedupKey);
      await setDoc(notifRef, notif);
    }
  } catch (error) {
    // Silently fail — notifications are non-critical
    console.warn('Fill level notification check failed:', error.message);
  }
}

/**
 * Fetch all active (non-dismissed) notifications, sorted newest first.
 * @param {Firestore} db - Firestore instance
 * @returns {Promise<Array>} notifications
 */
export async function fetchNotifications(db) {
  if (!db) return [];

  try {
    const notifCol = collection(db, 'notifications');
    const snap = await getDocs(query(notifCol, orderBy('createdAt', 'desc'), limit(20)));
    
    const notifications = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.dismissed) {
        let timeAgo = 'Just now';
        if (data.createdAt) {
          const ts = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt.seconds * 1000);
          const diff = Date.now() - ts.getTime();
          const mins = Math.floor(diff / 60000);
          if (mins < 1) timeAgo = 'Just now';
          else if (mins < 60) timeAgo = `${mins} min ago`;
          else if (mins < 1440) timeAgo = `${Math.floor(mins / 60)} hours ago`;
          else timeAgo = `${Math.floor(mins / 1440)} days ago`;
        }

        notifications.push({
          id: docSnap.id,
          ...data,
          timeAgo
        });
      }
    });

    return notifications;
  } catch (error) {
    console.warn('Failed to fetch notifications:', error.message);
    return [];
  }
}
