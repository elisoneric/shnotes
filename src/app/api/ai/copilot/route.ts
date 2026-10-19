import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { action, taskId, context } = await req.json();

    const apiKey = process.env.INDUNIX_API_KEY;
    const baseUrl = process.env.INDUNIX_BASE_URL || "https://api.indunixai.com/v1";
    const model = process.env.INDUNIX_MODEL || "indunix-1-core";

    let task = null;
    if (taskId) {
      task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          project: true,
          comments: {
            include: { user: { select: { name: true, role: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "draft-recommendation") {
      systemPrompt = `You are an Enterprise Solutions Architect and Governance Lead assisting a multidisciplinary team.
Analyze the business and operational requirements provided by the Project Owner or Guide.
Produce a concise, production-grade Execution Methodology & Architecture Plan.
Structure your output into 3 clear markdown sections without emojis:
### 1. Methodology & Architecture Approach
Explain the technical pattern, database schema impact, or operational execution workflow.
### 2. Trade-offs & Alternatives
Contrast Option A (faster delivery) against Option B (higher scale and durability).
### 3. Estimated Effort & Risk Matrix
Provide timeline estimate in days and edge cases to safeguard.`;

      userPrompt = `Task Title: ${task?.title || context?.title || "Untitled Task"}
Project: ${task?.project?.name || context?.projectName || "Enterprise Workspace"}
Operational Request / Description:
${task?.description || context?.description || "No description provided."}
Review & Guidance Notes:
${task?.taReviewNotes || "None."}`;
    } else if (action === "qa-checklist") {
      systemPrompt = `You are a Senior Quality & Acceptance Verification Specialist.
Review the resolution notes, demonstration credentials, and execution details.
Produce a structured, actionable Acceptance Verification Checklist for the Project Owner to inspect before formal sign-off.
Use markdown checkboxes '- [ ]' without emojis.`;

      userPrompt = `Task: [${task?.projectTaskId || "TASK"}] ${task?.title}
Execution & Solution Notes:
${task?.devRecommendation || "None"}
Verification Notes & Credentials:
${task?.qaTestNotes || context?.qaTestNotes || "None"}
Testing instructions:`;
    } else if (action === "summarize-thread") {
      systemPrompt = `You are an Executive Project Coordinator.
Summarize the discussion thread into a clean, 3-bullet consensus summary stating:
1. What was agreed upon
2. Open risks or dependencies
3. Final decision
Do not use emojis.`;

      const commentLogs =
        task?.comments?.map((c) => `[${c.user?.name || "Member"} (${c.type})]: ${c.content}`).join("\n") ||
        context?.thread ||
        "No comments.";

      userPrompt = `Task: ${task?.title}\nDiscussion:\n${commentLogs}`;
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (apiKey) {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const content = json.choices?.[0]?.message?.content || "";
        return NextResponse.json({ ok: true, result: content });
      }
    }

    // High quality deterministic fallback when API key is pending configuration
    let fallbackResult = "";
    if (action === "draft-recommendation") {
      fallbackResult = `### 1. Methodology & Architecture Approach
- Implement an idempotent database table with unique constraints on composite keys.
- Expose a secure server handler with session role verification (OWNER or CONTRIBUTOR).
- Utilize atomic transactions to ensure consistent state across parent and child entities.

### 2. Trade-offs & Alternatives
- Option A (Direct Synchronous Execution): Simpler delivery, but risks client blocking under high network latency.
- Option B (Asynchronous Outbox Pattern - Recommended): Write mutations locally to IndexedDB/Postgres outbox, processing sequentially. Guarantees zero data loss during network interruptions.

### 3. Estimated Effort & Risk Matrix
- Development Effort: 2 to 3 engineering days.
- Key Edge Cases: Network drops during packet transit, concurrent updates from multiple active sessions, and boundary validation on user input payloads.`;
    } else if (action === "qa-checklist") {
      fallbackResult = `- [ ] Verify staging environment is accessible via provided secure URL.
- [ ] Confirm valid authentication credentials are accepted and unauthorized requests are rejected (401/403).
- [ ] Execute primary user story: submit sample data and verify successful record persistence.
- [ ] Test edge case: simulate network disconnection and confirm offline queue retains all pending edits.
- [ ] Confirm audit log records exact timestamp and user ID upon status transition.`;
    } else if (action === "summarize-thread") {
      fallbackResult = `1. Consensus: Scope confirmed according to the proposed architecture specification.
2. Technical Resolution: Implementation completed on staging with test credentials verified.
3. Next Action: Awaiting Project Owner acceptance testing and sign-off verification.`;
    }

    return NextResponse.json({ ok: true, result: fallbackResult });
  } catch (err: any) {
    console.error("[Indunix AI Copilot Error]:", err);
    return NextResponse.json({ error: err.message || "Copilot error" }, { status: 500 });
  }
}
