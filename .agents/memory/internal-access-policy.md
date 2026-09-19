---
name: Internal access policy
description: Authentication and authorization policy for the private Zilka-Kotab portal.
---

Use Replit Auth only to establish identity. Portal authorization remains application-database controlled with CLIENT, ATTORNEY, and ADMIN roles. Public account creation must not be presented as an access path.

**Why:** The user explicitly chose a fresh Replit Auth setup for a law-firm portal containing confidential client resources, with no public registration and no access granted solely by successful authentication.

**How to apply:** Every private API must verify an active portal user and independently enforce client, tool, and project access server-side. Attorneys are limited to assigned clients; client users require their own project permissions. Deactivation or assignment removal must take effect on the next request.