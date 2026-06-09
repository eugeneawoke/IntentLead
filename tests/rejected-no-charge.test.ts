import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * CRITICAL: Rejected leads must NEVER have credit_charged=true
 * Tests each rejection point in the pipeline by calling the real runPipeline()
 * with mocked pipeline steps and a mocked Supabase client.
 *
 * The mocked supabase RPC is captured here so we can assert it was never called.
 */

// ── Supabase mock (same pattern as credit-atomicity.test.ts) ─────────────────

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Rejected lead — no credit charge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockFetchSignals.mockResolvedValue([SIGNAL]);
  });

  it("L1 rejection: score < 80 — RPC not called, pipeline stops at classify", async () => {
    mockClassify.mockResolvedValue({ score: 72, intentType: "noise" });

    const { runPipeline } = await import("@/worker/pipeline/runner");
    await runPipeline("campaign-1");

    expect(mockRpc).not.toHaveBeenCalled();
    // None of the downstream steps should run
    expect(mockIdentifyCompany).not.toHaveBeenCalled();
    expect(mockVerifyContact).not.toHaveBeenCalled();
    expect(mockFindEmail).not.toHaveBeenCalled();
  });

  it("L2 rejection: no company found — RPC not called", async () => {
    mockClassify.mockResolvedValue({ score: 85, intentType: "buying_signal" });
    mockIdentifyCompany.mockResolvedValue({ companyName: null, companyDomain: null });

    const { runPipeline } = await import("@/worker/pipeline/runner");
    await runPipeline("campaign-1");

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockVerifyContact).not.toHaveBeenCalled();
    expect(mockFindEmail).not.toHaveBeenCalled();
  });

  it("L2 rejection: company found but no domain — RPC not called", async () => {
    mockClassify.mockResolvedValue({ score: 85, intentType: "buying_signal" });
    mockIdentifyCompany.mockResolvedValue({ companyName: "Acme Corp", companyDomain: null });

    const { runPipeline } = await import("@/worker/pipeline/runner");
    await runPipeline("campaign-1");

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("L3 rejection: not decision maker — RPC not called", async () => {
    mockClassify.mockResolvedValue({ score: 85, intentType: "buying_signal" });
    mockIdentifyCompany.mockResolvedValue({ companyName: "Acme Corp", companyDomain: "acme.com" });
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

  it("L4 rejection: no email found — RPC not called", async () => {
    mockClassify.mockResolvedValue({ score: 85, intentType: "buying_signal" });
    mockIdentifyCompany.mockResolvedValue({ companyName: "Acme Corp", companyDomain: "acme.com" });
    mockVerifyContact.mockResolvedValue({
      isDecisionMaker: true,
      contactName: "Jane",
      contactRole: "CTO",
      linkedinUrl: null,
    });
    mockFindEmail.mockResolvedValue({ email: null, provider: null });

    const { runPipeline } = await import("@/worker/pipeline/runner");
    await runPipeline("campaign-1");

    expect(mockRpc).not.toHaveBeenCalled();
    // Message generation must not run either
    expect(mockGenerateMessage).not.toHaveBeenCalled();
  });

  it("no signals fetched — pipeline exits cleanly, RPC never called", async () => {
    mockFetchSignals.mockResolvedValue([]);

    const { runPipeline } = await import("@/worker/pipeline/runner");
    await runPipeline("campaign-1");

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockClassify).not.toHaveBeenCalled();
  });
});
