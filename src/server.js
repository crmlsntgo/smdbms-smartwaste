import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cors());
app.use(express.json());

/* ================================
   FIREBASE INIT
================================ */
const serviceAccountPath = "./config/serviceAccountKey.json";

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ Service account key not found");
  process.exit(1);
}

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

/* ================================
   HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  res.send("Smart Waste Backend running 🚀");
});

/* ================================
   ESP32 TEST ENDPOINT
================================ */
app.post("/api/test-esp32", (req, res) => {
  console.log("📡 ESP32 HIT SERVER");
  console.log("📦 BODY:", req.body);

  res.json({
    success: true,
    message: "ESP32 connected successfully",
    received: req.body,
  });
});

/* ================================
   REGISTER BIN
================================ */
app.post("/api/v1/bins/register", async (req, res) => {
  try {
    const { bin_id, location, name } = req.body;

    if (!bin_id) {
      return res.status(400).json({ error: "bin_id is required" });
    }

    await db.collection("bins").doc(bin_id).set({
      bin_id,
      serial: bin_id,
      name: name || `Bin ${bin_id.replace("BIN", "")}`,
      location: location || "Unknown",
      status: "Available",
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ message: "Bin registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to register bin" });
  }
});

/* ================================
   SEND SENSOR DATA → BINS & HAZARDOUS
================================ */
app.post("/api/v1/bins/:bin_id", async (req, res) => {
  try {
    const { bin_id } = req.params;

    const {
      distance_cm,
      battery,
      connectivity,
      waste_composition,
      general_waste,

      // 🚫 Hazardous-only (NEVER stored in bins)
      hazardous_detected,
      gas_detected,
      type,
      detected_at
    } = req.body;

    // Calculate aggregated fill level from 4 waste types
    const wc = waste_composition || {};
    const vRec = Number(wc.recyclable) || 0;
    const vBio = Number(wc.biodegradable) || 0;
    const vNon = Number(wc.non_biodegradable || wc.nonBio) || 0;
    const vGen = Number(general_waste) || 0;
    const fill_level = Math.round((vRec + vBio + vNon + vGen) / 4);

    const now = admin.firestore.Timestamp.now();
    const monthKey = new Date().toISOString().slice(0, 7);

    /* ===============================
       1. GET BIN NAME
    ================================ */
    const binDoc = await db.collection("bins").doc(bin_id).get();
    const binName = binDoc.exists
      ? binDoc.data().name || `Bin ${bin_id.replace("BIN", "")}`
      : `Bin ${bin_id.replace("BIN", "")}`;

    /* ===============================
       2. UPDATE BIN SNAPSHOT
       🔥 FORCE DELETE HAZARDOUS FIELDS
    ================================ */
    await db.collection("bins").doc(bin_id).set(
      {
        bin_id,
        serial: bin_id,
        distance_cm,
        battery,
        connectivity,
        waste_composition,
        general_waste,
        updated_at: now,

        // ❌ REMOVE FOREVER FROM BINS
        hazardous_detected: admin.firestore.FieldValue.delete(),
        gas_detected: admin.firestore.FieldValue.delete(),
        type: admin.firestore.FieldValue.delete(),
        detected_at: admin.firestore.FieldValue.delete()
      },
      { merge: true }
    );

    /* ===============================
       3. SAVE HAZARDOUS EVENT (EVENT LOG)
    ================================ */
    if (hazardous_detected === true) {
      await db.collection("hazardous_detections").add({
        bin_id,
        bin_name: binName,
        type: type || "Unknown",
        gas_detected: !!gas_detected,
        hazardous_detected: true,
        detected_at: detected_at
          ? admin.firestore.Timestamp.fromDate(new Date(detected_at))
          : now,
        created_at: now
      });

      console.log(`✅ Hazardous event logged → ${binName}`);
    }

    /* ===============================
       4. MONTHLY HISTORY
    ================================ */
    if (waste_composition) {
      await db
        .collection("bins")
        .doc(bin_id)
        .collection("history")
        .doc(monthKey)
        .set(
          {
            recyclable: waste_composition.recyclable || 0,
            biodegradable: waste_composition.biodegradable || 0,
            non_biodegradable: waste_composition.non_biodegradable || 0,
            general_waste: general_waste || 0,
            timestamp: now
          },
          { merge: true }
        );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("🔥 Dashboard error:", err);
    res.status(500).json({ error: "Failed to update dashboard" });
  }
});


/* ================================
   GET ALL BINS
================================ */
app.get("/api/v1/bins", async (req, res) => {
  try {
    const snapshot = await db.collection("bins").get();
    const data = snapshot.docs.map(doc => doc.data());
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

/* ================================
   GET SINGLE BIN
================================ */
app.get("/api/v1/bins/:bin_id", async (req, res) => {
  try {
    const docSnap = await db
      .collection("bins")
      .doc(req.params.bin_id)
      .get();

    if (!docSnap.exists) {
      return res.status(404).json({ error: "Bin not found" });
    }

    res.json(docSnap.data());
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch bin dashboard" });
  }
});

/* ================================
   GET ALL HAZARDOUS DETECTIONS
================================ */
app.get("/api/v1/hazardous", async (req, res) => {
  try {
    const snapshot = await db
      .collection("hazardous_detections")
      .orderBy("created_at", "desc")
      .limit(50)
      .get();
    
    const detections = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json(detections);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch hazardous detections" });
  }
});

/* ================================
   SERVER START
================================ */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
