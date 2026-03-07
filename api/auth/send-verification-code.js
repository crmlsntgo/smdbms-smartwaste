import admin from "firebase-admin";
import nodemailer from "nodemailer";
import crypto from "crypto";

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) {
      // Remove surrounding quotes if present
      privateKey = privateKey.replace(/^"|"$/g, '');
      // Replace literal \n with actual newlines
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

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
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
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check that this email is not already registered
    try {
      await fb.auth().getUserByEmail(email);
      return res.status(400).json({ error: "This email is already registered. Please sign in instead." });
    } catch (err) {
      // Expected: user does not exist yet — proceed
      if (err.code !== "auth/user-not-found") {
        console.error("Firebase Auth error:", err);
        return res.status(500).json({ error: "Authentication service error: " + err.message });
      }
    }

    // Generate cryptographically random 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    await db.collection("email_verification_codes").doc(email).set({
      code,
      expiresAt,
      attempts: 0,
      createdAt: fb.firestore.FieldValue.serverTimestamp()
    });

    // Send email
    const transporter = getTransporter();
    const mailOptions = {
      from: `"SmartWaste" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Email Verification Code - SmartWaste',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #027a64; margin: 0;">SmartWaste</h1>
            <p style="color: #666;">Account Registration — Email Verification</p>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 10px; text-align: center;">
            <p style="margin: 0 0 20px 0; color: #333;">Your email verification code is:</p>
            <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #027a64; background: #fff; padding: 20px; border-radius: 8px; border: 2px dashed #027a64;">
              ${code}
            </div>
            <p style="margin: 20px 0 0 0; color: #666; font-size: 14px;">This code will expire in 10 minutes.</p>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 30px;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Verification code sent to your email" });
  } catch (err) {
    console.error("Send verification code error:", err);
    res.status(500).json({ error: "Failed to send verification code: " + err.message });
  }
}
