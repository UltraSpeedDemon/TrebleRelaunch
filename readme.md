# Treble Relaunch

Treble is a music review and social networking application built with Expo and React Native. Users can explore music, create reviews, follow other users, comment, like content, and receive recommendations.

This relaunch repository contains both:

- the Expo mobile/web frontend;
- a Node.js/Express backend in `backend/`.

## Repository

```text
https://github.com/UltraSpeedDemon/TrebleRelaunch.git
```

## Requirements

Install these before starting:

- Node.js
- npm
- Expo Go on your phone
- an ngrok account
- access to the TrebleRelaunch Firebase project

## Clone and install

```powershell
cd C:\Users\ethan\Desktop\GitHub
git clone https://github.com/UltraSpeedDemon/TrebleRelaunch.git
cd TrebleRelaunch
```

Install the frontend dependencies:

```powershell
$env:npm_config_legacy_peer_deps="true"
npm install
Remove-Item Env:\npm_config_legacy_peer_deps
```

Install the backend dependencies:

```powershell
cd backend
npm install
cd ..
```

## Firebase setup

The mobile app uses Firebase Authentication. The backend uses Firebase Admin and Firestore.

### Root `.env`

Create `.env` in the repository root beside the main `package.json`:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=treblerelaunch.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=treblerelaunch
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=treblerelaunch.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id

EXPO_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id
EXPO_PUBLIC_SPOTIFY_REDIRECT_URI=your_redirect_uri
EXPO_PUBLIC_SPOTIFY_SCOPE="user-read-private user-read-email user-read-playback-state user-modify-playback-state"

EXPO_PUBLIC_API_TUNNEL_URL=https://your-ngrok-domain.ngrok-free.app
EXPO_PUBLIC_API_URL=
```

Do not place a Spotify client secret in an `EXPO_PUBLIC_` variable. Public Expo environment variables are included in the client application.

### Backend `.env`

Create `backend/.env`:

```env
PORT=5000
```

### Firebase service account

Download a new Firebase Admin service-account key and save it as:

```text
backend/firebase-service-account.json
```

Never commit this file. It must remain ignored by Git.

The backend `.gitignore` should include:

```gitignore
node_modules/
.env
firebase-service-account.json
```

## ngrok setup

Authenticate the ngrok agent once:

```powershell
npx ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
```

Do not commit or share the authtoken.

The project startup script opens ngrok automatically. The free ngrok plan may generate a different URL each time. When it changes, update:

```env
EXPO_PUBLIC_API_TUNNEL_URL=https://new-address.ngrok-free.app
```

Then restart Expo so it reloads the environment variable.

## Start everything

Run this command from the repository root:

```powershell
npm start
```

The startup script launches:

1. the backend on `http://localhost:5000`;
2. an ngrok tunnel to port `5000`;
3. Expo in tunnel mode with a QR code.

Three windows will appear:

```text
Backend  -> Node/Express API
ngrok    -> Public HTTPS tunnel
Expo     -> Metro bundler and QR code
```

Scan the Expo QR code using Expo Go.

To stop everything, close the spawned backend and ngrok windows and press `Ctrl + C` in the Expo terminal.

## Test the backend

Local test:

```powershell
Invoke-RestMethod http://localhost:5000/test
```

Expected response:

```text
ok      : True
message : Treble backend is running
```

Public ngrok test:

```powershell
Invoke-RestMethod `
  -Uri "https://your-ngrok-domain.ngrok-free.app/test" `
  -Headers @{ "ngrok-skip-browser-warning" = "true" }
```

## Useful commands

Start everything:

```powershell
npm start
```

Start only Expo:

```powershell
npx expo start --tunnel --clear
```

Start only the backend:

```powershell
npm --prefix backend run dev
```

Start only ngrok:

```powershell
npx ngrok http 5000
```

Run Expo Doctor:

```powershell
npx expo-doctor
```

Clear the Expo cache:

```powershell
npx expo start --clear
```

## Project structure

```text
TrebleRelaunch/
├── backend/                 Node.js and Express API
│   ├── server.js
│   ├── package.json
│   ├── .env
│   └── firebase-service-account.json
├── assets/                  Expo assets and fonts
├── components/              Shared React Native components
├── hooks/                   Shared hooks
├── images/                  Application images
├── providers/               REST API client
├── screens/                 Application screens
├── styles/                  Shared styling
├── utils/                   Firebase, sessions, Spotify utilities
├── App.js                   Main application component
├── app.json                 Expo configuration
├── package.json             Frontend scripts and dependencies
├── start-all.ps1            Starts backend, ngrok, and Expo
└── README.md
```

## Current technology

- Expo SDK 54
- React 19
- React Native 0.81
- Firebase Authentication
- Firebase Admin
- Firestore
- Node.js
- Express
- ngrok

## Known migration notes

The application was originally connected to an OrientDB-based API. The relaunch backend is being rebuilt with Firebase Admin and Firestore. Some old frontend error messages and API assumptions may still reference OrientDB and must be updated as endpoints are migrated.

`expo-av` is deprecated and should eventually be replaced with `expo-audio` and `expo-video`.

Some older React Native packages may require replacement before a future Expo SDK upgrade.

## Git workflow

Create a branch:

```powershell
git checkout -b feature/your-feature-name
```

Save and push changes:

```powershell
git add .
git commit -m "feat: describe the change"
git push -u origin feature/your-feature-name
```

The private relaunch repository is configured as `origin`. The original TeamBass repository may remain configured as `upstream`.

Check remotes:

```powershell
git remote -v
```

## Security

Never commit:

- `.env` files;
- Firebase Admin service-account JSON files;
- ngrok authtokens;
- Spotify client secrets;
- production database credentials.

If a service-account private key is exposed, delete that key immediately in Google Cloud IAM and generate a new one.
