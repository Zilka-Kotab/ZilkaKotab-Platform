---
name: Internal access policy
description: Authentication and authorization policy for the private Zilka-Kotab portal.
---

Use Clerk for staff and client authentication, including clients without Microsoft credentials. Portal authorization remains application-database controlled with CLIENT, ATTORNEY, PARALEGAL, and ADMIN roles. Public account creation must not be presented as an access path. PENDING records are not authorized; an administrator must change a user to ACTIVE before the user's first successful identity binding.

Durable identity is the server-validated Clerk user ID in the target environment. Only a server-verified primary email may bind a pre-authorized ACTIVE record once. After binding, email must not reassign that record to another identity. Successful Clerk authentication must never create a portal authorization record, promote its role, or grant project access.

For the one-time email bridge, compare normalized addresses and refuse ambiguous case-only duplicates rather than selecting an arbitrary role. Preserve the original authorization record instead of bulk-rewriting historical emails.

**Why:** Clerk normalizes email casing, but legacy or imported approval records can retain capitalization. Exact-case matching can reject a verified, approved user; picking the first case-insensitive match could bind the wrong privileges.

**Why:** The user explicitly requested Clerk after requiring access for clients without Microsoft credentials. This replaces the earlier Microsoft-only provider choice, not the law firm's confidential-data protections, administrator approval, or dedicated Paralegal role.

**How to apply:** Every private API must verify an Active portal user linked to the validated Clerk identity and independently enforce client, tool, and project access server-side. Only an ACTIVE, unbound record may bind once by server-verified email. Attorneys are limited to assigned clients; paralegals have no client/project access by default and can use internal workflow matters matching their AppColl paralegal assignment plus tasks they participate in; client users require their own project permissions. Deactivation or assignment removal must take effect on the next request. Preserve existing local user IDs, assignments and financial records when changing authentication providers.

For the staff Dashboard, use the narrower task-assignment policy: non-admins see AppColl tasks where they are owner/contributor or tasks explicitly assigned to them internally, not every task belonging to an assigned client/matter. Settings may let an administrator provision an ACTIVE attorney/paralegal for portal access and assignments, but must not grant client/project access implicitly.

**Why:** The user clarified dashboard visibility and requested real login access when adding assignees, without changing authentication providers or requesting broader confidential-data access.