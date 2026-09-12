# JalVerify

Every tanker. Every litre. Verified.

JalVerify is a civic-tech prototype for apartment associations that need a reliable evidence trail for tanker deliveries. The demo implements the complete driver -> evidence -> manager -> quota -> resident transparency -> audit workflow.

## Run locally

```bash
npm install
npm run dev
```

The app supports two modes. With no environment variables it runs as a zero-config browser demo using seeded localStorage data. With Supabase variables configured it uses Postgres, Auth, private Storage, server timestamps, RPC review actions, and audit events.

## Demo flow

1. Open the manager overview and inspect the seeded delivery data.
2. Open **Pending verification** and verify or dispute a delivery.
3. Watch verified volumes update the dashboard and block status.
4. Open **Resident view** to see the sanitized public supply ledger.
5. Open **Record delivery** to submit a real photo from a mobile camera or file picker.

## Implemented

- Mobile-first driver evidence form with photo preview, size guard, duplicate warning and server-time-shaped submission label.
- Supabase Storage upload to the private `delivery-evidence` bucket with client-side resize/compression to a 1000px maximum dimension.
- Server-side duplicate, off-hours, mismatch, and deterministic verification-priority scoring.
- Supabase Auth manager gate and signed private evidence previews.
- Manager overview with calculated verified water, quota, completion, block gaps and action queue.
- Evidence cards with mismatch, duplicate, off-hours and risk-priority signals.
- Verify and dispute flows with comments and immutable local audit events.
- Searchable delivery register, block configuration view, audit stream and evidence timeline.
- Public resident view that exposes verified supply and under-review volume without internal comments.
- Responsive layout for phone, tablet and desktop widths.

## Trust model and limits

A photograph is not treated as proof that cannot be manipulated. JalVerify creates a stronger chain of evidence: server timestamp, tanker identity, target block, meter photograph, manager verification and an audit event. It does not implement GPS, hardware sensors, OCR, payments or identity proofing.

## Production path

## Supabase setup

1. Create a Supabase project and run `supabase/migrations/001_initial_schema.sql`, then `002_workflow_functions.sql` in the SQL editor.
2. Run `supabase/seed.sql` to add the five blocks and five demo tankers.
3. Create a manager in Supabase Auth, then insert the matching user id, name, email and `MANAGER` role into `public.users`.
4. The migration creates the private `delivery-evidence` Storage bucket and its manager upload/read policies.
5. Add the values from `.env.example` to a local `.env` file or deployment environment.

## Environment variables

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Never expose a service-role key in Vite or commit real credentials.

## Deployment

Run `npm run build`, then deploy the generated `dist` folder to Vercel, Cloudflare Pages, or another static host. Configure the two Vite variables in the host and use `/public` as the resident URL. Configure SPA fallback to `index.html` if using history-based host routing.

## Trust model and edge cases

Server time is authoritative. Duplicate submissions remain in the audit trail. Off-hours, volume mismatch, and risk score are review signals rather than fraud verdicts. Pending and disputed volumes never count toward verified supply. Upload failures are surfaced and do not report success.

## Known limitations and future improvements

The current MVP has no driver accounts, offline queue, GPS, hardware meter, OCR, payments, or dispute resolution workflow. Future work can add driver authentication, signed daily certificates, paginated server queries, and a formal dispute-resolution state without changing the evidence model.
