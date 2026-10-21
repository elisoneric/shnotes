import { getSessionUser } from "@/lib/auth";
import { syncSubscribers } from "@/lib/syncEvents";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const clientCallback = (msg: string) => {
        try {
          controller.enqueue(new TextEncoder().encode(msg));
        } catch {
          syncSubscribers.delete(clientCallback);
        }
      };

      syncSubscribers.add(clientCallback);

      // Send initial connection handshake
      const initial = `event: connected\ndata: ${JSON.stringify({ status: "connected", timestamp: Date.now() })}\n\n`;
      controller.enqueue(new TextEncoder().encode(initial));

      // Keep alive heartbeat every 25 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          syncSubscribers.delete(clientCallback);
        }
      }, 25000);

      // Clean up when client disconnects
      return () => {
        clearInterval(heartbeat);
        syncSubscribers.delete(clientCallback);
      };
    },
    cancel() {
      // Stream cancelled by client
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
