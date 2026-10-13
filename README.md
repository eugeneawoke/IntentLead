# IntentLead AI

IntentLead is an evidence-first Opportunity Intelligence product in active development. It is being built to help a user move from an offer and ideal customer profile to companies worth reviewing — with the public evidence, reasoning and uncertainty visible at every step.

The product is not an email sender, mailbox automation tool or autonomous AI SDR. It prepares research for a human decision; it does not contact anyone.

## What exists today

This repository contains a working full-stack foundation:

- a Next.js and React application with authenticated discovery and review surfaces;
- typed domain contracts for evidence, companies, Opportunities and review decisions;
- Supabase/Postgres persistence with tenant-aware authorization and RLS foundations;
- durable worker jobs with retry, recovery and idempotency controls;
- provider and model abstractions with fixture-based, no-network execution paths;
- human review states that keep observed facts separate from interpretation;
- unit, integration and browser tests for the implemented workflow.

Live source coverage and the complete buyer/contact/draft workflow are still under development. Paid providers, automatic sending and production migrations are not enabled by this public snapshot.

## What it is becoming

The intended product flow is:

```text
Offer + ICP + market
        ↓
multi-source discovery
        ↓
evidence and company resolution
        ↓
Opportunity assessment
        ↓
relevant buyer and verified business contact
        ↓
evidence-grounded brief or draft
        ↓
human review and manual action
```

Every material conclusion should remain traceable to inspectable evidence. Missing information is reported as missing rather than filled in by a model.

## Public project notes

- [Product overview](docs/PRODUCT_OVERVIEW.md)
- [Engineering overview](docs/ENGINEERING_OVERVIEW.md)
- [Security and quality](docs/SECURITY_AND_QUALITY.md)

The public repository intentionally contains only portfolio-level documentation. Internal roadmaps, implementation plans, provider evaluations and operational runbooks are maintained privately.

## Run locally

Requirements: Node.js 20+ and a Supabase project for authenticated and persisted flows.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The landing experience can be inspected without connecting external providers. Configure the values documented in `.env.example` for authentication, persistence and worker-backed flows.

## Verify

```bash
npm run typecheck:app
npm run typecheck:worker
npm run lint
npm run test:unit
npm run build
```

Integration tests require a disposable PostgreSQL database. Browser tests use Playwright and may require its local browser dependencies.

## Repository purpose

This is a public engineering showcase of an actively developed product, not a claim that every visible contract or adapter is live in production. The code demonstrates product modeling, full-stack TypeScript, authorization boundaries, durable workflows, evidence provenance and test design.
