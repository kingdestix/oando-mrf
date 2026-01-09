# 📝 Git Commit Guide

## Initial Setup (First Time Only)

### 1. Check if Git is initialized
```bash
cd "mrf project"
ls -la .git
```

If `.git` folder exists, skip to step 3. If not, continue:

### 2. Initialize Git
```bash
git init
```

### 3. Check current status
```bash
git status
```

### 4. Add all files
```bash
git add .
```

### 5. Create initial commit
```bash
git commit -m "Initial commit: Oando MRF System with complete workflow and fixes"
```

---

## Connect to GitHub

### 1. Create GitHub Repository
- Go to https://github.com/new
- Repository name: `oando-mrf-system` (or your choice)
- Description: "Oando Material Request Form Management System"
- **DO NOT** check "Initialize with README"
- Click "Create repository"

### 2. Connect Local Repository
```bash
# Replace with your actual GitHub username and repo name
git remote add origin https://github.com/YOUR_USERNAME/oando-mrf-system.git
git branch -M main
git push -u origin main
```

**If you get authentication error:**
- Use GitHub Personal Access Token instead of password
- Or use GitHub CLI: `gh auth login`

---

## Regular Commits (After Making Changes)

### 1. Check what changed
```bash
git status
```

### 2. Add specific files (or all)
```bash
# Add all changes
git add .

# OR add specific files
git add frontend/assets/js/app.js
git add backend/controllers/approvalController.js
```

### 3. Commit with descriptive message
```bash
git commit -m "Fix: Resolve null reference errors in approval modal"
```

### 4. Push to GitHub
```bash
git push origin main
```

---

## Good Commit Messages

### Format:
```
Type: Brief description

Optional longer explanation if needed
```

### Examples:
```bash
# Bug fix
git commit -m "Fix: Resolve DU dashboard not showing POD-routed requests"

# Feature
git commit -m "Feature: Add ability for approvers to view all approved requests"

# Update
git commit -m "Update: Make quotation USD optional in commercial details"

# Deployment
git commit -m "Deploy: Update API URL for Render backend"
```

---

## Before Deployment Commit

Make sure to commit the API URL change:

```bash
# 1. Update frontend/assets/js/app.js (line 7) with your Render URL
# 2. Then commit:
git add frontend/assets/js/app.js
git commit -m "Deploy: Update API base URL for production"
git push origin main
```

---

## Useful Git Commands

```bash
# View commit history
git log --oneline

# View changes in a file
git diff frontend/assets/js/app.js

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard local changes
git checkout -- filename

# Pull latest from GitHub
git pull origin main
```

---

## ⚠️ Important Notes

1. **Never commit `.env` files** - They contain secrets
2. **Never commit `node_modules/`** - Already in `.gitignore`
3. **Always check `git status`** before committing
4. **Write clear commit messages** - Future you will thank you!

---

## Quick Pre-Deployment Checklist

Before pushing to GitHub for deployment:

- [ ] All code changes tested locally
- [ ] `frontend/assets/js/app.js` updated with Render URL (or will update after backend deploy)
- [ ] No `.env` files in commit
- [ ] No sensitive data in code
- [ ] Commit message is descriptive
- [ ] Code is pushed to GitHub

---

**Ready to deploy?** See `DEPLOYMENT.md` for next steps!
