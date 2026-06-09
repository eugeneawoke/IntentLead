import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * CRITICAL: Tests that verify_lead_and_charge_credit is called atomically
 * and that credit_charged=true is impossible when status != 'verified'
 *
 * Strategy: mock @supabase/supabase-js + all pipeline steps, then call the
 * real runPipeline() function. processLead() is exercised through runPipeline.
 */

// ── Supabase mock ─────────────────────────────────────────────────────────────
// Must be declared before vi.mock() calls (hoisting).

const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });

const CAMPAIGN = {
  id: "campaign-1",
  workspace_id: "ws-1",
  keywords: ["crm"],
  sources: ["reddit"],
  status: "pending",
};

const SIGNAL = {
  id: "signal-1",
  campaign_id: "campaign-1",
  content: "Looking for a CRM tool",
  context: null,
  author_handle: "test_user",
  source_url: "https://reddit.com/r/test/1",
  source: "reddit",
  score: 0,
};

function buildSupabaseMock() {
  return {
    rpc: mockRpc,
    from: (table: string) => {
      if (table === "campaigns") {
        return {
          select: () => ({
            eq: () => ({ single: vi.fn().mockResolvedValue({ data: CAMPAIGN, error: null }) }),
          }),
          update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === "signals") {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
          // runPipeline does: await supabase.from("signals").select("*").eq(...)
          select: () => ({
            eq: vi.fn().mockResolvedValue({ data: [SIGNAL], error: null }),
          }),
        };
      }
      if (table === "leads") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { id: "lead-1" }, error: null }),
            })),
          })),
          update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === "messages") {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {
        select: () => ({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }),
        update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
    },
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => buildSupabaseMock(),
}));

// ── Pipeline step mocks ───────────────────────────────────────────────────────

const mockClassify = vi.fn();
const mockIdentifyCompany = vi.fn();
const mockVerifyContact = vi.fn();
const mockFindEmail = vi.fn();
const mockGenerateMessage = vi.fn();
const mockFetchSignals = vi.fn();

vi.mock("@/worker/pipeline/classify", () => ({ classifySignal: mockClassify }));
vi.mock("@/worker/pipeline/company", () => ({ identifyCompany: mockIdentifyCompany }));
vi.mock("@/worker/pipeline/contact", () => ({ verifyContact: mockVerifyContact }));
vi.mock("@/worker/pipeline/email", () => ({ findEmail: mockFindEmail }));
vi.mock("@/worker/pipeline/message", () => ({ generateMessage: mockGenerateMessage }));
vi.mock("@/worker/pipeline/signals", () => ({ fetchSignals: mockFetchSignals }));

// ── Defaults ──────────────────────────────────────────────────────────────────

const ALL_GREEN_L1 = { score: 90, intentType: "buying_signal" };
const ALL_GREEN_L2 = { companyName: "Acme Corp", companyDomain: "acme.com" };
const ALL_GREEN_L3 = { isDecisionMaker: true, contactName: "Jane", contactRole: "CTO", linkedinUrl: null };
const ALL_GREEN_L4 = { email: "jane@acme.com", provider: "prospeo" };

function setupAllGreen() {
  mockFetchSignals.mockResolvedValue([SIGNAL]);
  mockClassify.mockResolvedValue(ALL_GREEN_L1);
  mockIdentifyCompany.mockResolvedValue(ALL_GREEN_L2);
  mockVerifyContact.mockResolvedValue(ALL_GREEN_L3);
  mockFindEmail.mockResolvedValue(ALL_GREEN_L4);
  mockGenerateMessage.mockResolvedValue({ subject: "Quick note", body: "Hi Jane..." });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Credit atomicity invariant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  it("RPC called exactly once when all 4 verification steps pass", async () => {
    setupAllGreen();
    const { runPipeline } = await import("@/worker/pipeline/runner");
    await runPipeline("campaign-1");

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("verify_lead_and_charge_credit", {
      p_lead_id: "lead-1",
      p_workspace_id: "ws-1",
    });
  });

  it("RPC NOT called when L1 classify returns score < 80", async () => {
    mockFetchSignals.mockResolvedValue([SIGNAL]);
    mockClassify.mockResolvedValue({ score: 45, intentType: "noise" });

    const { runPipeline } = await import("@/worker/pipeline/runner");
    await runPipeline("campaign-1");

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockIdentifyCompany).not.toHaveBeenCalled();
  });

  it("RPC NOT called when L2 company identification fails (no domain)", async () => {
    mockFetchSignals.mockResolvedValue([SIGNAL]);
    mockClassify.mockResolvedValue(ALL_GREEN_L1);
    mockIdentifyCompany.mockResolvedValue({ companyName: null, companyDomain: null });

    const { runPipeline } = await import("@/worker/pipeline/runner");
    await runPipeline("campaign-1");

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockVerifyContact).not.toHaveBeenCalled();
  });

  it("RPC NOT called when L3 contact is not a decision maker", async () => {
    mockFetchSignals.mockResolvedValue([SIGNAL]);
    mockClassify.mockResolvedValue(ALL_GREEN_L1);
    mockIdentifyCompany.mockResolvedValue(ALL_GREEN_L2);
    mockVerifyContact.mockResolvedValue({
      isDecisionMaker: false,
      contactName: "Bob",
      contactRole: "Intern",
      linkedinUrl: null,
    });

    const { runPipeline } = await import("@/worker/pipeline/runner");
    await runPipeline("campaign-1");

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockFindEmail).not.toHaveBeenCalled();
  });

  it("RPC NOT called when L4 email lookup returns null", async () => {
    mockFetchSignals.mockResolvedValue([SIGNAL]);
    mockClassify.mockResolvedValue(ALL_GREEN_L1);
    mockIdentifyCompany.mockResolvedValue(ALL_GREEN_L2);
    mockVerifyContact.mockResolvedValue(ALL_GREEN_L3);
    mockFindEmail.mockResolvedValue({ email: null, provider: null });

    const { runPipeline } = await import("@/worker/pipeline/runner");
    await runPipeline("campaign-1");

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("lead stays unverified when RPC itself returns an error", async () => {
    setupAllGreen();
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "insufficient_credits" } });

    const { runPipeline } = await import("@/worker/pipeline/runner");
    await runPipeline("campaign-1");

    // RPC was attempted once but errored — no second call
    expect(mockRpc).toHaveBeenCalledTimes(1);
    // Message generation must NOT run after failed RPC
    expect(mockGenerateMessage).not.toHaveBeenCalled();
  });

  it("message generation failure does NOT prevent credit charge (RPC still called)", async () => {
    vi.useFakeTimers();
    setupAllGreen();
    mockGenerateMessage.mockRejectedValue(new Error("OpenAI timeout"));

    const { runPipeline } = await import("@/worker/pipeline/runner");
    const pipelinePromise = runPipeline("campaign-1");

    // Advance through all 3 retry delays (1 s + 2 s + 4 s)
    await vi.runAllTimersAsync();
    await pipelinePromise;
    vi.useRealTimers();

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("verify_lead_and_charge_credit", expect.any(Object));
  });
});
