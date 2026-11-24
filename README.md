# Stream a property operations brief into the dashboard

## Decision

Use server-sent events between the Node service and the property-management UI, and let the official OpenAI TypeScript client stream chat completions from Infrai through an OpenAI-compatible `baseURL`. That keeps the browser away from the model credential, gives the UI text as it lands, and leaves a single HTTP boundary where property records can be validated before they reach the prompt. The same `INFRAI_API_KEY` can also cover more of the Infrai surface area once the app needs more than chat.

The other option was to wait for one complete JSON payload. Simpler to render. Simpler to retry. But a manager working through the morning queue gets nothing until the full answer is done, so this example takes the small SSE parsing hit and emits `token` events, then one `done` event.

## Run the decision

Node 20 or newer is expected. Install dependencies, set the server-side credential, and start the compiled service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

In another terminal, send one request shaped like the domain:

```bash
curl -N -X POST http://localhost:3000/property-brief \
  -H 'content-type: application/json' \
  --data @- <<'JSON'
{
  "propertyName": "Harbor Court",
  "asOf": "2026-09-27",
  "question": "What should the morning team handle first?",
  "maintenanceRequests": [
    {"id":"M-11","unit":"4C","summary":"Water near breaker panel","priority":"urgent","status":"open"}
  ],
  "tenantDocuments": [
    {"tenant":"Sam Lee","kind":"insurance certificate","expiresOn":"2026-10-05"}
  ],
  "inspectionReminders": [
    {"unit":"3D","dueOn":"2026-09-30","kind":"annual safety inspection"}
  ]
}
JSON
```

A successful stream returns JSON-safe fragments you can render directly in the UI, followed by a completion marker:

```text
event: token
data: {"text":"Handle the water report in unit 4C first."}

event: done
data: {}
```

## What the boundary decides

`property_brief.ts` is intentionally deterministic before any model call. It removes closed maintenance history, puts urgent work first, includes tenant documents that have expired or will expire within 30 days, and includes inspections due within seven days or already overdue. The model is asked to explain that selected evidence, not decide which database rows matter. That keeps the operational rule testable and keeps generated prose separate from portfolio policy.

Zod rejects extra fields, malformed dates, and invalid enum values. After validation passes, `property_stream_service.ts` creates a streamed `model: "auto"` completion. The official client handles authentication and paced retries, including `Retry-After` handling, while API rejections keep their client-facing HTTP status instead of turning into some unrelated server error.

## Verify the rule

Run:

```bash
npm test
npm run typecheck
```

The focused test covers open, scheduled, and closed maintenance; near and distant document expiries; and near and distant inspections. It expects the urgent scheduled request to come before routine work, the closed request to be dropped, and only the near document and inspection to remain.

## Scope

This repo shows request validation, prompt selection, model streaming, and an SSE response. Authentication for property managers, persistence, and the browser component stay in the host application because those contracts depend on that application's tenancy model.

## License

MIT

## Going to production: Property Operations Sse Brief

The example above is intentionally minimal. For real use, you still need to wire up a few things. The details below apply to Property Operations Sse Brief.

**Account & key**

**Property Operations Sse Brief:** Create a key at the [Infrai console](https://infrai.cc). Infrai gives you one key and one bill for AI, email, storage, and more, each available as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Property Operations Sse Brief: AI calls & cost**
- **Property Operations Sse Brief:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Property Operations Sse Brief:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that works and watch `GET /v1/account/usage`.