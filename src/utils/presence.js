import initFirebase from '../firebaseConfig'
import { getDatabase, ref, set, onDisconnect, remove } from 'firebase/database'

export async function initPresence(app, user, options = {}) {
  const { useRealtime = true, rtdbPath = 'presence', httpEndpoint = null } = options;

  if (!user || !user.uid) return null;

  const theApp = app || initFirebase();

  if (useRealtime) {
    try {
      const rdb = getDatabase(theApp);
      const node = `${rtdbPath}/${user.uid}`;
      const presenceRef = ref(rdb, node);

      const payload = {
        state: 'online',
        uid: user.uid,
        displayName: user.displayName || user.email || null,
        lastSeen: Date.now()
      };

      await set(presenceRef, payload);

      try {
        await onDisconnect(presenceRef).remove();
      } catch (e) {
        try { onDisconnect(presenceRef).remove(); } catch (_) {}
      }

      return {
        type: 'realtime',
        path: node
      };
    } catch (e) {
      console.warn('initPresence: Realtime DB init failed:', e);
    }
  }

  if (httpEndpoint) {
    try {
      await fetch(httpEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, displayName: user.displayName || user.email || null, state: 'online', ts: Date.now() })
      });
      return { type: 'http', endpoint: httpEndpoint };
    } catch (e) {
      console.warn('initPresence: HTTP presence failed:', e);
    }
  }

  return null;
}

export async function tearDownPresence(app, user, handle) {
  if (!handle) return;
  const theApp = app || initFirebase();

  if (handle.type === 'realtime') {
    try {
      const rdb = getDatabase(theApp);
      const presenceRef = ref(rdb, handle.path);
      await remove(presenceRef);
    } catch (e) {
      console.warn('tearDownPresence failed:', e);
    }
  } else if (handle.type === 'http' && handle.endpoint) {
    try {
      await fetch(handle.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid, state: 'offline', ts: Date.now() })
      });
    } catch (e) {
      console.warn('tearDownPresence http failed:', e);
    }
  }
}
