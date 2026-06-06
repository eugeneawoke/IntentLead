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
      className="flex h-screen"
      style={{ background: "var(--bg)", overflow: "hidden" }}
    >
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
