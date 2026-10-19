import Dexie, { type Table } from "dexie";
import { TaskStage, TaskPriority, CommentType, WorkspaceRole } from "@prisma/client";

export interface LocalWorkspace {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  version: number;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalProject {
  id: string;
  name: string;
  key: string;
  description?: string | null;
  colorAccent?: string | null;
  workspaceId: string;
  ownerName?: string | null;
  guideName?: string | null;
  version: number;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalTask {
  id: string;
  projectTaskId: string;
  title: string;
  description?: string | null;
  stage: TaskStage;
  priority: TaskPriority;
  dueDate?: Date | null;
  taReviewNotes?: string | null;
  devRecommendation?: string | null;
  devConfirmedAt?: Date | null;
  qaTestNotes?: string | null;
  approvalSignoffNote?: string | null;
  signoffByName?: string | null;
  creatorId: string;
  creatorName?: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  approverId?: string | null;
  projectId: string;
  linkedPageId?: string | null;
  order: number;
  isArchived: boolean;
  version: number;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalTaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName?: string;
  userRole?: WorkspaceRole;
  type: CommentType;
  content: string;
  version: number;
  deletedAt?: Date | null;
  createdAt: Date;
}

export interface LocalPage {
  id: string;
  title: string;
  icon?: string | null;
  content?: any;
  isDiary: boolean;
  diaryDate?: Date | null;
  layout?: "centered" | "full" | string | null;
  fontFamily?: "sans" | "serif" | "mono" | string | null;
  fontSize?: "small" | "normal" | string | null;
  secretToken?: string | null;
  workspaceId: string;
  parentId?: string | null;
  version: number;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MutationItem {
  id?: number;
  clientMutationId: string;
  entity: "task" | "page" | "taskComment" | "project";
  entityId: string;
  action: "UPSERT" | "DELETE" | "STAGE_CHANGE";
  payload: any;
  createdAt: number;
  attempts: number;
}

export interface SyncMeta {
  key: string;
  value: any;
}

export class ShNotesLocalDb extends Dexie {
  workspaces!: Table<LocalWorkspace, string>;
  projects!: Table<LocalProject, string>;
  tasks!: Table<LocalTask, string>;
  taskComments!: Table<LocalTaskComment, string>;
  pages!: Table<LocalPage, string>;
  mutationQueue!: Table<MutationItem, number>;
  syncMeta!: Table<SyncMeta, string>;

  constructor() {
    super("shnotes_local_db");

    this.version(2).stores({
      workspaces: "id, slug, updatedAt, deletedAt",
      projects: "id, workspaceId, key, updatedAt, deletedAt",
      tasks: "id, projectId, projectTaskId, stage, priority, order, isArchived, updatedAt, deletedAt",
      taskComments: "id, taskId, userId, createdAt, deletedAt",
      pages: "id, workspaceId, isDiary, diaryDate, updatedAt, deletedAt",
      mutationQueue: "++id, clientMutationId, entity, entityId, createdAt",
      syncMeta: "key",
    });
  }
}

export const localDb = new ShNotesLocalDb();
