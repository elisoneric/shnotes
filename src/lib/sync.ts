import { localDb, MutationItem } from "@/lib/dexie";

export type SyncStatus = "IDLE" | "SYNCING" | "OFFLINE" | "ERROR";

type SyncListener = (status: SyncStatus, pendingCount: number) => void;

class SyncManager {
  private status: SyncStatus = "IDLE";
  private listeners: Set<SyncListener> = new Set();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private syncQueued = false;
  private broadcastChannel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleNetworkChange(true));
      window.addEventListener("offline", () => this.handleNetworkChange(false));
      this.status = navigator.onLine ? "IDLE" : "OFFLINE";

      // 1. Cross-tab PubSub communication with zero network cost
      if ("BroadcastChannel" in window) {
        try {
          this.broadcastChannel = new BroadcastChannel("shnotes_sync");
          this.broadcastChannel.onmessage = (event) => {
            if (event.data?.type === "SYNC_MUTATION_SAVED") {
              this.syncNow(false);
            }
          };
        } catch {
          // Fallback if BroadcastChannel is blocked
        }
      }

      // 2. Real-time Server-Sent Events (SSE) change listener
      this.initRealtimeStream();

      // 3. Sync on tab focus or visibility change
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && navigator.onLine && !this.isSyncing) {
          this.syncNow(false);
        }
      });
      window.addEventListener("focus", () => {
        if (navigator.onLine && !this.isSyncing) {
          this.syncNow(false);
        }
      });

      // 4. Relaxed 60-second background heartbeat (replaces aggressive 2.5s polling loop)
      this.startHeartbeat(60000);
    }
  }

  private initRealtimeStream() {
    if (typeof window === "undefined" || !("EventSource" in window)) return;
    try {
      if (this.eventSource) {
        this.eventSource.close();
      }
      this.eventSource = new EventSource("/api/sync/events");

      this.eventSource.addEventListener("change", () => {
        if (navigator.onLine && !this.isSyncing) {
          this.syncNow(false);
        }
      });

      this.eventSource.onerror = () => {
        this.eventSource?.close();
        this.eventSource = null;
        // Exponential backoff reconnect
        setTimeout(() => {
          if (navigator.onLine) {
            this.initRealtimeStream();
          }
        }, 15000);
      };
    } catch {
      // Ignore SSE failure in restricted environments
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
      this.initRealtimeStream();
      this.syncNow(true);
    } else {
      this.status = "OFFLINE";
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      this.notify();
    }
  }

  public startHeartbeat(intervalMs = 60000) {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (typeof navigator !== "undefined" && navigator.onLine && !this.isSyncing) {
        this.syncNow(false);
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

    // Notify other open tabs in the browser immediately
    this.broadcastChannel?.postMessage({ type: "SYNC_MUTATION_SAVED" });

    // Flush immediately to server
    if (typeof navigator !== "undefined" && navigator.onLine) {
      this.syncNow(true);
    }
  }

  public async syncNow(visibleSpinner = true): Promise<boolean> {
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

    // Only display active spinning indicator when there are actual pending mutations
    // or when explicitly requested by user interaction, avoiding continuous spinning
    const pendingCount = await localDb.mutationQueue.count().catch(() => 0);
    if (pendingCount > 0 || visibleSpinner) {
      this.status = "SYNCING";
      this.notify();
    }

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
      let hasNewDeltas = false;

      if (deltas) {
        if (Array.isArray(deltas.workspaces) && deltas.workspaces.length > 0) {
          await localDb.workspaces.bulkPut(deltas.workspaces);
          hasNewDeltas = true;
        }
        if (Array.isArray(deltas.projects) && deltas.projects.length > 0) {
          await localDb.projects.bulkPut(deltas.projects);
          hasNewDeltas = true;
        }
        if (Array.isArray(deltas.projectStages) && deltas.projectStages.length > 0) {
          await localDb.projectStages.bulkPut(deltas.projectStages);
          hasNewDeltas = true;
        }
        if (Array.isArray(deltas.tasks) && deltas.tasks.length > 0) {
          await localDb.tasks.bulkPut(deltas.tasks);
          hasNewDeltas = true;
        }
        if (Array.isArray(deltas.taskComments) && deltas.taskComments.length > 0) {
          await localDb.taskComments.bulkPut(deltas.taskComments);
          hasNewDeltas = true;
        }
        if (Array.isArray(deltas.pages) && deltas.pages.length > 0) {
          await localDb.pages.bulkPut(deltas.pages);
          hasNewDeltas = true;
        }
        if (Array.isArray(deltas.sharedPageIds)) {
          await localDb.syncMeta.put({ key: "sharedPageIds", value: deltas.sharedPageIds });
        }
      }

      // 3. Update lastSyncedAt marker
      if (currentServerTime) {
        await localDb.syncMeta.put({ key: "lastSyncedAt", value: currentServerTime });
      }

      // Broadcast to other open tabs that new deltas were applied locally
      if (hasNewDeltas) {
        this.broadcastChannel?.postMessage({ type: "SYNC_DELTAS_MERGED" });
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
        setTimeout(() => this.syncNow(true), 150);
      }
    }
  }
}

export const syncManager = new SyncManager();
