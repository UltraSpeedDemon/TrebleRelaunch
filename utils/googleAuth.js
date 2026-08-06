import {
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

import {
  auth,
  authReady,
} from "./firebase";

import {
  createUser,
  getUser,
  getUserByUsername,
} from "../providers/rest";

function cleanUsername(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/gi, "")
    .slice(0, 24);
}

async function readJsonResponse(response) {
  if (!response) {
    return null;
  }

  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function responseHasUser(data) {
  if (Array.isArray(data)) {
    return data.length > 0;
  }

  if (Array.isArray(data?.users)) {
    return data.users.length > 0;
  }

  if (Array.isArray(data?.results)) {
    return data.results.length > 0;
  }

  return Boolean(data?.user || data?.firebaseUid || data?.uid);
}

async function usernameExists(username) {
  const response =
    await getUserByUsername(username);

  if (!response?.ok) {
    return false;
  }

  const data =
    await readJsonResponse(response);

  return responseHasUser(data);
}

async function makeUniqueUsername(user) {
  const emailBase =
    String(user?.email || "")
      .split("@")[0];

  const base =
    cleanUsername(
      user?.displayName ||
      emailBase ||
      "trebleuser"
    ) || "trebleuser";

  if (!(await usernameExists(base))) {
    return base;
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const suffix =
      Math.floor(1000 + Math.random() * 9000);

    const candidate =
      `${base.slice(0, 19)}${suffix}`;

    if (!(await usernameExists(candidate))) {
      return candidate;
    }
  }

  return `treble${String(user.uid).slice(0, 8)}`;
}

export async function ensureTrebleGoogleUser(user) {
  if (!user?.uid) {
    throw new Error(
      "Google did not return a valid Firebase user."
    );
  }

  /* Existing Treble users do not need to be created again. */
  try {
    const existingResponse =
      await getUser(user.uid);

    if (existingResponse?.ok) {
      return await readJsonResponse(
        existingResponse
      );
    }
  } catch (error) {
    console.warn(
      "[Google Auth] Could not check existing Treble profile:",
      error
    );
  }

  const username =
    await makeUniqueUsername(user);

  const payload = {
    firebaseUid: user.uid,
    userId: user.uid,
    uid: user.uid,
    username,
    email: String(user.email || "")
      .trim()
      .toLowerCase(),
    avatar: user.photoURL || null,
    isPublic: true,
    spotifyAccessToken: "",
    spotifyIsLinked: false,
    spotifyRefreshToken: "",
    authProvider: "google",
    createdAt: new Date().toISOString(),
  };

  const response =
    await createUser(payload);

  if (!response?.ok) {
    const data =
      await readJsonResponse(response);

    throw new Error(
      data?.error ||
      data?.message ||
      "Treble could not create your Google profile."
    );
  }

  return await readJsonResponse(response);
}

export async function signInWithGoogle() {
  await authReady;

  const provider =
    new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  const credential =
    await signInWithPopup(
      auth,
      provider
    );

  await ensureTrebleGoogleUser(
    credential.user
  );

  return credential.user;
}
