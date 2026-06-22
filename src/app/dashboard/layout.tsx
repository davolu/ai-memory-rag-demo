import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { Sidebar } from "@/components/sidebar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={{ name: user.name, email: user.email }} />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
