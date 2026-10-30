---
name: Vite optimized dependency consistency
description: Workspace dependency updates can leave browser prebundles inconsistent with installed React packages.
---

Matching installed React and React DOM versions do not guarantee the development browser uses that pair: Vite's optimized dependency metadata can retain old resolutions after a workspace catalog update and restart.

**Why:** During Clerk integration, the installed packages matched but the preview still loaded an older React DOM prebundle and failed its version check.

**How to apply:** Compare the artifact's optimized dependency metadata with actual package resolutions before changing package versions again. Treat stale generated caches separately from the dependency manifest; do not introduce permanent forced optimization or change compatible versions merely to compensate for an old cache.
