import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Shell } from "@/components/layout/Shell";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <Shell
      initialUser={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }}
    />
  );
}
