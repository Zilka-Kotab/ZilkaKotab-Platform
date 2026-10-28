---
name: Contact delivery environments
description: Use Microsoft 365 HTTPS mail delivery and verify development and production independently.
---

Public website contact and inquiry email should use the connected Microsoft 365 mailbox through its HTTPS mail API, without a silent SMTP fallback.

**Why:** The user authorized this change after repeated SMTP failures. Production had interleaved authentication rejections, connection timeouts, and a successful send; neither an updated app password nor a single accepted test established reliable service.

**How to apply:** Keep the authorized sender pinned rather than choosing a different account when more connections are added. Preserve existing recipients and visitor reply-to behavior. Require provider acceptance before returning success, but distinguish that acceptance from verified inbox receipt. Investigate live telemetry separately; never report production delivery as fixed based only on a development request. Do not disable certificate verification as a timeout remedy.
