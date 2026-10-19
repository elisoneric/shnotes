import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { WorkspaceRole, TaskStage, TaskPriority, CommentType } from "@prisma/client";

export async function ensureSeedData() {
  try {
    const existingCount = await prisma.user.count();
    if (existingCount > 0) {
      return;
    }

    const email = process.env.ADMIN_EMAIL || "admin@shnotes.io";
    const password = process.env.ADMIN_PASSWORD || "ShNotesAdmin123!";
    const passwordHash = hashPassword(password);

    // 1. Create Default User
    const ownerUser = await prisma.user.create({
      data: {
        email,
        name: "Workspace Lead",
        passwordHash,
        role: WorkspaceRole.OWNER,
      },
    });

    // 2. Create Default Workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: process.env.WORKSPACE_NAME || "My Workspace",
        slug: "workspace",
        members: {
          create: [{ userId: ownerUser.id, role: WorkspaceRole.OWNER }],
        },
      },
    });

    // 3. Create Starter Project
    const generalProject = await prisma.project.create({
      data: {
        name: "General Tasks",
        key: "GEN",
        description: "General initiatives, tasks, and to-do items",
        workspaceId: workspace.id,
        ownerName: "Workspace Lead",
      },
    });

    // 4. Create Starter Tasks (Clean 3-Stage Workflow)
    await prisma.task.create({
      data: {
        projectId: generalProject.id,
        projectTaskId: "GEN-101",
        title: "Welcome to your task board",
        description: "A simple, stress-free space to organize your tasks, notes, and team.",
        stage: TaskStage.PROPOSED,
        priority: TaskPriority.MEDIUM,
        creatorId: ownerUser.id,
        order: 1.0,
      },
    });

    await prisma.task.create({
      data: {
        projectId: generalProject.id,
        projectTaskId: "GEN-102",
        title: "Explore canvas notes",
        description: "Create documents with Notion-style blocks, checklists, and code snippets.",
        stage: TaskStage.IN_PROGRESS,
        priority: TaskPriority.LOW,
        creatorId: ownerUser.id,
        order: 2.0,
      },
    });

    await prisma.task.create({
      data: {
        projectId: generalProject.id,
        projectTaskId: "GEN-103",
        title: "Set up your workspace",
        description: "Customize your projects and invite collaborators with simple role permissions.",
        stage: TaskStage.APPROVED_CLEARED,
        priority: TaskPriority.HIGH,
        creatorId: ownerUser.id,
        order: 3.0,
      },
    });

    // 5. Create Initial Clean Canvas Note
    await prisma.page.create({
      data: {
        workspaceId: workspace.id,
        title: "Welcome to Notes",
        content: {
          blocks: [
            { id: "b1", type: "heading", level: 1, text: "Welcome to your Workspace" },
            { id: "b2", type: "paragraph", text: "This is your simple canvas for writing notes, drafting documentation, and keeping track of your thoughts." },
            { id: "b3", type: "callout", text: "Pro-tip: Type '/' on any new line to add headings, bullet points, checklists, quotes, or code blocks." },
          ],
        },
      },
    });

    // 6. Create Initial Daily Diary
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await prisma.page.create({
      data: {
        workspaceId: workspace.id,
        title: `Daily Diary - ${today.toISOString().split("T")[0]}`,
        isDiary: true,
        diaryDate: today,
        content: {
          blocks: [
            { id: "d1", type: "heading", level: 2, text: "Daily Notes" },
            { id: "d2", type: "check", checked: true, text: "Set up workspace" },
            { id: "d3", type: "check", checked: false, text: "Review today's to-do items" },
          ],
        },
      },
    });
  } catch (err) {
    console.warn("[Seed] Warning while initializing starter data:", err);
  }
}
