import Sidebar from "@/components/workspace/Sidebar";
import { requireUserSC } from "@/lib/auth/requireUserSC";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUserSC();
  return (
    <div
      className="flex min-h-screen flex-col md:h-screen md:flex-row md:overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      <Sidebar />
      <main className="min-w-0 flex-1 md:min-h-0 md:overflow-y-auto">{children}</main>
    </div>
  );
}
