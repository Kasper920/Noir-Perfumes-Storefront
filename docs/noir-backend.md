# NOIR backend operations

## What is connected

The Express API under `/api` is the only data gateway. Supabase stores the catalog, variant stock/prices, profiles, order snapshots, contact messages, and one-time owner grants. Clerk provides verified customer identity and browser session cookies.

Product names, English/Arabic descriptions, notes, filters, badges, prices, stock, visibility, and image paths live in the existing Supabase product and variant tables. Product image bytes live in the public `noir-product-images` Supabase Storage bucket and are loaded by URL; this keeps media bytes out of PostgreSQL. The original six-bottle image is uploaded once to the `sprites/noir-product-grid.webp` bucket path and each product keeps its existing crop. New images uploaded from the admin editor replace a product's photo with its own Storage object. `src/data/products.js` retains only the original catalog for initial setup and a currency formatter; it is not used as the storefront data source.

## Required configuration

Configure through Replit Secrets/environment settings; never place values in source code:

- `SUPABASE_URL`: project URL. The server normalizes to the project origin.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase secret/service-role key.
- `SUPABASE_ANON_KEY`: retained for public-access verification, not privileged operations.
- `SESSION_SECRET`: signs the anonymous checkout continuity cookie.
- `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`: provisioned by Replit-managed Clerk.
- `NOIR_ADMIN_EMAIL`: the explicitly owner-configured email allowed to receive the initial admin role.

The service-role key bypasses Supabase RLS, so it must **never** be Vite-prefixed, returned to the client, logged, or embedded in a frontend build. Application permissions are checked server-side against the verified session and app profile.

## Owner admin access

1. Open `/sign-up` and register using the email configured in `NOIR_ADMIN_EMAIL`.
2. Complete Clerk's email verification, then open `/account`.
3. The server checks the verified **primary** email with Clerk before making the one-time admin grant. The account page then links to `/admin`; this can also be opened directly.

This is not “first signup becomes admin.” All other signups are customers. Roles cannot be changed by profile updates, submitted request data, or browser state. The durable grant record prevents a restart or repeat login from restoring an admin role that was subsequently revoked.

Development and published Clerk instances have separate identities. Register and verify the configured owner email in each environment. A development admin record is not a production admin account. The same Supabase project is currently configured for both, so store/catalog data is shared; use separate Supabase projects if operational isolation is needed before live operation.

To revoke an admin, a trusted database operator can change that profile's role to `customer`; keep its owner-grant record to prevent automatic regrant. Changing the configured owner email is an explicit ownership decision, not a normal customer action.

## Database setup and seeds

Applied additive migration SQL is retained under `supabase/migrations/`:

1. Store tables, locked checkout, product versioning, and fulfillment transitions.
2. One-time owner bootstrap.
3. Restriction of obsolete anonymous submission functions from earlier experiments. Their legacy tables/data were retained.
4. Product image paths and a transaction that updates catalog images with their expected product version.

All application tables have RLS enabled with no public policies, and `anon`/`authenticated` table privileges are revoked. This intentionally denies direct browser access. All mutation RPCs are security-invoker functions executable only by `service_role`. Normal app requests are authorized by Express first.

The seed command is:

```sh
node artifacts/api-server/scripts/seed.mjs
```

Run it only for initial setup after applying the schema. It inserts missing records and never overwrites admin edits or existing stock. Initial stock was seeded to **50 bottles per size per fragrance as setup data**; replace those quantities with actual stock in `/admin` before accepting real orders.

Initial bucket setup and migration of existing artwork:

```sh
node artifacts/api-server/scripts/setup-product-images.mjs
```

This safely creates the public `noir-product-images` bucket (5 MB limit; JPEG, PNG, and WebP only), uploads the existing optimized catalog image, and links any seeded products that don't yet have an image. It keeps existing admin-uploaded image paths unchanged. Product images are public so they can appear on the storefront; only authenticated server-side admin endpoints can upload or replace them. The server verifies file signatures, enforces the file size and allowed formats, writes with the service key only on the server, and checks product versions to avoid overwriting concurrent edits.

In the admin dashboard, choose a fragrance and use **Upload a photo**. New products must be saved before their first upload. Uploading a photo saves it immediately and updates the product photo in the store without changing its name, notes, price, or stock.

Post-merge setup installs dependencies and builds shared types. It intentionally does not push the unused Replit database, modify remote schema, or reset inventory.

## Shopping and fulfillment

- Guests can buy without signing in. Signed-in orders use the server-authenticated customer ID.
- Guest orders do not automatically appear in an account created later; never claim guest orders by an unverified matching name/phone.
- The database locks catalog/variant records, checks availability and quantity, snapshots names and prices, and decrements stock atomically.
- KWD amounts support three decimal places. The database owns order currency and totals; client-supplied prices or totals are ignored.
- An idempotency UUID plus a server-checked payload/identity hash protects retrying an ambiguous checkout response. The browser retains only a digest and UUID, not form contents, for this purpose.
- Confirmation and cart deduction happen only after the save succeeds. A failure leaves form values and cart quantities available for retry.
- Pending → processing or cancelled; processing → shipped or cancelled; shipped → delivered. Cancelled/delivered orders are terminal. Cancellation restores stock exactly once.
- Catalog versions also advance when checkout or cancellation changes stock, preventing an old admin editor from overwriting those stock changes.
- Lists currently show the latest 500 orders/messages, refreshed every 30 seconds and on window focus.

**No online payment is processed.** Card/KNET/cash are preferences recorded on the order. The boutique must arrange payment and delivery. There are no card-number inputs, paid-status claims, payment gateway, emails, or SMS notifications.

## Contact and customer privacy

Contact messages are validated and saved to Supabase. `/admin` can read, resolve, and reopen them. Submission success does not mean an email was sent.

Customers can edit only their name, phone, and address. Customer order queries always filter by the authenticated ID, including detail lookups. A different customer's order returns 404. Management endpoints return 401 when signed out and 403 for a signed-in non-admin.

Cart/favorites remain local to the browser and are scoped per signed-in account. A guest bag transfers on sign-in; logging out does not expose the prior account's local bag.

Same-origin mutation checks, request-body limits, input validators, and basic per-process rate limits protect the API. For larger or multi-instance operations, add a shared abuse-prevention store and bot protection rather than relying on per-process counters.

## Verification

```sh
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/noir-perfumes run typecheck
pnpm --filter @workspace/api-server run typecheck
node artifacts/api-server/scripts/verify-store.mjs
node artifacts/api-server/scripts/verify-admin.mjs
```

The verification script uses uniquely named synthetic product/message/order records and removes only its own records in `finally`. It checks authoritative totals, saved records, retry safety, competing orders for the last bottle, cancellation stock, stale product edits, malformed input, signed-out authorization, and denied direct anonymous table/RPC access. It requires the API workflow to be running behind the shared proxy.

Never use real customer details in test fixtures. Do not log upstream errors containing secrets, session data, or customer payloads.

The admin verification requires development Clerk keys. It creates a unique synthetic Clerk identity, grants only that synthetic app profile admin access for the duration of the script, uses signed server-verified session tokens to exercise real HTTP permissions, and removes its identity and store records afterward. It checks product create/archive/restore, fulfillment and stock restoration, message resolve/reopen, immediate role revocation, and protection against self-promotion.
