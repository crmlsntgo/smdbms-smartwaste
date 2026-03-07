import admin from "firebase-admin";

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) {
      privateKey = privateKey.replace(/^"|"$/g, '');
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
  return admin;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const fb = getFirebaseAdmin();
    const db = fb.firestore();
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "Email, code, and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const docRef = db.collection("password_reset_codes").doc(email);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(400).json({ error: "No reset code found. Please request a new one." });
    }

    const data = docSnap.data();

    // Verify the code is valid and verified
    if (data.code !== code || !data.verified) {
      return res.status(400).json({ error: "Invalid or unverified code." });
    }

    // Check expiry
    if (Date.now() > data.expiresAt) {
      await docRef.delete();
      return res.status(400).json({ error: "Code has expired. Please request a new one." });
    }

    // Update password in Firebase Auth
    const userRecord = await fb.auth().getUserByEmail(email);
    await fb.auth().updateUser(userRecord.uid, { password: newPassword });

    // Delete the reset code
    await docRef.delete();

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password: " + err.message });
  }
}
