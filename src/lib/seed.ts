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

    // 1. Create Enterprise Members
    const ownerUser = await prisma.user.create({
      data: {
        email,
        name: "Director of Operations",
        passwordHash,
        role: WorkspaceRole.OWNER,
      },
    });

    const guideUser = await prisma.user.create({
      data: {
        email: "guide@trustbricks.com",
        name: "Lead Reviewer & Guide",
        passwordHash,
        role: WorkspaceRole.REVIEWER_GUIDE,
      },
    });

    const specialistUser = await prisma.user.create({
      data: {
        email: "specialist@trustbricks.com",
        name: "Principal Specialist / Developer",
        passwordHash,
        role: WorkspaceRole.CONTRIBUTOR,
      },
    });

    // 2. Create Workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: process.env.WORKSPACE_NAME || "Trustbricks",
        slug: "trustbricks",
        members: {
          create: [
            { userId: ownerUser.id, role: WorkspaceRole.OWNER },
            { userId: guideUser.id, role: WorkspaceRole.REVIEWER_GUIDE },
            { userId: specialistUser.id, role: WorkspaceRole.CONTRIBUTOR },
          ],
        },
      },
    });

    // 3. Create Enterprise Governed Projects with designated Owner & Guide
    const eqProject = await prisma.project.create({
      data: {
        name: "Equity Portal",
        key: "EQ",
        description: "Investor relations, shareholder register, cap table, and dividend ledger",
        workspaceId: workspace.id,
        ownerName: "Director of Operations",
        guideName: "Lead Reviewer & Guide",
      },
    });

    const hrProject = await prisma.project.create({
      data: {
        name: "HR Operations Portal",
        key: "HR",
        description: "Employee attendance geofencing, leave workflows, and performance reviews",
        workspaceId: workspace.id,
        ownerName: "Director of Operations",
        guideName: "Lead Reviewer & Guide",
      },
    });

    // 4. Create Initial Governed Tasks illustrating the 7-stage enterprise lifecycle
    const task1 = await prisma.task.create({
      data: {
        projectId: eqProject.id,
        projectTaskId: "EQ-101",
        title: "Automated Dividend Payout Disbursal Engine",
        description: "Calculate quarterly dividends for verified shareholders and produce payout batch files for bank approval.",
        stage: TaskStage.DEV_ASSESSMENT,
        priority: TaskPriority.HIGH,
        creatorId: ownerUser.id,
        assigneeId: specialistUser.id,
        taReviewNotes: "Review: Verify integration with existing disbursement API. Requires idempotent transaction IDs to avoid duplicate payments.",
        devRecommendation: "Implementation Plan: Implement a transactional outbox table with idempotent batch hashing. Process 50 payouts per chunk with retry backoff. Estimated effort: 3 days.",
        order: 1.0,
      },
    });

    await prisma.taskComment.create({
      data: {
        taskId: task1.id,
        userId: ownerUser.id,
        type: CommentType.STANDARD_CHAT,
        content: "Target deadline for this deliverable is scheduled before board review.",
      },
    });

    await prisma.taskComment.create({
      data: {
        taskId: task1.id,
        userId: guideUser.id,
        type: CommentType.TA_SPEC_NOTE,
        content: "Requirements verified. Approved to proceed with technical architecture review.",
      },
    });

    await prisma.task.create({
      data: {
        projectId: eqProject.id,
        projectTaskId: "EQ-102",
        title: "Two-Factor Authentication for Investor Portal",
        description: "Enforce authenticator app verification for all shareholder account logins.",
        stage: TaskStage.READY_FOR_TESTING,
        priority: TaskPriority.URGENT,
        creatorId: ownerUser.id,
        assigneeId: specialistUser.id,
        taReviewNotes: "Standard RFC 6238 TOTP with fallback recovery codes.",
        devRecommendation: "Cryptographic HMAC-SHA1 TOTP verification and encrypted backup codes implemented.",
        qaTestNotes: "Staging Preview: https://staging.trustbricks.com/auth/2fa\nVerification Account: investor.demo@trustbricks.com / pass: Test2FA!123\nSteps: Log in, scan QR code with authenticator app, verify 6-digit pin.",
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
        creatorId: ownerUser.id,
        order: 1.0,
      },
    });

    // 5. Create Initial Documentation Page
    await prisma.page.create({
      data: {
        workspaceId: workspace.id,
        title: "Enterprise Governance Standard",
        content: {
          blocks: [
            { id: "b1", type: "heading", level: 1, text: "Enterprise Governance & Operational Sign-off Policy" },
            { id: "b2", type: "paragraph", text: "All initiatives and deliverables transition through the 7-stage lifecycle to guarantee alignment and verified completion." },
            { id: "b3", type: "callout", text: "Mandate: Execution begins once the methodology and scope are formally confirmed by the Project Guide or Owner." },
            { id: "b4", type: "heading", level: 2, text: "Lifecycle Stages" },
            { id: "b5", type: "bullet", text: "Proposed: Objective, business case, and target deliverables logged." },
            { id: "b6", type: "bullet", text: "Under Review: Alignment checked, dependencies identified, specialist assigned." },
            { id: "b7", type: "bullet", text: "Assessment & Plan: Methodology, technical/operational scope, and timeline proposed." },
            { id: "b8", type: "bullet", text: "Confirmed Scope: Methodology approved and locked." },
            { id: "b9", type: "bullet", text: "In Progress: Active execution." },
            { id: "b10", type: "bullet", text: "Quality & Verification: Deliverables, demonstration links, and test criteria submitted." },
            { id: "b11", type: "bullet", text: "Approved & Cleared: Final sign-off by authorized authority." },
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
            { id: "d3", type: "check", checked: false, text: "Verify investor 2FA verification flow on staging" },
            { id: "d4", type: "paragraph", text: "All systems operational. Geofencing benchmark ongoing." },
          ],
        },
      },
    });
  } catch (err) {
    console.warn("[Seed] Warning while initializing enterprise data:", err);
  }
}
