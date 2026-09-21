---
name: Internal access policy
description: Authentication and authorization policy for the private Zilka-Kotab portal.
---

Use Microsoft Entra ID organizational authentication only to establish identity. Portal authorization remains application-database controlled with CLIENT, ATTORNEY, and ADMIN roles. Public account creation must not be presented as an access path.

Durable identity is the validated Microsoft `tid + oid` pair. Email/UPN is display data and may be used only once to bind a pre-authorized Pending record. Successful Microsoft authentication must never create a portal user or grant access.

**Why:** The user explicitly chose Microsoft Entra ID for a law-firm portal containing confidential client resources, with no Clerk, Replit Auth, public registration, domain-wide admission, or access granted solely by successful authentication.

**How to apply:** Every private API must verify an Active portal user by `tid + oid` and independently enforce client, tool, and project access server-side. Attorneys are limited to assigned clients; client users require their own project permissions. Deactivation or assignment removal must take effect on the next request.