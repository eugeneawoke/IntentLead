import type { Campaign } from "../../types/campaign";
import type { CreateSignalInput } from "../../types/signal";

function log(level: string, meta: Record<string, unknown>, msg: string) {
  process.stdout.write(JSON.stringify({ level, ts: new Date().toISOString(), msg, ...meta }) + "\n");
}

async function fetchRedditSignals(keywords: string[], campaignId: string): Promise<CreateSignalInput[]> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    log("warn", { campaignId }, "Reddit credentials not configured");
    return [];
  }

  const signals: CreateSignalInput[] = [];

  try {
    // Get Reddit access token
    const tokenRes = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "User-Agent": "IntentLeadAI/1.0",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenRes.ok) {
      log("warn", { campaignId, status: tokenRes.status }, "Reddit auth failed");
      return [];
    }

    const { access_token } = await tokenRes.json() as { access_token: string };

    for (const keyword of keywords.slice(0, 5)) {
      try {
        const searchRes = await fetch(
          `https://oauth.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=new&limit=25&type=link,comment`,
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
              "User-Agent": "IntentLeadAI/1.0",
            },
          }
        );

        if (!searchRes.ok) continue;

        const data = await searchRes.json() as {
          data: {
            children: Array<{
              data: {
                url: string;
                author: string;
                title?: string;
                selftext?: string;
                subreddit: string;
                created_utc: number;
              };
            }>;
          };
        };

        for (const item of data.data.children) {
          const post = item.data;
          signals.push({
            campaign_id: campaignId,
            source: "reddit",
            source_url: post.url,
            author_handle: post.author,
            content: [post.title, post.selftext].filter(Boolean).join("\n").slice(0, 2000),
            context: post.subreddit,
            posted_at: new Date(post.created_utc * 1000).toISOString(),
          });
        }

        // Respect Reddit rate limit
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        log("warn", { campaignId, keyword, err: String(err) }, "Reddit keyword search failed");
      }
    }
  } catch (err) {
    log("warn", { campaignId, err: String(err) }, "Reddit fetch failed");
  }

  return signals;
}

async function fetchHNSignals(keywords: string[], campaignId: string): Promise<CreateSignalInput[]> {
  const signals: CreateSignalInput[] = [];

  for (const keyword of keywords.slice(0, 5)) {
    try {
      const res = await fetch(
        `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(keyword)}&tags=comment,story&hitsPerPage=20`
      );
      if (!res.ok) continue;

      const data = await res.json() as {
        hits: Array<{
          objectID: string;
          url?: string;
          author: string;
          comment_text?: string;
          title?: string;
          story_title?: string;
          created_at: string;
        }>;
      };

      for (const hit of data.hits) {
        const url = hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`;
        signals.push({
          campaign_id: campaignId,
          source: "hackernews",
          source_url: url,
          author_handle: hit.author,
          content: [hit.title ?? hit.story_title, hit.comment_text].filter(Boolean).join("\n").slice(0, 2000),
          context: hit.story_title ?? "HN",
          posted_at: hit.created_at,
        });
      }
    } catch (err) {
      log("warn", { campaignId, keyword, err: String(err) }, "HN keyword search failed");
    }
  }

  return signals;
}

export async function fetchSignals(campaign: Campaign): Promise<CreateSignalInput[]> {
  const [reddit, hn] = await Promise.all([
    fetchRedditSignals(campaign.keywords, campaign.id),
    fetchHNSignals(campaign.keywords, campaign.id),
  ]);
  return [...reddit, ...hn];
}
