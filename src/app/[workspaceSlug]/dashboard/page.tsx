import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Shell } from "@/components/layout/Shell";

export const dynamic = "force-dynamic";

export default async function WorkspaceDashboardRoutePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { workspaceSlug } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    include: {
      members: {
        where: { userId: user.id },
      },
    },
  });

  if (!workspace) {
    redirect("/app");
  }

  const membership = workspace.members[0];
  const userRole = membership?.role || user.role;

  return (
    <Shell
      initialUser={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: userRole,
      }}
      initialView="DASHBOARD"
    />
  );
}
