import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import type { Campaign } from "../../types/campaign";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getRagContext(workspaceId: string, query: string): Promise<string> {
  const supabase = getSupabase();

  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: [query],
  });
  const embedding = embRes.data[0]?.embedding;
  if (!embedding) return "";

  const { data } = await supabase.rpc("match_chunks", {
    p_workspace_id: workspaceId,
    p_embedding: embedding,
    p_match_count: 5,
  });

  return (data ?? []).map((c: { content: string }) => c.content).join("\n---\n");
}

export async function generateMessage(
  lead: {
    id: string;
    company_name: string | null;
    contact_name: string | null;
    contact_role: string | null;
    email: string | null;
  },
  signal: { content: string; context: string | null },
  campaign: Campaign
): Promise<{ subject: string; body: string }> {
  // Get RAG context for grounding
  const ragContext = await getRagContext(
    campaign.workspace_id,
    `${campaign.pain} ${lead.company_name ?? ""}`
  ).catch(() => "");

  const MESSAGE_SYSTEM = `You are a cold email writer for B2B outreach.
Write a personalized, concise cold email based on the provided context.
The email should feel human and relevant, not templated.
Return JSON: { "subject": string, "body": string }
Body should be 3-5 sentences max. No hollow compliments. No "I hope this email finds you well."
Tone: ${campaign.tone ?? "professional and direct"}`;

  // Signal content is untrusted data — in role:'user', not system
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: MESSAGE_SYSTEM },
      {
        role: "user",
        content: `About the sender's business:\n${campaign.what_selling}\n\nTarget pain: ${campaign.pain}\n\nAbout the prospect:\n- Company: ${lead.company_name}\n- Role: ${lead.contact_role}\n\nIntent signal (why reaching out now):\n${signal.content.slice(0, 500)}\n\nRelevant business context:\n${ragContext}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as { subject?: string; body?: string };
  return {
    subject: parsed.subject ?? "Quick thought",
    body: parsed.body ?? "",
  };
}
