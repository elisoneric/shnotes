import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { WorkspaceSettings } from "@/components/settings/WorkspaceSettings";

export const dynamic = "force-dynamic";

export default async function WorkspaceSettingsPage({
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

  // Accessible by Workspace OWNER and HOO
  if (userRole !== "OWNER" && userRole !== "HOO" && !user.isSystemAdmin) {
    redirect("/app");
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white dark:bg-zinc-950">
      <WorkspaceSettings
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
        workspaceName={workspace.name}
        currentUserRole={userRole}
      />
    </div>
  );
}
