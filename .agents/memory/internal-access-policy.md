---
name: Internal access policy
description: Authentication and authorization policy for the private Zilka-Kotab portal.
---

Retain Microsoft Entra ID organizational authentication for staff identity. Client sign-in must also accommodate invited clients who do not have Microsoft credentials. Portal authorization remains application-database controlled with CLIENT, ATTORNEY, PARALEGAL, and ADMIN roles. Public account creation must not be presented as an access path. PENDING records are not authorized; an administrator must change a user to ACTIVE before the user's first successful identity binding.

Durable identity is the validated Microsoft `tid + oid` pair. Email/UPN is display data and may be used only once to bind a pre-authorized ACTIVE record. Successful Microsoft authentication must never create a portal user or grant access.

**Why:** The user explicitly chose Microsoft Entra ID for a law-firm portal containing confidential client resources, with no Clerk, Replit Auth, public registration, domain-wide admission, or access granted solely by successful authentication. The user later requested a dedicated Paralegal role for internal task workflows.

**Why:** The user subsequently required client access without Microsoft credentials. This expands acceptable client identity methods, not client permissions or eligibility for staff workflows and billing.

**How to apply:** Every private API must verify an Active portal user by `tid + oid` and independently enforce client, tool, and project access server-side. Only an ACTIVE, unbound record may bind once by server-verified email. Attorneys are limited to assigned clients; paralegals have no client/project access by default and can use internal workflow matters matching their AppColl paralegal assignment plus tasks they participate in; client users require their own project permissions. Deactivation or assignment removal must take effect on the next request.

For the staff Dashboard, use the narrower task-assignment policy: non-admins see AppColl tasks where they are owner/contributor or tasks explicitly assigned to them internally, not every task belonging to an assigned client/matter. Settings may let an administrator provision an ACTIVE attorney/paralegal for portal access and assignments, but must not grant client/project access implicitly.

**Why:** The user clarified dashboard visibility and requested real login access when adding assignees, without changing authentication providers or requesting broader confidential-data access.