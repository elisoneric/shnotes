import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "No active workspace membership found." }, { status: 403 });
    }

    const workspaceId = membership.workspaceId;
    const workspaceName = membership.workspace.name;

    const { message, history = [] } = await req.json();

    const apiKey = process.env.INDUNIX_API_KEY;
    const baseUrl = process.env.INDUNIX_BASE_URL || "https://api.indunixai.com/v1";
    const model = process.env.INDUNIX_MODEL || "indunix-1-core";

    // RAG: Gather live active projects, tasks, and recent notes scoped strictly to active workspace
    const [projects, activeTasks, recentPages] = await Promise.all([
      prisma.project.findMany({
        where: { workspaceId, deletedAt: null },
        select: { id: true, name: true, key: true },
      }),
      prisma.task.findMany({
        where: {
          project: { workspaceId },
          isArchived: false,
          deletedAt: null,
        },
        take: 20,
        orderBy: { updatedAt: "desc" },
        select: {
          projectTaskId: true,
          title: true,
          stage: true,
          priority: true,
          devRecommendation: true,
          assignee: { select: { name: true } },
        },
      }),
      prisma.page.findMany({
        where: { workspaceId, deletedAt: null },
        take: 8,
        orderBy: { updatedAt: "desc" },
        select: { title: true, isDiary: true, diaryDate: true },
      }),
    ]);

    const contextSummary = `
Active Workspace: "${workspaceName}"
- Active Projects: ${projects.map((p) => `${p.name} [${p.key}]`).join(", ") || "No projects created yet"}
- Recent Governed Tasks:
${
  activeTasks.length > 0
    ? activeTasks.map((t) => `  * [${t.projectTaskId}] ${t.title} (Stage: ${t.stage}, Priority: ${t.priority})`).join("\n")
    : "  No tasks in this workspace"
}
- Documentation & Diary Pages:
${
  recentPages.length > 0
    ? recentPages.map((p) => `  * ${p.title} ${p.isDiary ? "(Diary entry)" : ""}`).join("\n")
    : "  No notes created yet"
}
`;

    const systemPrompt = `You are Indunix Assistant, the embedded AI Copilot for the ShNotes workspace and notes platform.
You are assisting ${user.name} in their workspace "${workspaceName}".
You have real-time access to the active workspace context below.
Answer user queries accurately, concisely, and professionally.
Do not use emojis. Use clean markdown formatting with tables, bold headers, and structured bullet lists.

${contextSummary}
`;

    if (apiKey) {
      const messages = [
        { role: "system", content: systemPrompt },
        ...history.slice(-6),
        { role: "user", content: message },
      ];

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const reply = json.choices?.[0]?.message?.content || "";
        return NextResponse.json({ ok: true, reply });
      }
    }

    // High quality deterministic fallback scoped strictly to user's workspace
    const lower = message.toLowerCase();
    let fallbackReply = `I am your Indunix Assistant for **${workspaceName}**. You currently have **${activeTasks.length} active tasks** across **${projects.length} projects**.`;

    if (lower.includes("task") || lower.includes("open") || lower.includes("project")) {
      if (activeTasks.length === 0) {
        fallbackReply = `### Task Status: ${workspaceName}

There are currently no active tasks recorded for this workspace. 

You can propose an initiative on the **Governed Projects** board to begin the 7-stage review process.`;
      } else {
        fallbackReply = `### Active Governed Tasks: ${workspaceName}

| Task ID | Title | Stage | Priority |
| :--- | :--- | :--- | :--- |
${activeTasks.map((t) => `| **${t.projectTaskId}** | ${t.title} | \`${t.stage.replace(/_/g, " ")}\` | **${t.priority}** |`).join("\n")}

All tasks move through the 7-stage review gates before release. Click any card to inspect recommendations or sign-offs.`;
      }
    } else if (lower.includes("diary") || lower.includes("yesterday") || lower.includes("today")) {
      const diaryPages = recentPages.filter((p) => p.isDiary);
      fallbackReply = `### Operations Diary: ${workspaceName}
${
  diaryPages.length > 0
    ? diaryPages.map((p) => `- **${p.title}** (Updated recently)`).join("\n")
    : "No diary entries have been logged yet. Use the Operations Diary to record daily updates."
}`;
    } else {
      fallbackReply = `### Workspace Overview: ${workspaceName}

- **Active Projects**: ${projects.map((p) => `${p.name} [${p.key}]`).join(", ") || "None"}
- **Active Governed Tasks**: ${activeTasks.length}
- **Document Pages**: ${recentPages.filter((p) => !p.isDiary).length}

You can ask me to:
1. Review open tasks and their review stages
2. Inspect operations diary entries
3. Draft methodology plans for any open initiative`;
    }

    return NextResponse.json({ ok: true, reply: fallbackReply });
  } catch (err: any) {
    console.error("[Indunix AI Chat Error]:", err);
    return NextResponse.json({ error: err.message || "Chat error" }, { status: 500 });
  }
}
