
# Contributing Guidelines

Welcome to the project! This document outlines the standards and practices for contributing to our codebase. Please follow these guidelines to ensure smooth collaboration.

---

## Table of Contents
1. [Branching Strategy](#branching-strategy)
2. [Commit Message Guidelines](#commit-message-guidelines)
3. [Pull Request Process](#pull-request-process)
4. [Workflow Summary](#workflow-summary)
5. [Useful Git Commands](#useful-git-commands)

---

## Branching Strategy

### Main Branches
- **`main`**: This branch contains production-ready code. No direct commits or merges are allowed.
- **`develop`**: This is the integration branch for ongoing development. All feature branches should be merged into `develop`.

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

---

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

---

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

### Writing a Good Pull Request
- **Title:** Clearly summarize the purpose of the PR.  
- **Description:** Explain what changes were made and why.  
- **Linked Issues:** Reference related GitHub issues (e.g., `Closes #42`).  

---

## Workflow Summary

1. **Pick a task** from GitHub Issues.  
2. **Create a branch** (`feature/`, `bugfix/`, `documentation/`, `hotfix/`).  
3. **Make small, focused commits**.  
4. **Push your branch** and **open a PR** into `develop`.  
5. **Request a review** and **squash commits** via the 'Squash and Merge' option.  

---

## Useful Git Commands

- **Create a new branch:**  
  ```bash
  git checkout -b feature/your-feature-name
  ```

- **Add and commit changes:**  
  ```bash
  git add .
  git commit -m "feat(module): add new feature"
  ```

- **Update your local `develop` branch:**  
  ```bash
  git checkout develop
  git pull origin develop
  ```

---

Thank you for contributing! If you have any questions, please reach out to the team.
