Deployment Guide – GitHub Pages (Official)
=========================================

This project is now deployed exclusively via GitHub Pages using GitHub Actions.

What’s configured
- A Pages workflow: .github/workflows/pages.yml
- Production build output: dist/
- Automatic deploys on push to main

One‑time setup (repo owner)
1. Repository → Settings → Pages → Build and deployment → Source: GitHub Actions
2. Ensure Actions are enabled for the repository

Everyday deployment (already set up)
- Push to main:
	```bash
	git add -A
	git commit -m "Your change"
	git push origin main
	```
- Actions → "Deploy to GitHub Pages" will build and publish dist automatically

Manual deployment trigger
- Actions tab → Workflows → "Deploy to GitHub Pages" → Run workflow

Local build (optional)
```bash
npm ci
npm run build
# Output is in dist/
```

Notes
- Netlify, Vercel and Surge are no longer used for this project.
- The file netlify.toml has been disabled; do not rely on it for deploys.
- If you need to change the Node version or cache behavior, edit .github/workflows/pages.yml.

### Steps:
```bash
npm install -g surge
cd /Users/admin/Computational\ Ethnousicology\ App/dist
surge
# Follow prompts, get URL like: https://random-name.surge.sh
```

---

## Current Status:
- ✅ Build: `dist/` folder ready
- ✅ PWA: Service worker + manifest configured
- ✅ Offline: Core assets cached
- ✅ netlify.toml: Auto-deployment configured

## Recommended Next Steps:
1. Add PWA icons to manifest.json for install prompts
2. Create GitHub repo and push code
3. Deploy via Netlify (takes 2 min)
4. Share the resulting URL with students/teachers

Questions? Check the app's README.md for more details.
