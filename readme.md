# Treble

## Table of Contents
1. Project Overview
2. Getting Started
3. Project Structure
4. Branching Strategy
5. Commit Message Guidelines
6. Pull Request Process
7. Useful Git Commands
8. Contributing
9. License

## Project Overview
Treble is a music review and social networking application that allows users to explore, review, and share their favorite music tracks, albums, and artists. Users can interact with each other by following, commenting, and upvoting reviews.

## Getting Started
### Prerequisites
- Node.js
- npm or yarn
- Expo CLI

### Installation
Prior to running make sure to have a local NGROK configuration set up https://ngrok.com/
1. Clone the repository:
   ```bash
   git clone https://github.com/TeamBass/Treble.git
   ```
2. Navigate to the project directory:
   ```bash
   cd Treble
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```
4. Set up the .env file in the root directory with the following variables:
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
   SPOTIFY_SCOPE="user-read-private user-read-email user-read-playback-state user-modify-playback-state"
   API_TUNNEL_URL="URL_FROM_NGROK"
   API_URL="ONLY IF DEPLOYING INTO NON-DEV ENVIRONMENT [STAGING, PROD]"
   ```

### Running the Project
1. Start the project:
   ```bash
   npm start
   ```
   If you encounter issues, try:
   ```bash
   npm start -- --reset-cache --clear
   ```
2. Open the project using the Expo Go app on your phone or emulator. Scan the QR code generated in the terminal or enter the URL underneath the QR code into your phone's browser.

## Project Structure
- assets - Contains images and other assets used in the project
- components - Contains all the components used in the project
- screens - Contains all the screens used in the project
- utils - Contains utility functions used throughout the project
- App.js - The main file that runs the app
- app.json - Contains the configuration for the app
- babel.config.js - Contains the configuration for Babel
- package.json - Contains the dependencies and scripts used in the project
- package-lock.json - Contains the exact versions of the dependencies used in the project
- README.md - Contains the instructions for running the project

## Branching Strategy
### Main Branches
- **`main`**: Contains production-ready code. No direct commits or merges are allowed.
- **`develop`**: Integration branch for ongoing development. All feature branches should be merged into `develop`.

### Supporting Branches
- **`feature/`**: Used for developing new features.  
  _Example:_ `feature/user-authentication`
- **`bugfix/`**: Used for fixing bugs.  
  _Example:_ `bugfix/login-error`
- **`documentation/`**: Used for updating or adding documentation.  
  _Example:_ `documentation/api-endpoints`
- **`hotfix/`**: Used for urgent fixes directly related to production issues.  
  _Example:_ `hotfix/critical-bug`

### Branching Workflow
1. **Create a new branch** off `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```
2. **Commit changes** with clear, concise messages.
3. **Push your branch** to the remote repository:
   ```bash
   git push origin feature/your-feature-name
   ```
4. **Create a Pull Request (PR)** into `develop`.

## Commit Message Guidelines
### Writing Style for Commits
- **Tense:** Use the imperative mood (e.g., "Add feature" instead of "Added" or "Adding").
- **Tone:** Keep messages clear, concise, and specific. Avoid vague statements.
- **Scope:** Ensure each commit addresses a single, focused change. Break larger changes into multiple commits when necessary.

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```
- **`type`**: Describes the category of the change (e.g., feat, fix).
- **`scope`**: Specifies the part of the codebase affected (e.g., auth, api).
- **`subject`**: A brief, imperative statement summarizing the change.

### Commit Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation updates
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code changes that neither fix a bug nor add a feature
- **chore**: Maintenance tasks (build process, dependencies)

### Example Commit
```
feat(auth): add JWT authentication

Implement JWT authentication for user login and registration.

Closes #42
```

## Pull Request Process
1. **Ensure your branch is up-to-date** with `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout feature/your-feature-name
   git merge develop
   ```
2. **Push your branch** if needed:
   ```bash
   git push origin feature/your-feature-name
   ```
3. **Open a Pull Request (PR)** into `develop`.
4. **Request at least one team member's review**.
5. **Use the 'Squash and Merge' option** after approval to combine commits.

## Useful Git Commands
- **Clone a repository**:
  ```bash
  git clone <repository-url>
  ```
- **Create a new branch**:
  ```bash
  git checkout -b <branch-name>
  ```
- **Switch to an existing branch**:
  ```bash
  git checkout <branch-name>
  ```
- **Commit changes**:
  ```bash
  git commit -m "commit message"
  ```
- **Push changes to remote**:
  ```bash
  git push origin <branch-name>
  ```
- **Pull latest changes**:
  ```bash
  git pull origin <branch-name>
  ```

## Contributing
We welcome contributions from the community. Please read our Contributing Guidelines for more details.

