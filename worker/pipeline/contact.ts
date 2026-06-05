const DECISION_MAKER_ROLES = [
  "founder", "co-founder", "ceo", "cto", "cmo", "coo", "cpo",
  "head of growth", "head of sales", "head of marketing",
  "vp of sales", "vp marketing", "director of growth",
  "growth lead", "sales director", "marketing director",
];

export interface ContactResult {
  isDecisionMaker: boolean;
  contactName: string | null;
  contactRole: string | null;
  linkedinUrl: string | null;
}

async function lookupLinkedIn(
  companyDomain: string,
  authorHandle: string
): Promise<{ name?: string; role?: string; linkedinUrl?: string } | null> {
  // Use Exa for LinkedIn profile search
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        query: `${authorHandle} ${companyDomain} linkedin.com/in`,
        type: "neural",
        numResults: 1,
        includeDomains: ["linkedin.com"],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { results: Array<{ title: string; url: string }> };
    if (!data.results[0]) return null;

    // Extract role from LinkedIn title (format: "Name - Role at Company | LinkedIn")
    const title = data.results[0].title;
    const roleMatch = title.match(/[-–]\s*([^|]+?)\s+at\s+/i);
    const nameMatch = title.match(/^([^-–|]+)/);

    return {
      name: nameMatch?.[1]?.trim() ?? undefined,
      role: roleMatch?.[1]?.trim() ?? undefined,
      linkedinUrl: data.results[0].url,
    };
  } catch {
    return null;
  }
}

export async function verifyContact(companyDomain: string, authorHandle: string): Promise<ContactResult> {
  const profile = await lookupLinkedIn(companyDomain, authorHandle);

  if (!profile?.role) {
    return { isDecisionMaker: false, contactName: null, contactRole: null, linkedinUrl: null };
  }

  const roleLower = profile.role.toLowerCase();
  const isDecisionMaker = DECISION_MAKER_ROLES.some((r) => roleLower.includes(r));

  return {
    isDecisionMaker,
    contactName: profile.name ?? null,
    contactRole: profile.role ?? null,
    linkedinUrl: profile.linkedinUrl ?? null,
  };
}
