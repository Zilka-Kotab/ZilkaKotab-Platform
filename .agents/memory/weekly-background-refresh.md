---
name: Weekly background refresh
description: Why an in-app refresh timer is not a weekly scheduling guarantee on Autoscale.
---

An in-process timer can refresh cached public data when the API is awake and on its next startup, but it cannot guarantee a calendar-based weekly run on an Autoscale deployment. A separate Scheduled Deployment running the standalone refresh command is needed for a strict weekly cadence.

**Why:** Replit Autoscale scales idle processes to zero; timers do not run when no process exists. The site's on-demand refresh avoids stale data once it wakes, but cannot run during an idle week.

**How to apply:** Before promising an exact weekly cadence in production, configure and verify a Scheduled Deployment for the background command. Keep public analysis on the last fully completed dataset during a refresh; do not make a public query fetch the whole firm portfolio.