## License
This project is licensed under the MIT License. See the LICENSE file for details.

Aleks4920: give me the markdown so i can put it in a file

GitHub Copilot: Here is the Markdown content for your README file:

```markdown
# Treble

## Table of Contents
1. [Project Overview](#project-overview)
2. [Getting Started](#getting-started)
3. [Project Structure](#project-structure)
4. [Branching Strategy](#branching-strategy)
5. [Commit Message Guidelines](#commit-message-guidelines)
6. [Pull Request Process](#pull-request-process)
7. [Useful Git Commands](#useful-git-commands)
8. [Contributing](#contributing)
9. [License](#license)

## Project Overview
Treble is a music review and social networking application that allows users to explore, review, and share their favorite music tracks, albums, and artists. Users can interact with each other by following, commenting, and upvoting reviews.

## Getting Started
### Prerequisites
- Node.js
- npm or yarn
- Expo CLI

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/TeamBass/Treble.git
   ```
2. Navigate to the project directory:
   ```bash
   cd Treble
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```
4. Set up the `.env` file in the root directory with the following variables:
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
   SPOTIFY_SCOPE="user-read-private user-read-email user-read-playback-state user-modify-playback-state"
   API_TUNNEL_URL="URL_FROM_NGROK"
   API_URL="ONLY IF DEPLOYING INTO NON-DEV ENVIRONMENT [STAGING, PROD]"
   ```

### Running the Project
1. Start the project:
   ```bash
   npm start
   ```
   If you encounter issues, try:
   ```bash
   npm start -- --reset-cache --clear
   ```
2. Open the project using the Expo Go app on your phone or emulator. Scan the QR code generated in the terminal or enter the URL underneath the QR code into your phone's browser.

## Project Structure
- `assets/` - Contains images and other assets used in the project
- `components/` - Contains all the components used in the project
- `screens/` - Contains all the screens used in the project
- `utils/` - Contains utility functions used throughout the project
- `App.js` - The main file that runs the app
- `app.json` - Contains the configuration for the app
- `babel.config.js` - Contains the configuration for Babel
- `package.json` - Contains the dependencies and scripts used in the project
- `package-lock.json` - Contains the exact versions of the dependencies used in the project
- `README.md` - Contains the instructions for running the project

## Branching Strategy
### Main Branches
- **`main`**: Contains production-ready code. No direct commits or merges are allowed.
- **`develop`**: Integration branch for ongoing development. All feature branches should be merged into `develop`.

### Supporting Branches
- **`feature/`**: Used for developing new features.  
  _Example:_ `feature/user-authentication`
- **`bugfix/`**: Used for fixing bugs.  
  _Example:_ `bugfix/login-error`
- **`documentation/`**: Used for updating or adding documentation.  
  _Example:_ `documentation/api-endpoints`
- **`hotfix/`**: Used for urgent fixes directly related to production issues.  
  _Example:_ `hotfix/critical-bug`

### Branching Workflow
1. **Create a new branch** off `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```
2. **Commit changes** with clear, concise messages.
3. **Push your branch** to the remote repository:
   ```bash
   git push origin feature/your-feature-name
   ```
4. **Create a Pull Request (PR)** into `develop`.

## Commit Message Guidelines
### Writing Style for Commits
- **Tense:** Use the imperative mood (e.g., "Add feature" instead of "Added" or "Adding").
- **Tone:** Keep messages clear, concise, and specific. Avoid vague statements.
- **Scope:** Ensure each commit addresses a single, focused change. Break larger changes into multiple commits when necessary.

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```
- **`type`**: Describes the category of the change (e.g., feat, fix).
- **`scope`**: Specifies the part of the codebase affected (e.g., auth, api).
- **`subject`**: A brief, imperative statement summarizing the change.

### Commit Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation updates
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code changes that neither fix a bug nor add a feature
- **chore**: Maintenance tasks (build process, dependencies)

### Example Commit
```
feat(auth): add JWT authentication

Implement JWT authentication for user login and registration.

Closes #42
```

## Pull Request Process
1. **Ensure your branch is up-to-date** with `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout feature/your-feature-name
   git merge develop
   ```
2. **Push your branch** if needed:
   ```bash
   git push origin feature/your-feature-name
   ```
3. **Open a Pull Request (PR)** into `develop`.
4. **Request at least one team member's review**.
5. **Use the 'Squash and Merge' option** after approval to combine commits.

## Useful Git Commands
- **Clone a repository**:
  ```bash
  git clone <repository-url>
  ```
- **Create a new branch**:
  ```bash
  git checkout -b <branch-name>
  ```
- **Switch to an existing branch**:
  ```bash
  git checkout <branch-name>
  ```
- **Commit changes**:
  ```bash
  git commit -m "commit message"
  ```
