---
name: Contact delivery environments
description: Development SMTP acceptance does not establish live-site email delivery.
---

Production SMTP connections have intermittently timed out while development submissions were accepted promptly by the same configured mail service. Investigate live telemetry separately; never report production delivery as fixed based only on a development request.

**Why:** Repeated contact-form reports persisted after successful development tests. Production logs showed multi-minute pending requests and SMTP connection timeouts, alongside earlier authentication failures.

**How to apply:** Distinguish SMTP acceptance from inbox delivery and distinguish development from production in verification reports. Keep certificate verification enabled; a previous insecure TLS setting is not a justified remedy for connection timeouts.
