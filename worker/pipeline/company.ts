import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface CompanyResult {
  companyName: string | null;
  companyDomain: string | null;
}

async function searchWithExa(query: string): Promise<string | null> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        query,
        type: "neural",
        numResults: 3,
        useAutoprompt: true,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { results: Array<{ title: string; url: string; text?: string }> };
    return data.results.map((r) => `${r.title} — ${r.url}`).join("\n");
  } catch {
    return null;
  }
}

async function searchWithSerper(query: string): Promise<string | null> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
      body: JSON.stringify({ q: query, num: 3 }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { organic: Array<{ title: string; link: string; snippet: string }> };
    return data.organic.map((r) => `${r.title} — ${r.link}: ${r.snippet}`).join("\n");
  } catch {
    return null;
  }
}

const COMPANY_SYSTEM = `Extract company name and domain from the provided search results and signal context.
Return JSON: { "companyName": string | null, "companyDomain": string | null, "confidence": number }
Only return a company if confidence >= 0.7. Return null values if uncertain.
Domain should be just the root domain (e.g. "acme.com", not "https://www.acme.com/page").`;

export async function identifyCompany(authorHandle: string, signalContent: string): Promise<CompanyResult> {
  // Try Exa first (primary), fallback to SERPER
  const searchResults =
    await searchWithExa(`${authorHandle} company professional profile`) ??
    await searchWithSerper(`${authorHandle} company LinkedIn`);

  if (!searchResults) return { companyName: null, companyDomain: null };

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: COMPANY_SYSTEM },
      {
        role: "user",
        content: `Author: ${authorHandle}\nSignal: ${signalContent.slice(0, 500)}\nSearch results:\n${searchResults}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 150,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as {
      companyName?: string;
      companyDomain?: string;
      confidence?: number;
    };
    if ((parsed.confidence ?? 0) < 0.7) return { companyName: null, companyDomain: null };
    return {
      companyName: parsed.companyName ?? null,
      companyDomain: parsed.companyDomain ?? null,
    };
  } catch {
    return { companyName: null, companyDomain: null };
  }
}
