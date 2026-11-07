/**
 * POST /api/realtime/auth — Pusher private-channel auth endpoint (§6.5.2).
 * Pusher-js posts form-encoded `socket_id` + `channel_name`; we verify the
 * Better Auth session, then refuse any channel that does not name exactly
 * the session user (`private-user-<userId>` enforces ownership). Responses:
 * 200 auth signature / 400 invalid / 401 no session / 403 foreign channel /
 * 503 realtime not configured.
 */
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth/server";
import { logError } from "@/lib/logger";
import { canSubscribe } from "@/lib/realtime/channel";
import { getPusherServer } from "@/lib/realtime/server";

const authRequestSchema = z.object({
  socket_id: z.string().trim().min(1).max(200),
  channel_name: z.string().trim().min(1).max(200),
});

/** pusher-js posts urlencoded by default; accept a JSON body too. */
async function parseAuthRequest(request: Request): Promise<Record<string, string> | null> {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      const socketId = form.get("socket_id");
      const channelName = form.get("channel_name");
      if (typeof socketId !== "string" || typeof channelName !== "string") return null;
      return { socket_id: socketId, channel_name: channelName };
    }
    const body = (await request.json()) as Record<string, unknown>;
    return {
      socket_id: typeof body.socket_id === "string" ? body.socket_id : "",
      channel_name: typeof body.channel_name === "string" ? body.channel_name : "",
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  let session;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch (err) {
    logError("realtime-auth", "session lookup failed", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await parseAuthRequest(request);
  if (!form) return Response.json({ error: "Invalid request" }, { status: 400 });
  const parsed = authRequestSchema.safeParse(form);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const { socket_id, channel_name } = parsed.data;
  if (!canSubscribe(channel_name, session.user.id)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const pusher = getPusherServer();
  if (!pusher) {
    return Response.json({ error: "Realtime not configured" }, { status: 503 });
  }

  return Response.json(pusher.authorizeChannel(socket_id, channel_name));
}
