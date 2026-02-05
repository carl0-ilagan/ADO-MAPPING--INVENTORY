# Push this project to GitHub

Repo: **https://github.com/carl0-ilagan/ADO-MAPPING--INVENTORY**

## Option 1: Run the script (easiest)

1. **Install Git** if you haven’t: https://git-scm.com/download/win  
   During setup, choose **“Git from the command line and also from 3rd-party software”** so `git` is in your PATH.

2. **Double-click `push-to-github.bat`** in this folder, or open **Command Prompt** / **PowerShell**, then:
   ```bat
   cd "c:\Users\User\Documents\ado-mapping-inventory-system"
   push-to-github.bat
   ```
3. When it asks **Commit and push?**, type **y** and press Enter.  
   If GitHub asks for login, use your GitHub username and a **Personal Access Token** as the password (not your GitHub password):  
   https://github.com/settings/tokens → Generate new token (classic) → enable `repo` → copy and paste when prompted.

---

## Option 2: Run Git commands yourself

Open **Git Bash** (from Start Menu after installing Git) or any terminal where `git` works, then run:

```bash
cd "c:/Users/User/Documents/ado-mapping-inventory-system"

git init
git branch -M main
git remote add origin https://github.com/carl0-ilagan/ADO-MAPPING--INVENTORY.git

git add .
git commit -m "first commit"
git push -u origin main
```

If you already ran `git init` or `remote add` before, skip those lines. If the repo already has a remote:

```bash
git remote set-url origin https://github.com/carl0-ilagan/ADO-MAPPING--INVENTORY.git
git add .
git commit -m "first commit"
git push -u origin main
```

---

After a successful push, your code will be at:  
**https://github.com/carl0-ilagan/ADO-MAPPING--INVENTORY**