- **Push changes to remote**:
  ```bash
  git push origin <branch-name>
  ```
- **Pull latest changes**:
  ```bash
  git pull origin <branch-name>
  ```

## Contributing
We welcome contributions from the community. Please read our [Contributing Guidelines](CONTRIBUTING.md) for more details.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
```

Aleks4920: try again, that wasnt markdown

GitHub Copilot: Here is the Markdown content for your README file:

# Treble

## Table of Contents
1. Project Overview
2. Getting Started
3. Project Structure
4. Branching Strategy
5. Commit Message Guidelines
6. Pull Request Process
7. Useful Git Commands
8. Contributing
9. License

## Project Overview
Treble is a music review and social networking application that allows users to explore, review, and share their favorite music tracks, albums, and artists. Users can interact with each other by following, commenting, and upvoting reviews.

## Getting Started
### Prerequisites
- Node.js
- npm or yarn
- Expo CLI

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/TeamBass/Treble.git
   ```
2. Navigate to the project directory:
   ```bash
   cd Treble
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```
4. Set up the .env file in the root directory with the following variables:
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
   SPOTIFY_SCOPE="user-read-private user-read-email user-read-playback-state user-modify-playback-state"
   API_TUNNEL_URL="URL_FROM_NGROK"
   API_URL="ONLY IF DEPLOYING INTO NON-DEV ENVIRONMENT [STAGING, PROD]"
   ```

### Running the Project
1. Start the project:
   ```bash
   npm start
   ```
   If you encounter issues, try:
   ```bash
   npm start -- --reset-cache --clear
   ```
2. Open the project using the Expo Go app on your phone or emulator. Scan the QR code generated in the terminal or enter the URL underneath the QR code into your phone's browser.

## Project Structure
- assets - Contains images and other assets used in the project
- components - Contains all the components used in the project
- screens - Contains all the screens used in the project
- utils - Contains utility functions used throughout the project
- App.js - The main file that runs the app
- app.json - Contains the configuration for the app
- babel.config.js - Contains the configuration for Babel
- package.json - Contains the dependencies and scripts used in the project
- package-lock.json - Contains the exact versions of the dependencies used in the project
- README.md - Contains the instructions for running the project

## Branching Strategy
### Main Branches
- **`main`**: Contains production-ready code. No direct commits or merges are allowed.
- **`develop`**: Integration branch for ongoing development. All feature branches should be merged into `develop`.

### Supporting Branches
- **`feature/`**: Used for developing new features.  
  _Example:_ `feature/user-authentication`
- **`bugfix/`**: Used for fixing bugs.  
  _Example:_ `bugfix/login-error`
- **`documentation/`**: Used for updating or adding documentation.  
  _Example:_ `documentation/api-endpoints`
- **`hotfix/`**: Used for urgent fixes directly related to production issues.  
  _Example:_ `hotfix/critical-bug`

### Branching Workflow
1. **Create a new branch** off `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```
2. **Commit changes** with clear, concise messages.
3. **Push your branch** to the remote repository:
   ```bash
   git push origin feature/your-feature-name
   ```
4. **Create a Pull Request (PR)** into `develop`.

## Commit Message Guidelines
### Writing Style for Commits
- **Tense:** Use the imperative mood (e.g., "Add feature" instead of "Added" or "Adding").
- **Tone:** Keep messages clear, concise, and specific. Avoid vague statements.
- **Scope:** Ensure each commit addresses a single, focused change. Break larger changes into multiple commits when necessary.


### Commit Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation updates
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code changes that neither fix a bug nor add a feature
- **chore**: Maintenance tasks (build process, dependencies)


## Pull Request Process
1. **Ensure your branch is up-to-date** with `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout feature/your-feature-name
   git merge develop
   ```
2. **Push your branch** if needed:
   ```bash
   git push origin feature/your-feature-name
   ```
3. **Open a Pull Request (PR)** into `develop`.
4. **Request at least one team member's review**.
5. **Use the 'Squash and Merge' option** after approval to combine commits.

## Useful Git Commands
- **Clone a repository**:
  ```bash
  git clone <repository-url>
  ```
- **Create a new branch**:
  ```bash
  git checkout -b <branch-name>
  ```
- **Switch to an existing branch**:
  ```bash
  git checkout <branch-name>
  ```
- **Commit changes**:
  ```bash
  git commit -m "commit message"
  ```
- **Push changes to remote**:
  ```bash
  git push origin <branch-name>
  ```
- **Pull latest changes**:
  ```bash
  git pull origin <branch-name>
  ```

## Contributing
We welcome contributions from the community. Please read our Contributing Guidelines for more details.

## License
This project is licensed under the MIT License. See the LICENSE file for details.
