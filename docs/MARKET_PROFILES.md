# Market profiles

A MarketProfile selects language, geography, available evidence sources, provider access rules, retention and cost policy without scattering country conditionals through code.

`EN_DISCOVERY_ONLY` is the first profile. It allows only discovery, evidence, company resolution, Opportunity assessment and review using authorized zero-spend inputs. It does not authorize personal-data enrichment, messages, billing or external action.

A future profile must declare:

- market and language;
- source capabilities and access classification;
- retention and deletion rules;
- budget ceiling;
- evidence/freshness policy;
- disabled capabilities.

Website business-context extraction, local directories or regional sources are selected capabilities, not hard-coded market stages.
