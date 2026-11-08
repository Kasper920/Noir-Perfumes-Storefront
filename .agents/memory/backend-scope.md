---
name: Backend database choice
description: User's database choice and approved scope for the NOIR backend.
---

Use Supabase as the application database for this website. The user selected “Backend, admin and customer accounts.”

**Why:** The user explicitly requested the website's backend and database, specified Supabase for the database, and selected the expanded scope.

**How to apply:** Preserve Supabase as the application data store when building the backend and include protected management and customer account flows. Do not treat the earlier withdrawn order/contact-only request as the current scope.

The initial owner grant must be an explicit, verified-email decision recorded once per authentication environment, not a first-signup rule or an admin role reapplied on every matching login.

**Why:** First-signup grants allow account takeover; repeated email-based grants undo deliberate role revocation.

**How to apply:** Keep ownership bootstrap separate from ordinary profile editing and session claims. Preserve the durable grant when revoking an owner's admin role.
