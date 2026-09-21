---
name: Wouter root catch-all
description: Why the public layout must use a pathless fallback route in this app.
---

Use a final pathless `Route` after the specific portal routes when wrapping all public pages. Do not use `/:rest*` for that wrapper when the homepage must be included.

**Why:** In the installed Wouter version, `/:rest*` matched segmented public paths such as `/team` but did not match the bare `/` path, leaving the homepage blank without a browser exception.

**How to apply:** Keep protected and other specific routes first in the `Switch`, then place the pathless public-layout route last so it catches `/` and all remaining public paths.