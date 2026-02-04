// Small presence helper: uses Firebase Realtime Database when available
// or falls back to POSTing to an HTTP endpoint (e.g., a tiny Redis-backed API).

export async function initPresence(app, user, options = {}) {
  // options: { useRealtime: true, rtdbPath: 'presence', httpEndpoint: null }
  const { useRealtime = true, rtdbPath = 'presence', httpEndpoint = null } = options;

  if (!user || !user.uid) return null;

  if (useRealtime) {
    try {
      const dbModule = await import('https://www.gstatic.com/firebasejs/10.5.2/firebase-database.js');
      const { getDatabase, ref, set, onDisconnect } = dbModule;
      const rdb = getDatabase(app);
      const node = `${rtdbPath}/${user.uid}`;
      const presenceRef = ref(rdb, node);

      const payload = {
        state: 'online',
        uid: user.uid,
        displayName: user.displayName || user.email || null,
        lastSeen: Date.now()
      };

      await set(presenceRef, payload);

      // Ensure presence is removed when client disconnects
      try {
        await onDisconnect(presenceRef).remove();
      } catch (e) {
        // Some SDKs return an onDisconnect object rather than a Promise
        try { onDisconnect(presenceRef).remove(); } catch (_) {}
      }

      return {
        type: 'realtime',
        path: node
      };
    } catch (e) {
      console.warn('initPresence: Realtime DB init failed:', e);
      // fallthrough to HTTP if provided
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
  if (handle.type === 'realtime') {
    try {
      const dbModule = await import('https://www.gstatic.com/firebasejs/10.5.2/firebase-database.js');
      const { getDatabase, ref, remove } = dbModule;
      const rdb = getDatabase(app);
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
