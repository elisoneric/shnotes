import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { WorkspaceRole, ProjectAccessLevel, TaskStage, TaskPriority, CommentType } from "@prisma/client";

export async function ensureSeedData() {
  try {
    const existingCount = await prisma.user.count();
    if (existingCount > 0) {
      return;
    }

    const adminEmail = process.env.ADMIN_EMAIL || "admin@esam.com.ng";
    const adminPassword = process.env.ADMIN_PASSWORD || "ShNotesAdmin123!";
    const passwordHash = hashPassword(adminPassword);

    // 1. Create Core Users
    const ownerUser = await prisma.user.create({
      data: {
        email: adminEmail.toLowerCase().trim(),
        name: "Elison Eric",
        passwordHash,
        role: WorkspaceRole.OWNER,
        isSystemAdmin: true,
      },
    });

    const hooUser = await prisma.user.create({
      data: {
        email: "hoo@trustbricks.com",
        name: "Head of Operations",
        passwordHash,
        role: WorkspaceRole.HOO,
      },
    });

    const devUser = await prisma.user.create({
      data: {
        email: "dev@trustbricks.com",
        name: "Lead Developer",
        passwordHash,
        role: WorkspaceRole.DEVELOPER,
      },
    });

    const taUser = await prisma.user.create({
      data: {
        email: "ta@trustbricks.com",
        name: "Technical Assistant",
        passwordHash,
        role: WorkspaceRole.TECH_ASSISTANT,
      },
    });

    // 2. Create Top-Level Organization Workspace (Trust Bricks)
    const workspace = await prisma.workspace.create({
      data: {
        name: "Trust Bricks",
        slug: "trust-bricks",
        members: {
          create: [
            { userId: ownerUser.id, role: WorkspaceRole.OWNER },
            { userId: hooUser.id, role: WorkspaceRole.HOO },
            { userId: devUser.id, role: WorkspaceRole.DEVELOPER },
            { userId: taUser.id, role: WorkspaceRole.TECH_ASSISTANT },
          ],
        },
      },
    });

    // 3. Create Operational Stream Projects: Equity Portal (EQ) & HR Portal (HR)
    const equityProject = await prisma.project.create({
      data: {
        name: "Equity Portal",
        key: "EQ",
        description: "Core equity allocation, distribution governance, and cap table operations.",
        colorAccent: "#2563eb",
        workspaceId: workspace.id,
        ownerName: "Elison Eric",
        guideName: "Head of Operations",
        members: {
          create: [
            { userId: ownerUser.id, accessLevel: ProjectAccessLevel.LEAD },
            { userId: devUser.id, accessLevel: ProjectAccessLevel.CONTRIBUTOR },
            { userId: taUser.id, accessLevel: ProjectAccessLevel.CONTRIBUTOR },
            { userId: hooUser.id, accessLevel: ProjectAccessLevel.OBSERVER },
          ],
        },
      },
    });

    const hrProject = await prisma.project.create({
      data: {
        name: "HR Operations Portal",
        key: "HR",
        description: "Talent onboarding, payroll compliance, and team operations.",
        colorAccent: "#7c3aed",
        workspaceId: workspace.id,
        ownerName: "Elison Eric",
        guideName: "Head of Operations",
        members: {
          create: [
            { userId: ownerUser.id, accessLevel: ProjectAccessLevel.LEAD },
            { userId: hooUser.id, accessLevel: ProjectAccessLevel.LEAD },
            { userId: devUser.id, accessLevel: ProjectAccessLevel.CONTRIBUTOR },
            { userId: taUser.id, accessLevel: ProjectAccessLevel.CONTRIBUTOR },
          ],
        },
      },
    });

    // 4. Create Governed Tasks with Explicit Ball-in-Court Pipeline
    const eq101 = await prisma.task.create({
      data: {
        projectId: equityProject.id,
        projectTaskId: "EQ-101",
        title: "Shareholder Equity Distribution Architecture",
        description: "Specify database schema constraints and transaction safeguards for automated equity allocations.",
        stage: TaskStage.DEV_ASSESSMENT,
        priority: TaskPriority.HIGH,
        creatorId: hooUser.id,
        assigneeId: devUser.id,
        order: 1.0,
        taReviewNotes: "Requirements verified against institutional compliance rules. Ready for Developer architecture plan.",
      },
    });

    await prisma.taskComment.create({
      data: {
        taskId: eq101.id,
        userId: taUser.id,
        type: CommentType.TA_SPEC_NOTE,
        content: "Verified compliance with dividend schedules. Ensure multi-signature locking on transfers.",
      },
    });

    const eq102 = await prisma.task.create({
      data: {
        projectId: equityProject.id,
        projectTaskId: "EQ-102",
        title: "Digital Certificate Signature Pipeline",
        description: "Deploy cryptographic verification endpoint and staging credentials for HOO acceptance sign-off.",
        stage: TaskStage.READY_FOR_TESTING,
        priority: TaskPriority.URGENT,
        creatorId: hooUser.id,
        assigneeId: devUser.id,
        order: 2.0,
        devRecommendation: "Utilized elliptic curve signing (ECDSA) with audit logging into PostgreSQL.",
        devConfirmedAt: new Date(),
        qaTestNotes: "Deployed to staging. Verify valid token validation and simulate expired signature rejection.",
      },
    });

    await prisma.taskComment.create({
      data: {
        taskId: eq102.id,
        userId: devUser.id,
        type: CommentType.DEV_RECOMMENDATION,
        content: "Staging build verified. Acceptance test instructions ready in QA Test Notes.",
      },
    });

    await prisma.task.create({
      data: {
        projectId: hrProject.id,
        projectTaskId: "HR-42",
        title: "Automated Staff Onboarding Verification",
        description: "Establish automated verification checks for identity verification and document archival.",
        stage: TaskStage.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        creatorId: hooUser.id,
        assigneeId: devUser.id,
        order: 1.0,
      },
    });

    await prisma.task.create({
      data: {
        projectId: hrProject.id,
        projectTaskId: "HR-43",
        title: "Bi-weekly Payroll Compliance Audit",
        description: "Lock payroll calculation batches before disbursement execution.",
        stage: TaskStage.CONFIRMED_READY,
        priority: TaskPriority.HIGH,
        creatorId: hooUser.id,
        assigneeId: devUser.id,
        order: 2.0,
      },
    });

    // 5. Create Initial Organization Specification Pages
    await prisma.page.create({
      data: {
        workspaceId: workspace.id,
        title: "Enterprise Governance & Operational Sign-off Policy",
        layout: "centered",
        fontFamily: "sans",
        fontSize: "normal",
        content: {
          blocks: [
            { id: "b1", type: "heading", level: 1, text: "Enterprise Governance & Operational Sign-off Policy" },
            { id: "b2", type: "paragraph", text: "All initiatives and deliverables transition through the governed 7-stage lifecycle to guarantee alignment and verified completion." },
            { id: "b3", type: "callout", text: "Mandate: Execution begins only upon CONFIRMED_READY. Final sign-off requires Head of Operations verification on READY_FOR_TESTING." },
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
        title: `Daily Operations Diary - ${today.toISOString().split("T")[0]}`,
        isDiary: true,
        diaryDate: today,
        content: {
          blocks: [
            { id: "d1", type: "heading", level: 2, text: "Daily Operations Review" },
            { id: "d2", type: "check", checked: true, text: "Review active project velocity and open blockers" },
            { id: "d3", type: "check", checked: false, text: "Perform HOO testing sign-off on EQ-102" },
            { id: "d4", type: "check", checked: false, text: "Assess Developer architecture recommendation for EQ-101" },
          ],
        },
      },
    });
  } catch (err: any) {
    console.warn("[Seed] Note while initializing starter data (can be ignored if database is remote):", err?.message || err);
  }
}
