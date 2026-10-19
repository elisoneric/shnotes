import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { message, history = [] } = await req.json();

    const apiKey = process.env.INDUNIX_API_KEY;
    const baseUrl = process.env.INDUNIX_BASE_URL || "https://api.indunixai.com/v1";
    const model = process.env.INDUNIX_MODEL || "indunix-1-core";

    // RAG-lite: Gather live active projects, tasks, and recent notes
    const [projects, activeTasks, recentPages] = await Promise.all([
      prisma.project.findMany({ select: { name: true, key: true } }),
      prisma.task.findMany({
        where: { isArchived: false, deletedAt: null },
        take: 15,
        orderBy: { updatedAt: "desc" },
        select: {
          projectTaskId: true,
          title: true,
          stage: true,
          priority: true,
          devRecommendation: true,
        },
      }),
      prisma.page.findMany({
        where: { deletedAt: null },
        take: 5,
        orderBy: { updatedAt: "desc" },
        select: { title: true, isDiary: true, diaryDate: true },
      }),
    ]);

    const contextSummary = `
System Knowledge Base & Live Workspace Context:
- Active Projects: ${projects.map((p) => `${p.name} [${p.key}]`).join(", ") || "None"}
- Recent Governed Tasks:
${activeTasks.map((t) => `  * [${t.projectTaskId}] ${t.title} (Stage: ${t.stage}, Priority: ${t.priority})`).join("\n") || "  None"}
- Documentation & Diary Pages:
${recentPages.map((p) => `  * ${p.title} ${p.isDiary ? "(Diary entry)" : ""}`).join("\n") || "  None"}
`;

    const systemPrompt = `You are Indunix Assistant, the embedded AI Copilot for the Trustbricks engineering governance platform.
You assist developers, Technical Assistants (TA), and Heads of Operations (HOO).
You have real-time access to the active workspace context below.
Answer user queries accurately, concisely, and professionally.
Do not use emojis. Use clean markdown formatting.

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

    // High quality deterministic fallback when API key is not yet set
    const lower = message.toLowerCase();
    let fallbackReply = `I am your Indunix Assistant. You currently have ${activeTasks.length} active governed tasks across ${projects.length} projects.`;

    if (lower.includes("task") || lower.includes("open") || lower.includes("project")) {
      fallbackReply = `Here is the current status of active tasks across your projects:
${activeTasks.map((t) => `- **${t.projectTaskId}**: ${t.title} — Stage: \`${t.stage}\` (Priority: ${t.priority})`).join("\n")}

You can click any task card to open the 3-Tier Governance modal, write recommendations, or approve scope.`;
    } else if (lower.includes("diary") || lower.includes("yesterday") || lower.includes("today")) {
      fallbackReply = `Operations Diary status:
- Latest entries: ${recentPages.filter((p) => p.isDiary).map((p) => p.title).join(", ") || "No recent diary entries found."}
You can log daily standup notes and sprint updates in the Daily Diary section.`;
    } else {
      fallbackReply = `Indunix Assistant is ready. Active projects: ${projects.map((p) => p.name).join(", ")}.
You can ask me to:
1. Summarize open tasks across all projects
2. Check diary logs and operations records
3. Review technical recommendations for any task such as "EQ-101"`;
    }

    return NextResponse.json({ ok: true, reply: fallbackReply });
  } catch (err: any) {
    console.error("[Indunix AI Chat Error]:", err);
    return NextResponse.json({ error: err.message || "Chat error" }, { status: 500 });
  }
}
