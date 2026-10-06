# IntentLead design system — Signal Dark

## Product expression

The interface helps a user inspect business Opportunities, their evidence, assessment and uncertainty. It must feel like an intelligence workspace, not an email tool, CRM or lead-list dashboard.

## Principles

- Evidence before decoration.
- Company and observed condition are primary; source/vendor is secondary.
- Facts, inference and uncertainty are visually distinct.
- Rejection and needs-research states are first-class, not error states.
- No send, mailbox, sequence or delivery controls.
- Website content, when present, is labeled only as business identity/context; the product does not run a technical, SEO or AI-readiness audit.

## Tokens

```css
--bg: #090b0f;
--surface-1: #11151b;
--surface-2: #181e26;
--border: #27303a;
--text: #f4f7fb;
--text-muted: #9aa6b2;
--text-faint: #65717d;
--accent: #a3e635;
--accent-fg: #111803;
--warning: #f59e0b;
--danger: #ef4444;
--info: #60a5fa;
```

Use the accent for the primary action and confirmed evidence relationships, never as a synonym for “buyer intent” or commercial certainty.

## Typography and layout

- Sans-serif for product UI; monospace only for ids, hashes, source URLs and timestamps.
- Maximum readable content width around 1200px; evidence text columns remain narrow.
- Cards use restrained borders and spacing rather than decorative gradients.
- Motion communicates job progress or state transition and respects reduced-motion settings.

## Core surfaces

### Discovery brief

Shows offer, ICP, exclusions, market, source policy and budget. The primary action starts a discovery job only after the brief validates.

### Job progress

Shows durable state, current step, attempts, limitations, elapsed time and cost. Partial and failed states explain what remains usable.

### Opportunity list

Each row/card shows:

- company;
- observed signal/event/problem;
- evidence count and freshness;
- offer/ICP fit dimensions;
- assessment state;
- confidence and limitations;
- human review state.

Do not show email, send, copy-message or delivery controls.

### Opportunity detail

Recommended order:

1. observed condition;
2. why it may matter commercially;
3. evidence with source and capture time;
4. company resolution and uncertainty;
5. assessment dimensions;
6. known limitations;
7. accept, reject or needs-research action with reason.

### Evidence viewer

Clearly separate source excerpt/structured fact from model interpretation. Unsafe URLs never render as executable content. Long artifacts require signed access.

## States

- `QUALIFY`: accent outline, never a guarantee.
- `REVIEW`: warning treatment.
- `REJECT`: muted neutral treatment unless a security/policy error occurred.
- `INSUFFICIENT_EVIDENCE`: info treatment with missing requirements.
- Human `ACCEPTED`, `REJECTED`, `NEEDS_RESEARCH`: distinct from model assessment.

## Accessibility

- WCAG AA contrast for text and controls.
- Full keyboard operation and visible focus.
- Status never communicated by color alone.
- Evidence/source labels are screen-reader accessible.
- Loading and job progress use live regions without excessive announcements.
