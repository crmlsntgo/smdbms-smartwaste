import admin from "firebase-admin";
import nodemailer from "nodemailer";

// Initialize Firebase Admin (singleton pattern for serverless)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check if user exists in Firebase Auth
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
    } catch (err) {
      return res.status(400).json({ error: "No account found with this email" });
    }

    // Generate 5-digit code
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const expiresAt = Date.now() + 1 * 60 * 1000; // 1 minute expiry

    // Store code in Firestore
    await db.collection("password_reset_codes").doc(email).set({
      code,
      expiresAt,
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Send email
    const mailOptions = {
      from: `"SmartWaste" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Code - SmartWaste',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #027a64; margin: 0;">SmartWaste</h1>
            <p style="color: #666;">Password Reset Request</p>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 10px; text-align: center;">
            <p style="margin: 0 0 20px 0; color: #333;">Your password reset code is:</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #027a64; background: #fff; padding: 20px; border-radius: 8px; border: 2px dashed #027a64;">
              ${code}
            </div>
            <p style="margin: 20px 0 0 0; color: #666; font-size: 14px;">This code will expire in 1 minute.</p>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Reset code sent to your email" });
  } catch (err) {
    console.error("Send reset code error:", err);
    res.status(500).json({ error: "Failed to send reset code" });
  }
}
