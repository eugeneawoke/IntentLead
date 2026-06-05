# Smoke Test Checklist — IntentLead AI MVP

Run manually before each deploy.

## Authentication
- [ ] New user can register via Supabase Auth
- [ ] Existing user can log in
- [ ] Protected routes return 401 without token

## Cold Onboarding (Chat)
- [ ] Visit /chat — Composer loads
- [ ] Send first message — assistant responds with streaming tokens
- [ ] Chat asks about target audience (not a rigid script)
- [ ] After 3-4 messages — extract_intake tool fires (campaign created in DB)
- [ ] Off-topic test: type "write me a poem" → assistant redirects to lead gen

## Warm Entry
- [ ] Visit /chat?scanId=VALID_SCAN_ID — first message contains Glook context
- [ ] Visit /chat?scanId=INVALID → falls back to cold flow (no crash)

## Campaign Run
- [ ] GET /api/campaigns — returns user's campaigns
- [ ] POST /api/campaigns/:id/run → 202 response (< 1 second)
- [ ] Check worker logs — pipeline received campaign ID
- [ ] With 0 credits → /run returns 402

## Lead Delivery
- [ ] Verified lead: all 4 green badges (Signal ✓ Company ✓ Contact ✓ Email ✓)
- [ ] Rejected lead: grey badges, no credit charged
- [ ] LeadCard shows company, contact, email, intent score
- [ ] "Copy message" copies the generated email
- [ ] "Open in mail" opens mailto with subject + body

## Export
- [ ] POST /api/leads/export → CSV download with verified leads only
- [ ] CSV has correct headers: company_name, contact_name, email, etc.

## Security
- [ ] GET /internal/health without X-Internal-Key → 401
- [ ] POST /internal/run-pipeline without X-Internal-Key → 401
- [ ] User A cannot see User B's campaigns (RLS)

## Credits
- [ ] Free account: 10 leads, then upgrade prompt
- [ ] Verified lead: credits_remaining decreases by 1
- [ ] Rejected lead: credits_remaining unchanged
