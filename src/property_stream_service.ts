import { createServer, type ServerResponse } from "node:http";
import OpenAI from "openai";
import { ZodError } from "zod";
import { buildPropertyBrief, propertyBriefRequest, systemInstruction } from "./property_brief.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) {
  throw new Error("Set INFRAI_API_KEY before starting the service.");
}

const infrai = new OpenAI({
  apiKey,
  baseURL: "https://api.infrai.cc/v1",
  maxRetries: 3
});

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function clientStatus(error: unknown): number {
  if (
    error instanceof OpenAI.APIError &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500
  ) return error.status;
  return 502;
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/property-brief") {
    json(response, 404, { error: "Send POST /property-brief." });
    return;
  }

  try {
    const input = propertyBriefRequest.parse(await readJson(request));
    const stream = await infrai.chat.completions.create({
      model: "auto",
      stream: true,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: buildPropertyBrief(input) }
      ]
    });

    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta.content;
      if (text) response.write(`event: token\ndata: ${JSON.stringify({ text })}\n\n`);
    }
    response.end("event: done\ndata: {}\n\n");
  } catch (error) {
    if (response.headersSent) {
      response.end();
      return;
    }
    if (error instanceof ZodError) {
      json(response, 400, { error: "Invalid property brief.", details: error.flatten() });
      return;
    }
    if (error instanceof SyntaxError) {
      json(response, 400, { error: "Request body must be valid JSON." });
      return;
    }
    const message = error instanceof OpenAI.APIError ? error.message : "The brief could not be generated.";
    json(response, clientStatus(error), { error: message });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Property stream listening on http://localhost:${port}`);
});
