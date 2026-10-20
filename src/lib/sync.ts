import { localDb, MutationItem, LocalTask, LocalPage, LocalTaskComment, LocalProject } from "@/lib/dexie";

export type SyncStatus = "IDLE" | "SYNCING" | "OFFLINE" | "ERROR";

type SyncListener = (status: SyncStatus, pendingCount: number) => void;

class SyncManager {
  private status: SyncStatus = "IDLE";
  private listeners: Set<SyncListener> = new Set();
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private syncQueued = false;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleNetworkChange(true));
      window.addEventListener("offline", () => this.handleNetworkChange(false));
      this.status = navigator.onLine ? "IDLE" : "OFFLINE";
      this.startBackgroundSync();
    }
  }

  public subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    this.notify();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async notify() {
    let pendingCount = 0;
    try {
      pendingCount = await localDb.mutationQueue.count();
    } catch {
      // Ignore
    }
    for (const listener of this.listeners) {
      listener(this.status, pendingCount);
    }
  }

  private handleNetworkChange(isOnline: boolean) {
    if (isOnline) {
      this.status = "IDLE";
      this.syncNow();
    } else {
      this.status = "OFFLINE";
      this.notify();
    }
  }

  public startBackgroundSync(intervalMs = 2500) {
    if (this.syncTimer) clearInterval(this.syncTimer);
    this.syncTimer = setInterval(() => {
      if (typeof navigator !== "undefined" && navigator.onLine && !this.isSyncing) {
        this.syncNow();
      }
    }, intervalMs);
  }

  public async queueMutation(
    entity: "task" | "page" | "taskComment" | "project" | "projectStage",
    entityId: string,
    action: "UPSERT" | "DELETE" | "STAGE_CHANGE" | "SIGNOFF_CHANGE",
    payload: any
  ) {
    const item: MutationItem = {
      clientMutationId: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      entity,
      entityId,
      action,
      payload,
      createdAt: Date.now(),
      attempts: 0,
    };

    await localDb.mutationQueue.add(item);
    this.notify();

    if (typeof navigator !== "undefined" && navigator.onLine) {
      this.syncNow();
    }
  }

  public async syncNow(): Promise<boolean> {
    if (this.isSyncing) {
      this.syncQueued = true;
      return false;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.status = "OFFLINE";
      this.notify();
      return false;
    }

    this.isSyncing = true;
    this.status = "SYNCING";
    this.notify();

    try {
      const pendingMutations = await localDb.mutationQueue.toArray();
      const lastSyncedMeta = await localDb.syncMeta.get("lastSyncedAt");
      const lastSyncedAt = lastSyncedMeta?.value || null;

      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mutations: pendingMutations,
          lastSyncedAt,
        }),
      });

      if (!res.ok) {
        throw new Error(`Sync HTTP error ${res.status}`);
      }

      const data = await res.json();

      // 1. Clear applied mutations from queue
      if (Array.isArray(data.appliedMutationIds) && data.appliedMutationIds.length > 0) {
        await localDb.mutationQueue
          .where("clientMutationId")
          .anyOf(data.appliedMutationIds)
          .delete();
      }

      // 2. Merge server deltas into local tables
      const { deltas, currentServerTime } = data;
      if (deltas) {
        if (Array.isArray(deltas.workspaces)) {
          await localDb.workspaces.bulkPut(deltas.workspaces);
        }
        if (Array.isArray(deltas.projects)) {
          await localDb.projects.bulkPut(deltas.projects);
        }
        if (Array.isArray(deltas.projectStages)) {
          await localDb.projectStages.bulkPut(deltas.projectStages);
        }
        if (Array.isArray(deltas.tasks)) {
          await localDb.tasks.bulkPut(deltas.tasks);
        }
        if (Array.isArray(deltas.taskComments)) {
          await localDb.taskComments.bulkPut(deltas.taskComments);
        }
        if (Array.isArray(deltas.pages)) {
          await localDb.pages.bulkPut(deltas.pages);
        }
        if (Array.isArray(deltas.sharedPageIds)) {
          await localDb.syncMeta.put({ key: "sharedPageIds", value: deltas.sharedPageIds });
        }
      }

      // 3. Update lastSyncedAt marker
      if (currentServerTime) {
        await localDb.syncMeta.put({ key: "lastSyncedAt", value: currentServerTime });
      }

      this.status = "IDLE";
      return true;
    } catch (err) {
      console.warn("[Sync] Background sync encountered an issue:", err);
      this.status = typeof navigator !== "undefined" && !navigator.onLine ? "OFFLINE" : "ERROR";
      return false;
    } finally {
      this.isSyncing = false;
      this.notify();
      if (this.syncQueued) {
        this.syncQueued = false;
        setTimeout(() => this.syncNow(), 150);
      }
    }
  }
}

export const syncManager = new SyncManager();
