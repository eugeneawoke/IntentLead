import { streamText } from "ai";
import { openai as aiOpenai } from "@ai-sdk/openai";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/requireUser";
import { getServiceClient } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/ratelimit";
import { ONBOARDING_SYSTEM_PROMPT } from "@/lib/ai/prompts/onboarding";
import { extractIntakeTool } from "@/lib/ai/tools/extractIntake";
import { offerScanTool } from "@/lib/ai/tools/offerScan";
import { getGlookContext, buildWarmContext } from "@/lib/glook/report";
import { upsertChunks } from "@/lib/rag/embed";
import { err } from "@/lib/utils/response";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (response) return response;

  if (!checkRateLimit(`chat:${user!.id}`, 30, 60_000)) {
    return NextResponse.json(err("Rate limit exceeded"), { status: 429 });
  }

  let body: {
    conversationId?: string;
    message: string;
    scanId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("Invalid JSON"), { status: 400 });
  }

  if (!body.message || typeof body.message !== "string") {
    return NextResponse.json(err("message is required"), { status: 400 });
  }

  // Get or create workspace
  const supabase = getServiceClient();
  let { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user!.id)
    .single();

  if (!workspace) {
    const { data: newWs } = await supabase
      .from("workspaces")
      .insert({ owner_id: user!.id, name: "My Workspace" })
      .select()
      .single();
    workspace = newWs;
  }

  if (!workspace) {
    return NextResponse.json(err("Failed to get workspace"), { status: 500 });
  }

  // Load conversation history
  let messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (body.conversationId) {
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
      ]).catch((e) => logger.warn({ error: String(e) }, "Failed to store Glook RAG chunks"));

      // Inject as context in messages — NOT in system prompt
      messages.push({
        role: "user",
        content: `[Context from website scan]\n${warmContext}`,
      });
      messages.push({
        role: "assistant",
        content: "I've reviewed your website context. Now, who are you looking to reach — what's the ideal profile of your target customer?",
      });
    }
  }

  // Append current user message
  messages.push({ role: "user", content: body.message });

  // Save user message to conversation history
  if (body.conversationId) {
    void Promise.resolve(
      supabase.from("conversation_messages").insert({
        conversation_id: body.conversationId,
        role: "user",
        content: body.message,
      })
    ).catch((e) => logger.warn({ conversationId: body.conversationId, error: String(e) }, "Failed to save conversation message"));
  }

  const workspaceId = workspace.id;

  const result = streamText({
    model: aiOpenai("gpt-4o-mini"),
    system: ONBOARDING_SYSTEM_PROMPT, // FIXED — never includes user input
    messages,
    tools: {
      extract_intake: extractIntakeTool(user!.id, workspaceId),
      offer_scan: offerScanTool(),
    },
    maxSteps: 3,
    onFinish: async ({ text }) => {
      // Save assistant response
      if (body.conversationId && text) {
        void Promise.resolve(
          supabase.from("conversation_messages").insert({
            conversation_id: body.conversationId,
            role: "assistant",
            content: text,
          })
        ).catch((e) => logger.warn({ conversationId: body.conversationId, error: String(e) }, "Failed to save conversation message"));

        // Store meaningful assistant responses as RAG chunks
        if (text.length > 50) {
          await upsertChunks(workspaceId, [
            { content: text, source: "chat" },
          ]).catch((e) => logger.warn({ workspaceId, error: String(e) }, "Failed to save RAG chunks"));
        }
      }
    },
  });

  return result.toDataStreamResponse();
}
