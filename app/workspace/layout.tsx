import Sidebar from "@/components/workspace/Sidebar";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
