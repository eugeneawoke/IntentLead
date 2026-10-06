import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { applyTaskDMigration, asRole, bootstrapTask8Database, sql } from "./task8-db";
import { insertUsers } from "./task4-db";

const enabled = Boolean(process.env.INTENTLEAD_TEST_DATABASE_URL);
const owner = randomUUID();
const company = randomUUID();
const eventOpportunity = randomUUID();
const visibilityOpportunity = randomUUID();
const websiteOpportunity = randomUUID();
const assessment = randomUUID();

function quote(value: unknown): string {
  return JSON.stringify(value).replaceAll("'", "''");
}

describe.skipIf(!enabled)("Task D signal taxonomy upgrade", () => {
  beforeAll(async () => {
    await bootstrapTask8Database();
    await insertUsers(owner);
    const command = {
      schemaVersion: 1,
      offer: { name: "Upgrade offer", summary: "Upgrade fixture", outcomes: [], exclusions: [] },
      icp: { name: "Upgrade ICP", description: "Upgrade fixture companies", companyAttributes: [], exclusions: [] },
      objective: "Upgrade legacy signal rows",
      criteria: {
        jurisdictions: [], languages: ["en"], signalFamilies: ["EXPRESSED_INTENT"],
        exclusions: [], limits: { maxSourceItems: 10, maxOpportunities: 5 },
      },
    };
    const created = JSON.parse(await sql(asRole("authenticated", `SELECT public.intentlead_create_discovery_brief(
      '${quote(command)}'::jsonb,'taxonomy-upgrade-${randomUUID()}'
    )`, owner))) as { workspaceId: string; discoveryBriefId: string };
    const evidenceIds = [randomUUID(), randomUUID(), randomUUID()];
    await sql(`
      BEGIN;
      SET CONSTRAINTS ALL DEFERRED;
      ALTER TABLE public.intentlead_opportunities DROP CONSTRAINT IF EXISTS intentlead_opportunity_signal_v1_check;
      ALTER TABLE public.intentlead_opportunity_assessments DROP CONSTRAINT IF EXISTS intentlead_assessment_signal_v1_check;
      INSERT INTO public.intentlead_companies(id,workspace_id,canonical_name,domain,confidence)
      VALUES ('${company}','${created.workspaceId}','Upgrade Company','upgrade.example',.9);
      INSERT INTO public.intentlead_evidence_items(
        id,workspace_id,evidence_type,captured_at,excerpt,structured_facts,verification_method,
        confidence,content_hash,provenance
      ) VALUES
        ('${evidenceIds[0]}','${created.workspaceId}','structured_fact',now(),'Legacy event evidence','{}','migration_fixture',.9,repeat('a',64),'${quote({ sourceType: "WEB", sourceId: randomUUID(), providerRunId: null, rawArtifactId: null })}'),
        ('${evidenceIds[1]}','${created.workspaceId}','structured_fact',now(),'Legacy visibility evidence','{}','migration_fixture',.9,repeat('b',64),'${quote({ sourceType: "WEB", sourceId: randomUUID(), providerRunId: null, rawArtifactId: null })}'),
        ('${evidenceIds[2]}','${created.workspaceId}','structured_fact',now(),'Legacy website evidence','{}','migration_fixture',.9,repeat('c',64),'${quote({ sourceType: "WEB", sourceId: randomUUID(), providerRunId: null, rawArtifactId: null })}');
      INSERT INTO public.intentlead_opportunities(id,workspace_id,discovery_brief_id,company_id,state,signal)
      VALUES
        ('${eventOpportunity}','${created.workspaceId}','${created.discoveryBriefId}','${company}','DISCOVERED','{"family":"TRIGGER_EVENT","subtype":"hiring"}'),
        ('${visibilityOpportunity}','${created.workspaceId}','${created.discoveryBriefId}','${company}','DISCOVERED','{"family":"VISIBILITY_FINDING","subtype":"competitor_overtake"}'),
        ('${websiteOpportunity}','${created.workspaceId}','${created.discoveryBriefId}','${company}','DISCOVERED','{"family":"DETECTED_PROBLEM","subtype":"website"}');
      INSERT INTO public.intentlead_opportunity_evidence(workspace_id,opportunity_id,evidence_id) VALUES
        ('${created.workspaceId}','${eventOpportunity}','${evidenceIds[0]}'),
        ('${created.workspaceId}','${visibilityOpportunity}','${evidenceIds[1]}'),
        ('${created.workspaceId}','${websiteOpportunity}','${evidenceIds[2]}');
      INSERT INTO public.intentlead_opportunity_assessments(
        id,workspace_id,opportunity_id,version,decision,signal,problem_type,problem_statement,
        evidence_strength,explicitness,urgency,freshness,commercial_impact,icp_fit,company_confidence,
        buyer_relevance,actionability,confidence,rejection_reasons,review_reasons,assessed_at
      ) VALUES (
        '${assessment}','${created.workspaceId}','${eventOpportunity}',1,'REVIEW',
        '{"family":"TRIGGER_EVENT","subtype":"hiring"}','operations','Legacy assessment',
        .8,.8,.8,.8,.8,.8,.9,.7,.8,.8,ARRAY[]::text[],ARRAY['POLICY_REVIEW_REQUIRED'],now()
      );
      INSERT INTO public.intentlead_assessment_evidence(workspace_id,assessment_id,opportunity_id,evidence_id)
      VALUES ('${created.workspaceId}','${assessment}','${eventOpportunity}','${evidenceIds[0]}');
      COMMIT;
    `);
    await applyTaskDMigration();
  }, 60_000);

  it("rewrites every persisted legacy family/subtype before enabling strict constraints", async () => {
    expect(await sql(`SELECT (signal->>'family') || ':' || (signal->>'subtype') FROM public.intentlead_opportunities WHERE id='${eventOpportunity}'`)).toBe("BUSINESS_EVENT:hiring");
    expect(await sql(`SELECT (signal->>'family') || ':' || (signal->>'subtype') FROM public.intentlead_opportunities WHERE id='${visibilityOpportunity}'`)).toBe("MARKET_OBSERVATION:competitor_change");
    expect(await sql(`SELECT (signal->>'family') || ':' || (signal->>'subtype') FROM public.intentlead_opportunities WHERE id='${websiteOpportunity}'`)).toBe("DETECTED_PROBLEM:market_presence");
    expect(await sql(`SELECT (signal->>'family') || ':' || (signal->>'subtype') FROM public.intentlead_opportunity_assessments WHERE id='${assessment}'`)).toBe("BUSINESS_EVENT:hiring");
    await expect(sql(`UPDATE public.intentlead_opportunities SET signal='{"family":"TRIGGER_EVENT","subtype":"hiring"}' WHERE id='${eventOpportunity}'`)).rejects.toThrow(/intentlead_opportunity_signal_v1_check/);
  });
});
