---
name: USPTO Open Data Portal API shape
description: Non-obvious request and document URL details for USPTO Patent File Wrapper imports.
---

The Patent File Wrapper search endpoint accepts a patent number through the GET `q` query parameter; the field-qualified POST form can return 400. Associated grant metadata exposes the XML download under `fileLocationURI`, and that URL may redirect before returning the grant XML. Grant XML may nest multiple `claim-text` elements inside one claim, so claim parsing must collect every descendant text node in order.

**Why:** The public USPTO documentation describes both GET and POST search access, but the live endpoint behavior and associated-document field names are stricter than the generic examples. The first `claim-text` element is only the opening paragraph for many claims.

**How to apply:** Keep identifiers normalized locally, send only the patent number to USPTO, follow redirects for `fileLocationURI`, recursively collect all claim descendant text, and treat missing grant XML or claims as an incomplete review draft rather than inventing metadata.