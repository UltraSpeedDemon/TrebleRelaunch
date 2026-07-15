const express = require("express");
const cors = require("cors");
require("dotenv").config();

const {
  initializeApp,
  cert,
  getApps,
} = require("firebase-admin/app");

const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

const serviceAccount = require("./firebase-service-account.json");

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json());

// Initialize Firebase Admin only once.
if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

app.get("/test", (req, res) => {
  res.json({
    ok: true,
    message: "Treble backend is running",
  });
});

app.post("/users", async (req, res) => {
  try {
    const userData = req.body;
    const uid = userData.uid || userData.user_id || userData.id;

    if (!uid) {
      return res.status(400).json({
        ok: false,
        error: "Firebase UID is required.",
      });
    }

    await db.collection("users").doc(uid).set(
      {
        ...userData,
        uid,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(201).json({
      ok: true,
      uid,
    });
  } catch (error) {
    console.error("POST /users error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/users/:uid", async (req, res) => {
  try {
    const snapshot = await db
      .collection("users")
      .doc(req.params.uid)
      .get();

    if (!snapshot.exists) {
      return res.status(404).json({
        ok: false,
        error: "User not found.",
      });
    }

    return res.json({
      uid: snapshot.id,
      ...snapshot.data(),
    });
  } catch (error) {
    console.error("GET /users/:uid error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get("/users/:uid/followRequests", (req, res) => {
  res.json([]);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Treble backend running at http://localhost:${port}`);
});