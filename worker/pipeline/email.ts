import type { EmailProvider } from "../../types/lead";

function log(level: string, meta: Record<string, unknown>, msg: string) {
  process.stdout.write(JSON.stringify({ level, ts: new Date().toISOString(), msg, ...meta }) + "\n");
}

export interface EmailResult {
  email: string | null;
  provider: EmailProvider | null;
}

async function findWithProspeo(name: string, domain: string): Promise<string | null> {
  const apiKey = process.env.PROSPEO_API_KEY;
  if (!apiKey) return null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.prospeo.io/email-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-KEY": apiKey },
        body: JSON.stringify({ full_name: name, company: domain }),
      });

      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      if (!res.ok) return null;

      const data = await res.json() as {
        error: boolean;
        email?: { value: string; verification?: { status: string } };
      };
      if (data.error || !data.email?.value) return null;
      // Only return verified emails
      if (data.email.verification?.status === "INVALID") return null;
      return data.email.value;
    } catch {
      return null;
    }
  }
  return null;
}

async function findWithHunter(name: string, domain: string): Promise<string | null> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return null;

  const [firstName, ...rest] = name.split(" ");
  const lastName = rest.join(" ");

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const params = new URLSearchParams({
        first_name: firstName,
        last_name: lastName,
        domain,
        api_key: apiKey,
      });
      const res = await fetch(`https://api.hunter.io/v2/email-finder?${params}`);

      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      if (!res.ok) return null;

      const data = await res.json() as {
        data?: { email?: string; verification?: { status: string } };
      };
      if (!data.data?.email) return null;
      if (data.data.verification?.status === "invalid") return null;
      return data.data.email;
    } catch {
      return null;
    }
  }
  return null;
}

async function findWithApollo(name: string, domain: string): Promise<string | null> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return null;

  const [firstName, ...rest] = name.split(" ");
  const lastName = rest.join(" ");

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.apollo.io/v1/people/match", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          domain,
          reveal_personal_emails: false,
        }),
      });

      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      if (!res.ok) return null;

      const data = await res.json() as { person?: { email?: string } };
      // Apollo email may need additional verification — provider noted for display
      return data.person?.email ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function findEmail(contactName: string, companyDomain: string): Promise<EmailResult> {
  // Strict waterfall: Prospeo → Hunter → Apollo
  const prospeoEmail = await findWithProspeo(contactName, companyDomain);
  if (prospeoEmail) {
    log("info", { provider: "prospeo" }, "Email found via Prospeo");
    return { email: prospeoEmail, provider: "prospeo" };
  }

  const hunterEmail = await findWithHunter(contactName, companyDomain);
  if (hunterEmail) {
    log("info", { provider: "hunter" }, "Email found via Hunter");
    return { email: hunterEmail, provider: "hunter" };
  }

  const apolloEmail = await findWithApollo(contactName, companyDomain);
  if (apolloEmail) {
    log("info", { provider: "apollo" }, "Email found via Apollo");
    return { email: apolloEmail, provider: "apollo" };
  }

  return { email: null, provider: null };
}
