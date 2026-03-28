# Cycle Tracker

Single-file mobile-first cycle tracker built with vanilla HTML/CSS/JS and Supabase JS SDK v2.

## What is included

- Setup screen for Supabase URL, anon key, cycle start date, and name
- Daily log, injection log, supplement tracking, workout tracking
- Time-of-day checklist that changes between morning, midday, and evening
- Weight trend chart and recent log history
- Local storage only for configuration; app data is stored in Supabase

## Files

- `index.html` - the full app
- `.gitignore` - local repo ignore rules

## Supabase setup

1. Open the app locally.
2. Copy the SQL from the setup screen.
3. Run it in the Supabase SQL editor.
4. Enter your Supabase Project URL and anon key in the app.

## GitHub push

From this folder, run:

```powershell
git add .
git commit -m "Initial Cycle Tracker app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

If the remote already exists, use:

```powershell
git remote set-url origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

## Cloudflare Pages deploy

1. Log in to Cloudflare.
2. Go to Workers & Pages.
3. Create a new Pages project.
4. Connect the GitHub repository.
5. Use these settings:
   - Framework preset: `None`
   - Build command: leave empty
   - Build output directory: `/`
6. Deploy.

After that, Cloudflare will give you a public URL and every push to `main` will update the site.

## What to update later

- Edit `index.html`
- Commit and push to GitHub
- Cloudflare Pages will redeploy automatically
