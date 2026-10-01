// Minimal newline-delimited-JSON streaming protocol shared between the
// stream-resolving API routes (server) and the players that call them
// (client), so playback can show real progress instead of one opaque spinner.
//
// Each line is one JSON object: {type:"status", message} while working,
// then a single terminal {type:"result", ...} or {type:"error", error, trace?}.

export function ndjsonResponse(executor: (send: (obj: object) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        await executor(send);
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

export async function readNdjsonStream<T extends Record<string, unknown>>(
  response: Response,
  onStatus: (message: string) => void
): Promise<T> {
  if (!response.body) throw new Error("No response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      if (msg.type === "status") onStatus(msg.message);
      else if (msg.type === "result") return msg as T;
      else if (msg.type === "error") throw new Error(msg.error || "Stream failed");
    }
  }
  throw new Error("Connection closed unexpectedly");
}
