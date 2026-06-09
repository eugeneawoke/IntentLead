import { streamText } from "ai";
import { openai as aiOpenai } from "@ai-sdk/openai";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getServiceClient } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/ratelimit";
import { ONBOARDING_SYSTEM_PROMPT } from "@/lib/ai/prompts/onboarding";
import { PLAN_SYSTEM_PROMPT } from "@/lib/ai/prompts/plan";
import { STRATEGY_SYSTEM_PROMPT } from "@/lib/ai/prompts/strategy";
import { extractIntakeTool } from "@/lib/ai/tools/extractIntake";
import { offerScanTool } from "@/lib/ai/tools/offerScan";
import { getGlookContext, buildWarmContext } from "@/lib/glook/report";
import { upsertChunks } from "@/lib/rag/embed";
import { err } from "@/lib/utils/response";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";

type ChatMode = "search" | "plan" | "strategy";

const DAILY_LIMITS: Record<string, number> = {
  free: 20,
  starter: 100,
  growth: 300,
  agency: Infinity,
  starter_ltd: 100,
  growth_ltd: 300,
};

function isPastMidnightUTC(resetAt: string | null): boolean {
  if (!resetAt) return true;
  const reset = new Date(resetAt);
  const nowUtc = new Date();
  const lastMidnight = new Date(
    Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate())
  );
  return reset < lastMidnight;
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  if (!(await checkRateLimit(`chat:${user!.id}`, 30, 60_000))) {
    return NextResponse.json(err("Rate limit exceeded"), { status: 429 });
  }

  let body: {
    conversationId?: string;
    message?: string;
    messages?: Array<{ role: string; content: string }>;
    scanId?: string;
    mode?: ChatMode;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON"), { status: 400 });
  }

  // Support both body.message (legacy) and body.messages[last].content (AI SDK v4)
  const userMessage: string | undefined =
    body.message ??
    body.messages?.findLast((m) => m.role === "user")?.content;

  if (!userMessage || typeof userMessage !== "string") {
    return NextResponse.json(err("message is required"), { status: 400 });
  }

  const mode: ChatMode = body.mode ?? "search";

  // Get or create workspace — select fields needed for credit/limit checks
  const supabase = getServiceClient();
  let { data: workspace } = await supabase
    .from("workspaces")
    .select("id, plan, credits_remaining, chat_messages_today, chat_messages_reset_at")
    .eq("owner_id", user!.id)
    .single();

  if (!workspace) {
    const { data: newWs } = await supabase
      .from("workspaces")
      .insert({ owner_id: user!.id, name: "My Workspace" })
      .select("id, plan, credits_remaining, chat_messages_today, chat_messages_reset_at")
      .single();
    workspace = newWs;
  }

  if (!workspace) {
    return NextResponse.json(err("Failed to get workspace"), { status: 500 });
  }

  // --- Mode-specific guards ---
  if (mode === "search") {
    if ((workspace.credits_remaining ?? 0) <= 0) {
      return NextResponse.json(
        err("No credits remaining. Upgrade your plan to continue searching."),
        { status: 402 }
      );
    }
  } else {
    // plan / strategy — check daily message limit
    const plan = workspace.plan ?? "free";
    const limit = DAILY_LIMITS[plan] ?? DAILY_LIMITS.free;

    // Reset counter if past UTC midnight
    let messagesUsed: number = workspace.chat_messages_today ?? 0;
    if (isPastMidnightUTC(workspace.chat_messages_reset_at ?? null)) {
      messagesUsed = 0;
      // Reset fire-and-forget — don't block response
      void supabase
        .from("workspaces")
        .update({
          chat_messages_today: 0,
          chat_messages_reset_at: new Date().toISOString(),
        })
        .eq("id", workspace.id)
        .then(({ error }) => {
          if (error) {
            logger.warn({ workspaceId: workspace!.id, error: error.message }, "Failed to reset daily message counter");
          }
        });
    }

    // Atomic increment: PostgreSQL UPDATE with WHERE guard — only succeeds if under limit.
    // Returns 0 rows when already at/over limit, preventing races between concurrent requests.
    const { data: incRows, error: incErr } = await supabase
      .from("workspaces")
      .update({ chat_messages_today: messagesUsed + 1 })
      .eq("id", workspace.id)
      .lte("chat_messages_today", limit - 1)
      .select("id");

    if (incErr || !incRows || incRows.length === 0) {
      return NextResponse.json(
        err("Daily message limit reached. Limit resets at midnight UTC."),
        { status: 429 }
      );
    }
  }

  // Load conversation history
  let messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (body.conversationId) {
    // IDOR guard: verify conversation belongs to this workspace before loading
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", body.conversationId)
      .eq("workspace_id", workspace.id)
      .single();
    if (!conv) {
      return NextResponse.json(err("Conversation not found"), { status: 404 });
    }

    const { data: history } = await supabase
      .from("conversation_messages")
      .select("role, content")
      .eq("conversation_id", body.conversationId)
      .order("created_at", { ascending: true });
    messages = (history ?? []) as typeof messages;
  }

  // Warm entry: inject Glook context as first assistant message (user role — NOT in system prompt)
  if (body.scanId && messages.length === 0) {
    const glookCtx = await getGlookContext(body.scanId);
    if (glookCtx) {
      const warmContext = buildWarmContext(glookCtx);
      // Store Glook context as RAG chunks
      await upsertChunks(workspace.id, [
        { content: warmContext, source: "glook_report" },
      ]).catch((e) =>
        logger.warn({ error: String(e) }, "Failed to store Glook RAG chunks")
      );

      // Inject as context in messages — NOT in system prompt
      messages.push({
        role: "user",
        content: `[Context from website scan]\n${warmContext}`,
      });
      messages.push({
        role: "assistant",
        content:
          "I've reviewed your website context. Now, who are you looking to reach — what's the ideal profile of your target customer?",
      });
    }
  }

  // Append current user message
  messages.push({ role: "user", content: userMessage });

  // Save user message to conversation history
  if (body.conversationId) {
    void Promise.resolve(
      supabase.from("conversation_messages").insert({
        conversation_id: body.conversationId,
        role: "user",
        content: userMessage,
      })
    ).catch((e) =>
      logger.warn(
        { conversationId: body.conversationId, error: String(e) },
        "Failed to save conversation message"
      )
    );
  }

  const workspaceId = workspace.id;

  // Select system prompt and tools based on mode
  const systemPrompt =
    mode === "plan"
      ? PLAN_SYSTEM_PROMPT
      : mode === "strategy"
      ? STRATEGY_SYSTEM_PROMPT
      : ONBOARDING_SYSTEM_PROMPT;

  const tools =
    mode === "search"
      ? {
          extract_intake: extractIntakeTool(user!.id, workspaceId),
          offer_scan: offerScanTool(),
        }
      : undefined;

  const result = streamText({
    model: aiOpenai("gpt-4o-mini"),
    system: systemPrompt,
    messages,
    ...(tools ? { tools, maxSteps: 3 } : {}),
    onFinish: async ({ text }) => {
      // Save assistant response
      if (body.conversationId && text) {
        void Promise.resolve(
          supabase.from("conversation_messages").insert({
            conversation_id: body.conversationId,
            role: "assistant",
            content: text,
          })
        ).catch((e) =>
          logger.warn(
            { conversationId: body.conversationId, error: String(e) },
            "Failed to save conversation message"
          )
        );

        // Store meaningful assistant responses as RAG chunks
        if (text.length > 50) {
          await upsertChunks(workspaceId, [
            { content: text, source: "chat" },
          ]).catch((e) =>
            logger.warn(
              { workspaceId, error: String(e) },
              "Failed to save RAG chunks"
            )
          );
        }
      }
    },
  });

  return result.toDataStreamResponse();
}
