import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Sidebar from "@/components/workspace/Sidebar";
import WorkspaceOpportunityEntry from "@/components/workspace/WorkspaceOpportunityEntry";

function isLoopbackHost(value: string | null): boolean {
  if (!value) return false;
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(`http://${value}`).hostname);
  } catch {
    return false;
  }
}

export default async function WorkspaceEntryFixturePage() {
  const requestHeaders = await headers();
  if (process.env.NODE_ENV === "production" || process.env.INTENTLEAD_E2E_FIXTURES !== "1"
    || !isLoopbackHost(requestHeaders.get("host"))) notFound();

  return (
    <div className="flex min-h-screen flex-col md:flex-row" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <main className="min-w-0 flex-1">
        <p className="sr-only">Authenticated workspace fixture</p>
        <WorkspaceOpportunityEntry />
      </main>
    </div>
  );
}
