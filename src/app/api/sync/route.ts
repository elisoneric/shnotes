import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { ensureSeedData } from "@/lib/seed";
import { CommentType, TaskStage } from "@prisma/client";
import { recordDocumentEdit, processPendingDocumentNotifications } from "@/lib/notifications";
import { notifySyncClients } from "@/lib/syncEvents";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await ensureSeedData();

    const currentUser = await getSessionUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userMemberships = await prisma.workspaceMember.findMany({
      where: { userId: currentUser.id },
      select: { workspaceId: true },
    });
    const workspaceIds = userMemberships.map((m) => m.workspaceId);

    const pageCollaborations = await prisma.pageCollaborator.findMany({
      where: { userId: currentUser.id },
      select: { pageId: true },
    });
    const sharedPageIds = pageCollaborations.map((c) => c.pageId);

    if (workspaceIds.length === 0 && sharedPageIds.length === 0) {
      return NextResponse.json({ error: "User has no active workspace membership." }, { status: 403 });
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
              const newStage = payload.stage ? (payload.stage as TaskStage) : currentTask.stage;
              const newStageId = payload.stageId !== undefined ? payload.stageId : currentTask.stageId;

              await prisma.task.update({
                where: { id: entityId },
                data: {
                  stage: newStage,
                  stageId: newStageId,
                  order: payload.order !== undefined ? payload.order : currentTask.order,
                  taReviewNotes: payload.taReviewNotes !== undefined ? payload.taReviewNotes : currentTask.taReviewNotes,
                  devRecommendation: payload.devRecommendation !== undefined ? payload.devRecommendation : currentTask.devRecommendation,
                  devConfirmedAt: payload.devConfirmedAt !== undefined ? (payload.devConfirmedAt ? new Date(payload.devConfirmedAt) : null) : currentTask.devConfirmedAt,
                  qaTestNotes: payload.qaTestNotes !== undefined ? payload.qaTestNotes : currentTask.qaTestNotes,
                  approvalSignoffNote: payload.approvalSignoffNote !== undefined ? payload.approvalSignoffNote : currentTask.approvalSignoffNote,
                  signoffByName: payload.signoffByName !== undefined ? payload.signoffByName : currentTask.signoffByName,
                  version: { increment: 1 },
                },
              });

              // Add stage audit log comment
              if (previousStage !== newStage) {
                const stageName = newStage.replace(/_/g, " ").toLowerCase();
                await prisma.taskComment.create({
                  data: {
                    taskId: entityId,
                    userId: currentUser.id,
                    type: CommentType.STAGE_CHANGE_AUDIT,
                    content: `Status transition: Moved to ${stageName} by ${currentUser.name}.`,
                  },
                });
              }
            }
          } else if (action === "SIGNOFF_CHANGE") {
            const { taskId, userId, cleared, notes } = payload;
            await prisma.taskSignoff.upsert({
              where: {
                taskId_userId: { taskId: entityId, userId: userId || currentUser.id },
              },
              create: {
                taskId: entityId,
                userId: userId || currentUser.id,
                cleared: Boolean(cleared),
                notes: notes || null,
                clearedAt: cleared ? new Date() : null,
              },
              update: {
                cleared: Boolean(cleared),
                notes: notes !== undefined ? notes : undefined,
                clearedAt: cleared ? new Date() : null,
              },
            });
          } else if (action === "UPSERT") {
            const existing = await prisma.task.findUnique({ where: { id: entityId } });
            if (existing) {
              await prisma.task.update({
                where: { id: entityId },
                data: {
                  title: payload.title ?? existing.title,
                  description: payload.description !== undefined ? payload.description : existing.description,
                  priority: payload.priority ?? existing.priority,
                  stage: payload.stage ?? existing.stage,
                  stageId: payload.stageId !== undefined ? payload.stageId : existing.stageId,
                  dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
                  assigneeId: payload.assigneeId !== undefined ? payload.assigneeId : existing.assigneeId,
                  approverId: payload.approverId !== undefined ? payload.approverId : existing.approverId,
                  order: payload.order !== undefined ? payload.order : existing.order,
                  version: { increment: 1 },
                },
              });
            } else {
              const project = await prisma.project.findFirst({
                where: { id: payload.projectId },
              });
              if (project) {
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
                    stageId: payload.stageId || null,
                    priority: payload.priority || "MEDIUM",
                    creatorId: currentUser.id,
                    assigneeId: payload.assigneeId || null,
                    approverId: payload.approverId || null,
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
            const existing = await prisma.page.findFirst({
              where: {
                id: entityId,
                OR: [
                  { workspaceId: { in: workspaceIds } },
                  { id: { in: sharedPageIds } },
                ],
              },
            });
            if (existing) {
              await prisma.page.update({
                where: { id: entityId },
                data: {
                  title: payload.title !== undefined ? payload.title : existing.title,
                  content: payload.content !== undefined ? payload.content : existing.content,
                  icon: payload.icon !== undefined ? payload.icon : existing.icon,
                  layout: payload.layout !== undefined ? payload.layout : existing.layout,
                  fontFamily: payload.fontFamily !== undefined ? payload.fontFamily : existing.fontFamily,
                  fontSize: payload.fontSize !== undefined ? payload.fontSize : existing.fontSize,
                  secretToken: payload.secretToken !== undefined ? payload.secretToken : existing.secretToken,
                  isPrivate: payload.isPrivate !== undefined ? payload.isPrivate : existing.isPrivate,
                  isLocked: payload.isLocked !== undefined ? payload.isLocked : existing.isLocked,
                  version: { increment: 1 },
                },
              });

              // Record session for quiet-window consolidated change notifications
              recordDocumentEdit({
                pageId: entityId,
                editorId: currentUser.id,
                editorName: currentUser.name || currentUser.email,
              }).catch(() => {});
            } else {
              const targetWsId = payload.workspaceId && workspaceIds.includes(payload.workspaceId)
                ? payload.workspaceId
                : workspaceIds[0];

              if (targetWsId) {
                await prisma.page.create({
                  data: {
                    id: entityId,
                    workspaceId: targetWsId,
                    title: payload.title || "Untitled Document",
                    content: payload.content || { blocks: [] },
                    isDiary: Boolean(payload.isDiary),
                    diaryDate: payload.diaryDate ? new Date(payload.diaryDate) : null,
                    isPrivate: Boolean(payload.isPrivate),
                    isLocked: Boolean(payload.isLocked),
                    layout: payload.layout || "centered",
                    fontFamily: payload.fontFamily || "sans",
                    fontSize: payload.fontSize || "normal",
                    secretToken: payload.secretToken || null,
                  },
                });

                await prisma.pageCollaborator.upsert({
                  where: {
                    pageId_userId: {
                      pageId: entityId,
                      userId: currentUser.id,
                    },
                  },
                  create: {
                    pageId: entityId,
                    userId: currentUser.id,
                    role: "OWNER",
                  },
                  update: {},
                }).catch(() => {});
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
        } else if (entity === "project") {
          if (action === "UPSERT") {
            const existing = await prisma.project.findUnique({ where: { id: entityId } });
            if (existing) {
              await prisma.project.update({
                where: { id: entityId },
                data: {
                  name: payload.name !== undefined ? payload.name : existing.name,
                  description: payload.description !== undefined ? payload.description : existing.description,
                  colorAccent: payload.colorAccent !== undefined ? payload.colorAccent : existing.colorAccent,
                  ownerName: payload.ownerName !== undefined ? payload.ownerName : existing.ownerName,
                  guideName: payload.guideName !== undefined ? payload.guideName : existing.guideName,
                  version: { increment: 1 },
                },
              });
            } else {
              const targetWsId = payload.workspaceId && workspaceIds.includes(payload.workspaceId)
                ? payload.workspaceId
                : workspaceIds[0];

              if (targetWsId) {
                await prisma.project.create({
                  data: {
                    id: entityId,
                    name: payload.name || "Untitled Project",
                    key: payload.key || "PRJ",
                    description: payload.description || null,
                    colorAccent: payload.colorAccent || "#3b82f6",
                    workspaceId: targetWsId,
                    ownerName: payload.ownerName || currentUser.name,
                    guideName: payload.guideName || null,
                  },
                });
              }
            }
          } else if (action === "DELETE") {
            await prisma.project.update({
              where: { id: entityId },
              data: { deletedAt: new Date(), version: { increment: 1 } },
            });
          }
        }

        appliedMutationIds.push(clientMutationId);
      } catch (err) {
        console.warn(`[Sync] Failed to apply mutation ${m.clientMutationId}:`, err);
      }
    }

    // Broadcast mutation event to all connected SSE clients
    if (appliedMutationIds.length > 0) {
      notifySyncClients();
    }

    // Flush any pending document sessions that have reached the quiet window
    processPendingDocumentNotifications().catch(() => {});

    // Pull Phase: Fetch Server Deltas scoped to user's workspaces and personal space
    const sinceDate = lastSyncedAt ? new Date(lastSyncedAt) : new Date(0);

    const projectWhere = {
      OR: [
        { workspaceId: { in: workspaceIds } },
        { workspaceId: null, members: { some: { userId: currentUser.id } } },
      ],
      updatedAt: { gte: sinceDate },
    };

    const [workspaces, projects, projectStages, tasks, taskComments, pages] = await Promise.all([
      prisma.workspace.findMany({
        where: { id: { in: workspaceIds }, updatedAt: { gte: sinceDate } },
      }),
      prisma.project.findMany({
        where: projectWhere,
        include: { stages: true },
      }),
      prisma.projectStage.findMany({
        where: {
          project: {
            OR: [
              { workspaceId: { in: workspaceIds } },
              { workspaceId: null, members: { some: { userId: currentUser.id } } },
            ],
          },
        },
      }),
      prisma.task.findMany({
        where: {
          project: {
            OR: [
              { workspaceId: { in: workspaceIds } },
              { workspaceId: null, members: { some: { userId: currentUser.id } } },
            ],
          },
          updatedAt: { gte: sinceDate },
        },
        include: {
          creator: { select: { id: true, name: true, role: true } },
          assignee: { select: { id: true, name: true, role: true } },
          signoffs: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.taskComment.findMany({
        where: {
          task: {
            project: {
              OR: [
                { workspaceId: { in: workspaceIds } },
                { workspaceId: null, members: { some: { userId: currentUser.id } } },
              ],
            },
          },
          createdAt: { gte: sinceDate },
        },
        include: {
          user: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.page.findMany({
        where: {
          OR: [
            // 1. Non-private pages in user's active workspaces
            { workspaceId: { in: workspaceIds }, isPrivate: false },
            // 2. Private or personal pages where user is a collaborator or creator
            { collaborators: { some: { userId: currentUser.id } } },
            // 3. Pages explicitly shared with current user
            { id: { in: sharedPageIds } },
          ],
          updatedAt: { gte: sinceDate },
        },
      }),
    ]);

    const formattedTasks = tasks.map((t) => ({
      ...t,
      creatorName: t.creator?.name || "System",
      assigneeName: t.assignee?.name || null,
      signoffs: t.signoffs.map((s) => ({
        id: s.id,
        taskId: s.taskId,
        userId: s.userId,
        userName: s.user?.name || "Member",
        cleared: s.cleared,
        notes: s.notes,
        clearedAt: s.clearedAt,
      })),
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
        projectStages,
        tasks: formattedTasks,
        taskComments: formattedComments,
        pages,
        sharedPageIds,
      },
      currentServerTime: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Sync API Error]:", err);
    return NextResponse.json({ error: err.message || "Sync failed" }, { status: 500 });
  }
}
