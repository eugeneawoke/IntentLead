import { OpportunityAssessmentSchema, OpportunitySchema } from "../../lib/domain/schemas/opportunity";
import { classifySignal, validateAssessmentGrounding } from "../../lib/domain/evidence-policy";
import { evaluateOpportunityPolicy } from "../../lib/domain/opportunity-policy";
import type { JobHandler, JobHandlerResult } from "../jobs/worker";
import type { CapabilityError } from "../../types/job";
import type { SelfProspectingDependencies, SelfProspectingPersistInput } from "../../types/self-prospecting";
import {
  afterCall, assertNotAborted, buildCompanyEvidence, canCall, capabilityError, deduplicateSignals,
  candidateExternalStepKey, incompleteInput, makeObservation, providerId, providerRows, sourceCandidateKey,
  sourceTypeForProvider, uniqueRuns,
} from "./self-prospecting-helpers";
import { buildDiscoveryFunnel, sourceRunMetrics } from "./self-prospecting-funnel";
import { buildOpportunityAssessmentInput } from "./self-prospecting-prompt";
import { validateSelfProspectingContext } from "./self-prospecting-validation";
export { OPPORTUNITY_ASSESSMENT_SYSTEM_CONTRACT } from "./self-prospecting-prompt";
export function createSelfProspectingHandler(dependencies: SelfProspectingDependencies): JobHandler {
  const { policy } = dependencies;
  return async (job, execution): Promise<JobHandlerResult> => {
    const validated = validateSelfProspectingContext(job, await dependencies.loadContext(job));
    if (!validated) {
      return { state: "COMPLETED", result: { outcome: "POLICY_DENIED", opportunityIds: [] }, error: null };
    }
    const { profile, brief, offer, icp } = validated;
    if (dependencies.assessmentEngine.configuredCost.amount !== policy.assessmentCost.amount
      || dependencies.assessmentEngine.configuredCost.currency !== policy.assessmentCost.currency) {
      throw new Error("assessment engine cost does not match the configured workflow policy");
    }
    assertNotAborted(execution.signal);
    await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "VALIDATED" });
    let remainingBudget = dependencies.initialBudget(job);
    const search = await execution.runExternalOperation(
      "SOURCE_SEARCH", () => dependencies.registry,
      (registry, signal) => registry.search({ job, profile, brief, signal, budget: remainingBudget }),
    );
    assertNotAborted(execution.signal);
    if (search.error && search.signals.length === 0) {
      if (search.error.code === "BUDGET_EXCEEDED") {
        return { state: "COMPLETED", result: { outcome: "BUDGET_EXHAUSTED", opportunityIds: [] }, error: null };
      }
      throw search.error;
    }
    if (!Array.isArray(search.signals)) throw new Error("source registry returned no signal list");
    remainingBudget = search.remainingBudget;
    await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "SOURCE_SEARCH", count: search.signals.length });
    const deduplicated = deduplicateSignals(search.signals);
    const signals = deduplicated.slice(0, Math.min(policy.maxCandidates, brief.limits.maxOpportunities));
    const allIds: string[] = [];
    const candidateCounts = { HUMAN_REVIEW: 0, MODEL_REJECTED: 0, INSUFFICIENT_EVIDENCE: 0 };
    const recordCandidate = (id: string, state: string) => {
      if (!Object.prototype.hasOwnProperty.call(candidateCounts, state)) throw new Error("stored self-prospecting candidate has an invalid state");
      allIds.push(id);
      candidateCounts[state as keyof typeof candidateCounts]++;
    };
    const reasons: string[] = [];
    const sourceMetrics = sourceRunMetrics([
      ...search.providerRuns,
    ]);
    const sourceRuns = uniqueRuns(providerRows(sourceMetrics.envelopes, "SOURCE_SEARCH"));
    let confirmedSignals = 0;
    const uniqueCompanies = new Set<string>();
    let budgetError: CapabilityError | null = null;

    for (const signal of signals) {
      assertNotAborted(execution.signal);
      const candidateKey = sourceCandidateKey(signal);
      const candidateIdentity = `${job.id}:${candidateKey}`;
      const previous = await dependencies.persistence.findCandidate(job, candidateKey);
      if (previous) {
        if (previous.signalConfirmed) confirmedSignals++;
        if (previous.companyIdentity) uniqueCompanies.add(previous.companyIdentity);
        recordCandidate(previous.opportunityId, previous.state);
        continue;
      }
      const provider = providerId(signal.source);
      const sourceRun = sourceRuns.find(run => run.provider === provider);
      if (!sourceRun) throw new Error("signal provider run is missing from its registry result");
      const provenance = sourceRun.provenance.find(item => (
        item.providerSourceId === signal.externalId && item.sourceUrl === signal.sourceUrl
      ));
      if (!provenance) throw new Error("signal provenance does not match its provider run");
      const capturedAt = provenance.capturedAt;
      const sourceId = dependencies.idFactory.create("source-item", candidateIdentity);
      const evidenceId = dependencies.idFactory.create("signal-evidence", candidateIdentity);
      const sourceEvidence = makeObservation({
        id: sourceId, evidenceId, workspaceId: job.workspaceId, provider, providerRunId: sourceRun.id,
        externalId: signal.externalId, sourceUrl: signal.sourceUrl, content: signal.content,
        capturedAt, publishedAt: signal.publishedAt, confidence: 0.8, sourceType: sourceTypeForProvider(provider),
      });
      await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "EVIDENCE_CONSTRUCTED", candidateKey });
      assertNotAborted(execution.signal);
      const classified = classifySignal(sourceEvidence.evidence.excerpt ?? "")?.signal;
      if (!classified) {
        reasons.push("SIGNAL_TOO_WEAK");
        await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "SIGNAL_REJECTED", candidateKey });
        continue;
      }
      const currentTime = dependencies.now().getTime();
      if (signal.publishedAt && Date.parse(signal.publishedAt) > currentTime) {
        reasons.push("SIGNAL_FUTURE_DATED");
        await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "SIGNAL_REJECTED", candidateKey, reason: "SIGNAL_FUTURE_DATED" });
        continue;
      }
      if (!brief.signalFamilies.includes(classified.family)) {
        const candidate = incompleteInput({
          job, signal, classified, sources: [sourceEvidence.source], evidence: [sourceEvidence.evidence],
          policyReasons: ["SIGNAL_FAMILY_UNSUPPORTED"], idFactory: dependencies.idFactory, now: dependencies.now(),
        });
        await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "PERSISTENCE", candidateKey });
        const id = await dependencies.persistence.persistCandidate(job, { ...candidate, providerRuns: sourceRuns });
        recordCandidate(id, candidate.opportunity.state);
        await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "PERSISTED", opportunityId: id });
        continue;
      }

      const signalMaxAge = policy.maxSignalAgeDays[classified.family] ?? 30;
      const ageDays = signal.publishedAt ? (currentTime - Date.parse(signal.publishedAt)) / 86_400_000 : Infinity;
      if (!Number.isFinite(ageDays) || ageDays > signalMaxAge) {
        const candidate = incompleteInput({
          job, signal, classified, sources: [sourceEvidence.source], evidence: [sourceEvidence.evidence],
          policyReasons: ["SIGNAL_TOO_OLD"], idFactory: dependencies.idFactory, now: dependencies.now(),
        });
        await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "PERSISTENCE", candidateKey });
        const id = await dependencies.persistence.persistCandidate(job, { ...candidate, providerRuns: sourceRuns });
        recordCandidate(id, candidate.opportunity.state);
        await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "PERSISTED", opportunityId: id });
        continue;
      }
      confirmedSignals++;

      if (!canCall(remainingBudget, { amount: 0, currency: remainingBudget.currency })) {
        budgetError = capabilityError(job, "BUDGET_EXCEEDED");
        break;
      }
      const companyResult = await execution.runExternalOperation(
        "COMPANY_RESOLUTION", () => dependencies.registry,
        (registry, signalAbort) => registry.resolveCompany({
          job, profile, brief, signal: signalAbort, budget: remainingBudget, signalContent: sourceEvidence.evidence.excerpt ?? "",
        }),
        candidateExternalStepKey("COMPANY_RESOLUTION", candidateKey),
      );
      assertNotAborted(execution.signal);
      if (!companyResult.execution.ok) {
        if (companyResult.execution.error.code === "BUDGET_EXCEEDED") {
          budgetError = companyResult.execution.error;
          break;
        }
        throw companyResult.execution.error;
      }
      remainingBudget = companyResult.execution.remainingBudget;
      const companyRuns = uniqueRuns(providerRows([
        ...companyResult.providerRuns, companyResult.execution.outcome, ...(companyResult.execution.outcome.relatedRuns ?? []),
      ], "COMPANY_RESOLUTION"));
      if (companyResult.execution.outcome.status === "PARTIAL"
        && companyResult.execution.outcome.capabilityError?.code === "BUDGET_EXCEEDED") {
        budgetError = companyResult.execution.outcome.capabilityError;
        const candidate = incompleteInput({
          job, signal, classified, sources: [sourceEvidence.source], evidence: [sourceEvidence.evidence],
          policyReasons: ["INSUFFICIENT_EVIDENCE"], idFactory: dependencies.idFactory, now: dependencies.now(),
        });
        await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "PERSISTENCE", candidateKey });
        const id = await dependencies.persistence.persistCandidate(job, {
          ...candidate, providerRuns: uniqueRuns([...sourceRuns, ...companyRuns]),
        });
        recordCandidate(id, candidate.opportunity.state);
        await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "PERSISTED", opportunityId: id });
        break;
      }
      if (companyResult.execution.outcome.status === "PARTIAL") {
        const candidate = incompleteInput({
          job, signal, classified, sources: [sourceEvidence.source], evidence: [sourceEvidence.evidence],
          policyReasons: ["COMPANY_UNCERTAIN"], idFactory: dependencies.idFactory, now: dependencies.now(),
        });
        await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "PERSISTENCE", candidateKey });
        const id = await dependencies.persistence.persistCandidate(job, {
          ...candidate, providerRuns: uniqueRuns([...sourceRuns, ...companyRuns]),
        });
        recordCandidate(id, candidate.opportunity.state);
        await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "PERSISTED", opportunityId: id });
        continue;
      }
      if (!Array.isArray(companyResult.execution.outcome.value)) throw new Error("company registry returned no candidate list");
      await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "COMPANY_RESOLUTION", candidateKey });

      const match = companyResult.execution.outcome.value.length === 1 ? companyResult.execution.outcome.value[0] : null;
      const { candidateEvidence, candidateSources, resolvedCompany, supportedMatch: companyIsSupported } = buildCompanyEvidence({
        candidateKey, candidateIdentity, workspaceId: job.workspaceId, match, companyRuns,
        baseEvidence: [sourceEvidence.evidence], baseSources: [sourceEvidence.source],
        idFactory: dependencies.idFactory, policy,
      });
      await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "COMPANY_EVIDENCE_CONSTRUCTED", candidateKey });
      assertNotAborted(execution.signal);
      if (!resolvedCompany) {
        const policyReason = match && !companyIsSupported ? "WRONG_COMPANY" : "COMPANY_UNCERTAIN";
        const candidate = incompleteInput({
          job, signal, classified, sources: candidateSources, evidence: candidateEvidence,
          policyReasons: [policyReason], idFactory: dependencies.idFactory, now: dependencies.now(),
        });
        await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "PERSISTENCE", candidateKey });
        const id = await dependencies.persistence.persistCandidate(job, {
          ...candidate, providerRuns: uniqueRuns([...sourceRuns, ...companyRuns]), sourceItems: candidateSources,
          evidenceItems: candidateEvidence,
        });
        recordCandidate(id, candidate.opportunity.state);
        await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "PERSISTED", opportunityId: id });
        continue;
      }
      uniqueCompanies.add(resolvedCompany.domain ?? resolvedCompany.id);

      if (!canCall(remainingBudget, dependencies.assessmentEngine.configuredCost)) {
        budgetError = capabilityError(job, "BUDGET_EXCEEDED");
        break;
      }
      const evidenceForModel = candidateEvidence.map(item => ({ id: item.id, excerpt: item.excerpt, structuredFacts: item.structuredFacts }));
      const modelInput = buildOpportunityAssessmentInput({
        offer, icp, discoveryObjective: brief.objective, exclusions: brief.exclusions,
        signal: sourceEvidence.evidence.excerpt, evidence: evidenceForModel,
      });
      const assessment = await execution.runExternalOperation(
        "OPPORTUNITY_ASSESSMENT", () => dependencies.assessmentEngine,
        (engine, signalAbort) => engine.assess(modelInput, { jobId: job.id, signal: signalAbort, traceId: job.traceId }),
        candidateExternalStepKey("OPPORTUNITY_ASSESSMENT", candidateKey),
      );
      assertNotAborted(execution.signal);
      await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "OPPORTUNITY_ASSESSMENT", candidateKey });
      remainingBudget = afterCall(remainingBudget, dependencies.assessmentEngine.configuredCost);
      const proposal = validateAssessmentGrounding(assessment.output, evidenceForModel);
      const run = assessment.run;
      if (run.provider !== "openai" || run.status !== "SUCCEEDED" || run.cost.configuredAmount !== dependencies.assessmentEngine.configuredCost.amount
        || run.cost.currency !== dependencies.assessmentEngine.configuredCost.currency) {
        throw new Error("assessment engine run did not match its configured registry budget");
      }
      const evaluation = evaluateOpportunityPolicy({
        signal: classified, publishedAt: signal.publishedAt, now: dependencies.now(),
        companyConfidence: resolvedCompany.confidence, assessment: proposal, policy,
      });
      await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "POLICY_DECISION", candidateKey, decision: evaluation.decision });
      assertNotAborted(execution.signal);
      const opportunityId = dependencies.idFactory.create("opportunity", candidateIdentity);
      const assessmentId = dependencies.idFactory.create("assessment", candidateIdentity);
      const assessedAt = dependencies.now().toISOString();
      const assessmentReasons = [...new Set([
        ...evaluation.reasons,
        ...(proposal.decision === "REVIEW" ? proposal.reviewReasons : []),
      ])];
      const domainAssessment = OpportunityAssessmentSchema.parse({
        schemaVersion: 1, id: assessmentId, workspaceId: job.workspaceId, opportunityId,
        assessedAt, modelRunId: run.providerRunId, decision: evaluation.decision,
        signal: classified, problemType: proposal.problemType, problemStatement: proposal.problemStatement,
        evidenceStrength: proposal.evidenceStrength, explicitness: proposal.explicitness,
        urgency: proposal.urgency, freshness: evaluation.freshness,
        commercialImpact: proposal.commercialImpact, icpFit: proposal.icpFit,
        companyConfidence: resolvedCompany.confidence, buyerRelevance: proposal.buyerRelevance,
        actionability: proposal.actionability, confidence: proposal.confidence,
        evidenceIds: proposal.evidenceIds,
        rejectionReasons: evaluation.decision === "REJECT" ? proposal.rejectionReasons : [],
        reviewReasons: evaluation.decision === "REVIEW" ? assessmentReasons : [],
      });
      const createdAt = dependencies.now().toISOString();
      const opportunity = OpportunitySchema.parse({
        schemaVersion: 1, id: opportunityId, workspaceId: job.workspaceId, discoveryBriefId: brief.id,
        marketProfileId: "EN_DISCOVERY_ONLY", jurisdiction: null, signal: classified,
        evidenceIds: candidateEvidence.map(item => item.id), state: evaluation.state,
        companyId: resolvedCompany.id, assessmentId, createdAt, updatedAt: createdAt,
      });
      const assessmentRuns = providerRows([run], "OPPORTUNITY_ASSESSMENT");
      const persist: SelfProspectingPersistInput = {
        schemaVersion: 1, candidateKey, modelDecision: proposal.decision, groundedClaims: proposal.groundedClaims,
        policyReasons: evaluation.reasons, providerRuns: uniqueRuns([...sourceRuns, ...companyRuns, ...assessmentRuns]),
        sourceItems: candidateSources, evidenceItems: candidateEvidence,
        company: resolvedCompany, opportunity, assessment: domainAssessment,
      };
      await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "PERSISTENCE", candidateKey });
      const resultId = await dependencies.persistence.persistCandidate(job, persist);
      recordCandidate(resultId, evaluation.state);
      await execution.checkpoint({ workflow: "SELF_PROSPECTING_V1", step: "PERSISTED", opportunityId: resultId });
    }

    if (budgetError) {
      const funnel = buildDiscoveryFunnel({
        rawCandidates: sourceMetrics.rawCandidates, normalizedCandidates: sourceMetrics.normalizedCandidates,
        deduplicatedSignals: deduplicated.length, processedSignals: signals.length, confirmedSignals,
        uniqueCompanies: uniqueCompanies.size, opportunitiesReturned: allIds.length, acceptedOpportunities: null,
      });
      if (allIds.length) return { state: "PARTIAL", result: { outcome: "BUDGET_EXHAUSTED", opportunityIds: allIds, funnel }, error: budgetError };
      return { state: "COMPLETED", result: { outcome: "BUDGET_EXHAUSTED", opportunityIds: [], reason: "BUDGET_EXCEEDED", funnel }, error: null };
    }
    const funnel = buildDiscoveryFunnel({
      rawCandidates: sourceMetrics.rawCandidates, normalizedCandidates: sourceMetrics.normalizedCandidates,
      deduplicatedSignals: deduplicated.length, processedSignals: signals.length, confirmedSignals,
      uniqueCompanies: uniqueCompanies.size, opportunitiesReturned: allIds.length, acceptedOpportunities: null,
    });
    return { state: "COMPLETED", result: {
        outcome: candidateCounts.HUMAN_REVIEW ? "REVIEW_READY" : candidateCounts.MODEL_REJECTED
          ? "MODEL_REJECTED" : allIds.length || reasons.length ? "INSUFFICIENT_EVIDENCE" : "NO_SIGNALS",
        opportunityIds: allIds, candidateCounts, reasons, funnel,
      }, error: null };
  };
}
export { authorizeSelfProspectingCapability } from "../../lib/domain/opportunity-policy";
