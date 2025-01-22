# Treble

### Getting started
1. Clone the repository
``` git clone https://github.com/TeamBass/Treble.git ```
1. Install the dependencies
``` npm install ```
1. set up '.env' file in the root directory with the following variables
```
FIREBASE_API_KEY=your_api_key
FIREBASE_AUTH_DOMAIN=your_auth_domain
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_storage_bucket
FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
FIREBASE_APP_ID=your_app_id

SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=your_redirect_uri
```
The 'SPOTIFY_REDIRECT_URI' should be set to 'exp://localhost:19000/--/' for development or it can also be found underneath the QR code when running the project using Expo Go app on your phone using Tunnel mode which we recommend for testing on a physical device.
Note: '/--/' is required at the end of the redirect uri for the Spotify API to work correctly.

1. Run the project
``` npm start ```
 If you have troubles run this instead
 ```npm start -- --reset-cache --clear```
1. Open project using Expo Go app on your phone or emulator. This can be done by scanning the QR code generated in the terminal or by entering the URL underneath the QR code into the browser on your phone.


### Project structure
- `assets/` - Contains images and other assets used in the project
- `components/` - Contains all the components used in the project
- 'screens/' - Contains all the screens used in the project. This is all the views that the user can see while navigating the app
- 'utils/' - Contains utility functions used throughout the project such as firebase and other database functions
- 'App.js' - The main file that runs the app, this is the first file that is run when the app is started
- 'app.json' - Contains the configuration for the app such as the name and version and the commmands to run the app
- 'babel.config.js' - Contains the configuration for babel, a tool used to convert the code into a format that can be run on the web
- 'package.json' - Contains the dependencies and scripts used in the project
- 'package-lock.json' - Contains the exact versions of the dependencies used in the project
- 'README.md' - Contains the instructions for running the project
- 'SECURITY.md' - Contains the security policy for the project
- 'tsconfig.json' - Contains the configuration for typescript, a tool used to add types to javascript code