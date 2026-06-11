# AGENTS — AI agent guidance for this workspace

Purpose: Help AI coding agents quickly understand and work productively in this repository.

Quick start
- Serve the site locally from the workspace root (or the `campus_broomstick_webapp` folder):

```bash
python -m http.server 8000
```

What to know (links)
- **Root landing page**: [index.html](index.html)
- **Embedded game (PWA)**: [campus_broomstick_webapp/index.html](campus_broomstick_webapp/index.html)
- **Game logic**: [campus_broomstick_webapp/game.js](campus_broomstick_webapp/game.js)
- **Game styles**: [campus_broomstick_webapp/style.css](campus_broomstick_webapp/style.css)
- **Service worker**: [campus_broomstick_webapp/sw.js](campus_broomstick_webapp/sw.js)
- **PWA manifest**: [campus_broomstick_webapp/manifest.webmanifest](campus_broomstick_webapp/manifest.webmanifest)
- **Game docs / notes**: [campus_broomstick_webapp/README_WEBAPP.md](campus_broomstick_webapp/README_WEBAPP.md)

Key facts an agent should assume
- This is a static site; there are no build tools or npm scripts to run.
- The mini-game is a vanilla JS PWA inside `campus_broomstick_webapp/`.
- The service worker implements offline caching — avoid breaking cache keys when updating assets.

Agent guidelines (concise)
- **Link, don't embed**: Reference existing docs instead of copying them.
- **Minimal changes**: Make focused edits; prefer small, well-tested patches.
- **Local verification**: Test changes by serving the site locally and opening the relevant pages.
- **Preserve assets**: Image and WebP assets are optimized; avoid re-encoding unless requested.
- **Ask before commits**: For non-trivial changes, ask the repo owner for preferred branching/commit message conventions.

Suggested next customization
- Add a small `.github/copilot-instructions.md` or expand this file if you want organization-specific constraints (e.g., commit message format, test commands, CI hooks).

Maintainer contact
- If uncertain about intent or scope, ask the user to clarify before making large changes.
