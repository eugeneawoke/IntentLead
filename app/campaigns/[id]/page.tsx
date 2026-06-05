"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LeadCard } from "@/components/leads/LeadCard";
import type { Lead } from "@/types/lead";

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  async function loadLeads() {
    const res = await fetch(`/api/leads?campaignId=${id}&status=verified`);
    const json = await res.json() as { success: boolean; data?: { leads: Lead[]; total: number } };
    if (json.success && json.data) {
      setLeads(json.data.leads);
      setTotal(json.data.total);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadLeads();
    // Poll for updates while campaign might be running
    const poller = setInterval(loadLeads, 5000);
    return () => clearInterval(poller);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <main style={{ background: "var(--bg)", minHeight: "100vh", padding: "32px 24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ color: "var(--text)", fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
            Campaign Leads
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            {loading ? "Loading..." : `${total} verified leads`}
          </p>
        </div>

        {loading ? (
          <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 48 }}>Loading leads...</div>
        ) : leads.length === 0 ? (
          <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 48 }}>
            No verified leads yet. Pipeline may still be running.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
