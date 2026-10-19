import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { WorkspaceRole, TaskStage, TaskPriority, CommentType } from "@prisma/client";

export async function ensureSeedData() {
  try {
    const existingCount = await prisma.user.count();
    if (existingCount > 0) {
      return;
    }

    const email = process.env.ADMIN_EMAIL || "admin@trustbricks.com";
    const password = process.env.ADMIN_PASSWORD || "TrustbricksPass123!";
    const passwordHash = hashPassword(password);

    // 1. Create Users for the multi-role team
    const adminUser = await prisma.user.create({
      data: {
        email,
        name: "Director / HOO",
        passwordHash,
        role: WorkspaceRole.HOO,
      },
    });

    const taUser = await prisma.user.create({
      data: {
        email: "ta@trustbricks.com",
        name: "Alex (Tech Assistant)",
        passwordHash,
        role: WorkspaceRole.TECH_ASSISTANT,
      },
    });

    const devUser = await prisma.user.create({
      data: {
        email: "dev@trustbricks.com",
        name: "Lead Engineer (Developer)",
        passwordHash,
        role: WorkspaceRole.DEVELOPER,
      },
    });

    // 2. Create Workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: process.env.WORKSPACE_NAME || "Trustbricks",
        slug: "trustbricks",
        members: {
          create: [
            { userId: adminUser.id, role: WorkspaceRole.HOO },
            { userId: taUser.id, role: WorkspaceRole.TECH_ASSISTANT },
            { userId: devUser.id, role: WorkspaceRole.DEVELOPER },
          ],
        },
      },
    });

    // 3. Create Governed Projects
    const eqProject = await prisma.project.create({
      data: {
        name: "Equity Portal",
        key: "EQ",
        description: "Investor relations, shareholder register, cap table, and dividend ledger",
        workspaceId: workspace.id,
      },
    });

    const hrProject = await prisma.project.create({
      data: {
        name: "HR Portal",
        key: "HR",
        description: "Employee attendance geofencing, leave workflows, and performance reviews",
        workspaceId: workspace.id,
      },
    });

    // 4. Create Initial Governed Tasks illustrating the 7-stage lifecycle
    const task1 = await prisma.task.create({
      data: {
        projectId: eqProject.id,
        projectTaskId: "EQ-101",
        title: "Automated Dividend Payout Disbursal Engine",
        description: "HOO Request: We need a scheduled cron that calculates quarterly dividends for verified shareholders and produces payout batch files for bank approval.",
        stage: TaskStage.DEV_ASSESSMENT,
        priority: TaskPriority.HIGH,
        creatorId: adminUser.id,
        assigneeId: devUser.id,
        taReviewNotes: "TA Review: Verify integration with existing bank disbursement webhook API. Requires idempotent transaction IDs to avoid double payments.",
        devRecommendation: "Architecture Suggestion: Implement a PostgreSQL transactional outbox table with idempotent batch hashing. Process 50 payouts per chunk with retry backoff. Estimated effort: 3 days.",
        order: 1.0,
      },
    });

    await prisma.taskComment.create({
      data: {
        taskId: task1.id,
        userId: adminUser.id,
        type: CommentType.STANDARD_CHAT,
        content: "Target deadline for this is next Friday before board review.",
      },
    });

    await prisma.taskComment.create({
      data: {
        taskId: task1.id,
        userId: taUser.id,
        type: CommentType.TA_SPEC_NOTE,
        content: "Checked requirements. Approved to proceed with dev recommendation review.",
      },
    });

    const task2 = await prisma.task.create({
      data: {
        projectId: eqProject.id,
        projectTaskId: "EQ-102",
        title: "Two-Factor Authentication for Investor Portal",
        description: "Enforce TOTP authenticator app verification for all shareholder account logins.",
        stage: TaskStage.READY_FOR_TESTING,
        priority: TaskPriority.URGENT,
        creatorId: adminUser.id,
        assigneeId: devUser.id,
        taReviewNotes: "TA: Standard RFC 6238 TOTP with fallback recovery codes.",
        devRecommendation: "Used native Node.js crypto for HMAC-SHA1 TOTP verification and encrypted backup codes.",
        qaTestNotes: "Staging Preview: https://staging.trustbricks.com/auth/2fa\nTest Account: investor.demo@trustbricks.com / pass: Test2FA!123\nSteps: Log in, scan QR code with Google Authenticator, verify 6-digit pin.",
        order: 2.0,
      },
    });

    await prisma.task.create({
      data: {
        projectId: hrProject.id,
        projectTaskId: "HR-201",
        title: "Geofenced Mobile Clock-in Verification",
        description: "Restrict employee clock-in to within 100 meters of the office coordinates.",
        stage: TaskStage.PROPOSED,
        priority: TaskPriority.MEDIUM,
        creatorId: adminUser.id,
        order: 1.0,
      },
    });

    // 5. Create Initial Documentation Page
    await prisma.page.create({
      data: {
        workspaceId: workspace.id,
        title: "Engineering Governance Standard",
        content: {
          blocks: [
            { id: "b1", type: "heading", level: 1, text: "Engineering Governance & Deployment Policy" },
            { id: "b2", type: "paragraph", text: "All features and fixes must transition strictly through the 7-stage lifecycle before production rollout." },
            { id: "b3", type: "callout", text: "Rule: No code development begins without locked Developer Technical Recommendations approved by the HOO or TA." },
            { id: "b4", type: "heading", level: 2, text: "Ball-in-Court Lifecycle Stages" },
            { id: "b5", type: "bullet", text: "Proposed: Logged by HOO with business rationale." },
            { id: "b6", type: "bullet", text: "TA Review: Triage, edge cases, and developer assignment." },
            { id: "b7", type: "bullet", text: "Dev Assessment: Technical recommendation, trade-offs, and architecture." },
            { id: "b8", type: "bullet", text: "Confirmed: Scope formally approved and locked." },
            { id: "b9", type: "bullet", text: "In Progress: Active development." },
            { id: "b10", type: "bullet", text: "Ready for Testing: Staging preview, testing steps, and acceptance criteria submitted." },
            { id: "b11", type: "bullet", text: "Approved / Cleared: HOO sign-off verification." },
          ],
        },
      },
    });

    // 6. Create Initial Daily Diary Entry
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    await prisma.page.create({
      data: {
        workspaceId: workspace.id,
        title: `Operations Log - ${today.toISOString().split("T")[0]}`,
        isDiary: true,
        diaryDate: today,
        content: {
          blocks: [
            { id: "d1", type: "heading", level: 2, text: "Daily Operations & Sprint Sync" },
            { id: "d2", type: "check", checked: true, text: "Reviewed EQ-101 payout architecture proposal" },
            { id: "d3", type: "check", checked: false, text: "Test investor 2FA verification flow on staging" },
            { id: "d4", type: "paragraph", text: "All systems operational. Geofencing accuracy benchmark ongoing." },
          ],
        },
      },
    });

    console.log("[Seed] Default workspace, multi-role users, projects, and governed tasks initialized.");
  } catch (err) {
    console.warn("[Seed] Warning while checking/seeding initial data:", err);
  }
}
