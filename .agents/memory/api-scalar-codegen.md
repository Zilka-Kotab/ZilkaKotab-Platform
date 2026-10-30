---
name: Generated scalar validation compatibility
description: Calendar-date and UUID format pitfalls in the current Orval/Zod generation setup.
---

Check generated runtime schemas, not just client TypeScript types, when adding scalar formats.

**Why:** In this workspace's generator configuration, a string with date format becomes a coerced JavaScript Date in the server Zod schema, whereas Drizzle calendar-only dates require YYYY-MM-DD strings. UUID format also generated a top-level Zod UUID helper unavailable in the installed Zod major.

**How to apply:** For calendar-only fields use string patterns plus real calendar validation. For UUIDs use a compatible string pattern/schema. Regenerate and typecheck both server and client; revisit this constraint if the generator or Zod versions change.
