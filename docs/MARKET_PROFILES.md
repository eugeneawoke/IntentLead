# Market profiles

A `MarketProfile` selects language, geography, evidence sources, contact providers, access rules, retention and budget without scattering country conditionals through code.

## First profile: `EN_DISCOVERY_ONLY`

This compatibility id describes the first English self-prospecting workflow. “Discovery only” means no external action, not “no useful contact package”. It allows:

- multi-source discovery and source planning;
- evidence capture and company resolution;
- Opportunity assessment;
- buyer resolution;
- public/authorized business-contact discovery and verification;
- evidence-grounded conversation brief/draft;
- human review and copy/export.

It denies:

- mailbox connection;
- message transmission;
- sequences and follow-ups;
- delivery/reply tracking;
- billing mutation;
- unapproved paid calls.

## Target profile families

| Profile | Language/geography | Typical source families | Notes |
|---|---|---|---|
| `GLOBAL_EN` | English/global | web/search, communities, developer sources, jobs, reviews, news | provider access varies by jurisdiction |
| `CIS` | Russian and regional languages | Yandex surfaces, 2GIS, public Telegram/VK, vc.ru, Habr, directories, regional jobs/news | no assumption of an official API |
| `RU` | Russia | CIS capability subset plus Russia-specific policy | legal/access review required per provider |
| `BY` | Belarus | regional search/directories/news plus accessible CIS sources | provider availability may differ from RU |
| `KZ` | Kazakhstan | regional search/maps/directories plus accessible CIS sources | language and locality settings required |
| `LOCAL_CUSTOM` | one city/category | maps, listings, reviews, official sites, directories, local news | concrete offer-relevant observations only |

## Required declarations

Every profile declares:

- market, languages and geography;
- business types and allowed signal families;
- source capabilities and access classification;
- contact capabilities and allowed data classes;
- per-signal freshness policy;
- retention, deletion and suppression rules;
- budget ceiling and free-tier policy;
- unavailable/disabled capabilities;
- no-send invariant.

Website evidence, local directories and AI-answer observations are selectable capabilities, not mandatory product stages.
