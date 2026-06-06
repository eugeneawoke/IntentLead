"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LeadCard } from "@/components/leads/LeadCard";
import type { Lead } from "@/types/lead";

export default function CampaignDashboard() {
  const { id } = useParams<{ id: string }>();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  async function loadLeads() {
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
    try {
      const res = await fetch(
        `/api/leads?campaignId=${encodeURIComponent(id)}&status=verified`
      );
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const json = (await res.json()) as {
        success: boolean;
        data?: { leads: Lead[]; total: number };
      };
      if (json.success && json.data) {
        setLeads(json.data.leads);
        setTotal(json.data.total);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
    const poller = setInterval(loadLeads, 5000);
    return () => clearInterval(poller);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="p-8" style={{ maxWidth: 900 }}>
      <div className="mb-8">
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
