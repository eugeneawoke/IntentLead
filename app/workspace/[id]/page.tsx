"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LeadCard } from "@/components/leads/LeadCard";
import type { Lead } from "@/types/lead";

export default function CampaignDashboard() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setLeads([]);
    setTotal(0);
    try {
      const res = await fetch(
        `/api/leads?campaignId=${encodeURIComponent(id)}&status=verified`
      );
      const json = await res.json().catch(() => null) as {
        success?: boolean;
        code?: string;
        data?: { leads: Lead[]; total: number };
      } | null;
      if (res.status === 403 && json?.code === "POLICY_DENIED") {
        router.replace("/workspace/opportunities");
        return;
      }
      if (!res.ok) {
        setError("Could not load leads. Try again.");
        return;
      }
      if (json?.success && json.data) {
        setLeads(json.data.leads);
        setTotal(json.data.total);
      } else {
        setError("Could not load leads. Try again.");
      }
    } catch {
      setError("Could not load leads. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  return (
    <div className="p-8" style={{ maxWidth: 900 }}>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
        <h1
          style={{
            color: "var(--text)",
            fontSize: 24,
            fontWeight: 600,
            marginBottom: 6,
            letterSpacing: "-0.02em",
            fontFamily: "Geist, sans-serif",
          }}
        >
          Campaign Leads
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          {loading ? "Loading..." : `${total} verified leads`}
        </p>
        </div>
        <button type="button" onClick={() => void loadLeads()} disabled={loading} className="min-h-11 rounded-lg border px-4 text-sm disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <p role="alert" className="mb-4 text-sm" style={{ color: "var(--error)" }}>{error}</p>}

      {loading ? (
        <p
          style={{ color: "var(--text-muted)", textAlign: "center", padding: 48 }}
        >
          Loading leads...
        </p>
      ) : leads.length === 0 ? (
        <p
          style={{ color: "var(--text-muted)", textAlign: "center", padding: 48 }}
        >
          No verified leads yet. Pipeline may still be running.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      )}
    </div>
  );
}
