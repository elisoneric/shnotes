import { AdminAuthGate } from "@/components/admin/AdminAuthGate";

export const dynamic = "force-dynamic";

export default function AdminRoutePage() {
  return <AdminAuthGate />;
}

