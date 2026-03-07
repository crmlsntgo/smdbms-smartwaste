import admin from "firebase-admin";

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

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
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "Email and code are required" });
    }

    const docRef = db.collection("password_reset_codes").doc(email);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(400).json({ error: "No reset code found. Please request a new one." });
    }

    const data = docSnap.data();

    // Check expiry
    if (Date.now() > data.expiresAt) {
      await docRef.delete();
      return res.status(400).json({ error: "Code has expired. Please request a new one." });
    }

    // Check attempts (max 5)
    if (data.attempts >= 5) {
      await docRef.delete();
      return res.status(400).json({ error: "Too many attempts. Please request a new code." });
    }

    // Verify code
    if (data.code !== code) {
      await docRef.update({ attempts: fb.firestore.FieldValue.increment(1) });
      return res.status(400).json({ error: "Invalid code. Please try again." });
    }

    // Code is valid - mark as verified
    await docRef.update({ verified: true });

    res.json({ success: true, message: "Code verified successfully" });
  } catch (err) {
    console.error("Verify code error:", err);
    res.status(500).json({ error: "Failed to verify code: " + err.message });
  }
}
