<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1DvruVSm5Bb5LDj2f2VJWR4hSaDAI53zD

## Run Locally

**Prerequisites:**  Node.js 18+ and npm 9+

1. Install dependencies:
   `npm install`
3. Run the app:
   `npm run dev`

## Test the PWA locally

1. **Install dependencies**  
   ```bash
   npm install
   ```
   ```

3. **Run the dev server** (Vite, hot reload):  
   ```bash
   npm run dev
   ```
   Visit http://localhost:5173.

4. **Build for production**:  
   ```bash
   npm run build
   ```

5. **Preview the production bundle** (uses Vite preview):  
   ```bash
   npm run preview
   ```

6. **Serve the `dist` folder** (mirrors Render static deploy):  
   ```bash
   npm run start
   ```
   Useful for testing service worker/PWA install prompts.

## Deploy to Render.com

1. **Commit & push** this repo (including `render.yaml` and `scripts/render-deploy.sh`) to GitHub/GitLab.
2. In Render, click **New +** → **Blueprint** (or **Static Site**) and connect the repo.
3. Set the build command to `npm run render-deploy` and the publish directory to `dist`.
4. Add required environment variables (e.g., `GEMINI_API_KEY`) under **Environment**.
5. Deploy. Render will install dependencies, run the Vite build, and serve the `dist` bundle with the SPA-friendly rewrite already defined in `render.yaml`.

To verify locally, run:

```bash
npm run render-deploy
```

which mirrors Render’s build step before pushing changes.
