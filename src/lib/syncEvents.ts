// In-memory pubsub event channel for Server-Sent Events sync broadcasting
type ClientCallback = (data: string) => void;

// Maintain active subscribers in global scope for development and hot reloads
const globalForSync = globalThis as unknown as {
  syncSubscribers?: Set<ClientCallback>;
};

export const syncSubscribers = globalForSync.syncSubscribers || new Set<ClientCallback>();
if (process.env.NODE_ENV !== "production") {
  globalForSync.syncSubscribers = syncSubscribers;
}

export function notifySyncClients() {
  const payload = JSON.stringify({ type: "change", timestamp: Date.now() });
  const message = `event: change\ndata: ${payload}\n\n`;
  for (const client of syncSubscribers) {
    try {
      client(message);
    } catch {
      syncSubscribers.delete(client);
    }
  }
}
