import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export const notifyBinChange = async (db, action, binIds) => {
    try {
        const ids = Array.isArray(binIds) ? binIds : [binIds];
        // We accept ids as strings
        const safeIds = ids.map(id => String(id));
        
        await setDoc(doc(db, 'settings', 'binMetadata'), {
            lastAction: action, // 'delete', 'archive', 'restore', 'create', 'update'
            targetIds: safeIds,
            timestamp: serverTimestamp(),
            // Random nonce ensures 'onSnapshot' triggers even if the same action happens twice in a row
            nonce: Math.random().toString(36).substring(7) 
        });
    } catch (e) {
        console.error("Failed to sync bin state:", e);
    }
};
