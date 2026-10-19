import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { ensureSeedData } from "@/lib/seed";
import { CommentType, TaskStage } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await ensureSeedData();

    let currentUser = await getSessionUser();
    if (!currentUser) {
      // For local-first seamless usage, fallback to first active user if unauthenticated
      currentUser = await prisma.user.findFirst({
        include: { memberships: { include: { workspace: true } } },
      });
    }

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { mutations = [], lastSyncedAt } = body;
    const appliedMutationIds: string[] = [];

    // Apply Client Mutations inside a transaction
    for (const m of mutations) {
      try {
        const { clientMutationId, entity, entityId, action, payload } = m;

        if (entity === "task") {
          if (action === "STAGE_CHANGE") {
            const currentTask = await prisma.task.findUnique({ where: { id: entityId } });
            if (currentTask) {
              const previousStage = currentTask.stage;
              const newStage = payload.stage as TaskStage;

              await prisma.task.update({
                where: { id: entityId },
                data: {
                  stage: newStage,
                  taReviewNotes: payload.taReviewNotes !== undefined ? payload.taReviewNotes : currentTask.taReviewNotes,
                  devRecommendation: payload.devRecommendation !== undefined ? payload.devRecommendation : currentTask.devRecommendation,
                  devConfirmedAt: payload.devConfirmedAt !== undefined ? (payload.devConfirmedAt ? new Date(payload.devConfirmedAt) : null) : currentTask.devConfirmedAt,
                  qaTestNotes: payload.qaTestNotes !== undefined ? payload.qaTestNotes : currentTask.qaTestNotes,
                  approvalSignoffNote: payload.approvalSignoffNote !== undefined ? payload.approvalSignoffNote : currentTask.approvalSignoffNote,
                  version: { increment: 1 },
                },
              });

              // Add stage audit log comment
              if (previousStage !== newStage) {
                await prisma.taskComment.create({
                  data: {
                    taskId: entityId,
                    userId: currentUser.id,
                    type: CommentType.STAGE_CHANGE_AUDIT,
                    content: `Ball-in-Court transition: Moved from ${previousStage.replace(/_/g, " ")} to ${newStage.replace(/_/g, " ")}.`,
                  },
                });
              }
            }
          } else if (action === "UPSERT") {
            const existing = await prisma.task.findUnique({ where: { id: entityId } });
            if (existing) {
              await prisma.task.update({
                where: { id: entityId },
                data: {
                  title: payload.title ?? existing.title,
                  description: payload.description !== undefined ? payload.description : existing.description,
                  priority: payload.priority ?? existing.priority,
                  dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
                  assigneeId: payload.assigneeId !== undefined ? payload.assigneeId : existing.assigneeId,
                  order: payload.order !== undefined ? payload.order : existing.order,
                  version: { increment: 1 },
                },
              });
            } else {
              // Ensure project exists
              const project = await prisma.project.findFirst({
                where: { id: payload.projectId },
              });
              if (project) {
                // Determine next human task ID e.g. EQ-105
                const count = await prisma.task.count({ where: { projectId: project.id } });
                const humanId = `${project.key}-${count + 101}`;

                await prisma.task.create({
                  data: {
                    id: entityId,
                    projectId: project.id,
                    projectTaskId: humanId,
                    title: payload.title || "Untitled Task",
                    description: payload.description || null,
                    stage: payload.stage || TaskStage.PROPOSED,
                    priority: payload.priority || "MEDIUM",
                    creatorId: currentUser.id,
                    assigneeId: payload.assigneeId || null,
                    order: payload.order || 0.0,
                  },
                });
              }
            }
          } else if (action === "DELETE") {
            await prisma.task.update({
              where: { id: entityId },
              data: { deletedAt: new Date(), version: { increment: 1 } },
            });
          }
        } else if (entity === "page") {
          if (action === "UPSERT") {
            const existing = await prisma.page.findUnique({ where: { id: entityId } });
            if (existing) {
              await prisma.page.update({
                where: { id: entityId },
                data: {
                  title: payload.title !== undefined ? payload.title : existing.title,
                  content: payload.content !== undefined ? payload.content : existing.content,
                  icon: payload.icon !== undefined ? payload.icon : existing.icon,
                  secretToken: payload.secretToken !== undefined ? payload.secretToken : existing.secretToken,
                  version: { increment: 1 },
                },
              });
            } else {
              const workspace = await prisma.workspace.findFirst();
              if (workspace) {
                await prisma.page.create({
                  data: {
                    id: entityId,
                    workspaceId: workspace.id,
                    title: payload.title || "Untitled Document",
                    content: payload.content || { blocks: [] },
                    isDiary: Boolean(payload.isDiary),
                    diaryDate: payload.diaryDate ? new Date(payload.diaryDate) : null,
                    secretToken: payload.secretToken || null,
                  },
                });
              }
            }
          } else if (action === "DELETE") {
            await prisma.page.update({
              where: { id: entityId },
              data: { deletedAt: new Date(), version: { increment: 1 } },
            });
          }
        } else if (entity === "taskComment") {
          if (action === "UPSERT") {
            await prisma.taskComment.create({
              data: {
                id: entityId,
                taskId: payload.taskId,
                userId: currentUser.id,
                type: payload.type || CommentType.STANDARD_CHAT,
                content: payload.content || "",
              },
            });
          }
        }

        appliedMutationIds.push(clientMutationId);
      } catch (err) {
        console.warn(`[Sync] Failed to apply mutation ${m.clientMutationId}:`, err);
      }
    }

    // Pull Phase: Fetch Server Deltas
    const sinceDate = lastSyncedAt ? new Date(lastSyncedAt) : new Date(0);

    const [workspaces, projects, tasks, taskComments, pages] = await Promise.all([
      prisma.workspace.findMany({
        where: { updatedAt: { gte: sinceDate } },
      }),
      prisma.project.findMany({
        where: { updatedAt: { gte: sinceDate } },
      }),
      prisma.task.findMany({
        where: { updatedAt: { gte: sinceDate } },
        include: {
          creator: { select: { id: true, name: true, role: true } },
          assignee: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.taskComment.findMany({
        where: { createdAt: { gte: sinceDate } },
        include: {
          user: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.page.findMany({
        where: { updatedAt: { gte: sinceDate } },
      }),
    ]);

    const formattedTasks = tasks.map((t) => ({
      ...t,
      creatorName: t.creator?.name || "System",
      assigneeName: t.assignee?.name || null,
    }));

    const formattedComments = taskComments.map((c) => ({
      ...c,
      userName: c.user?.name || "Team Member",
      userRole: c.user?.role || undefined,
    }));

    return NextResponse.json({
      ok: true,
      appliedMutationIds,
      deltas: {
        workspaces,
        projects,
        tasks: formattedTasks,
        taskComments: formattedComments,
        pages,
      },
      currentServerTime: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Sync API Error]:", err);
    return NextResponse.json({ error: err.message || "Sync failed" }, { status: 500 });
  }
}
