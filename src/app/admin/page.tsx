import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SystemAdminPage } from "@/components/admin/SystemAdminPage";

export const dynamic = "force-dynamic";

export default async function AdminRoutePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  if (!user.isSystemAdmin && user.role !== "OWNER") {
    redirect("/app");
  }

  return <SystemAdminPage />;
}
