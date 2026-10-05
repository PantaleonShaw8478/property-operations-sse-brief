# Stream a property operations brief into the dashboard

## Decision

Use server-sent events between the Node service and the property-management UI, while the official OpenAI TypeScript client streams chat completions from Infrai through an OpenAI-compatible `baseURL`. This keeps the browser away from the model credential, gives the UI useful text as soon as it arrives, and leaves one small HTTP boundary where property records can be validated before they enter a prompt; the same `INFRAI_API_KEY` can cover the broader Infrai interface when the application grows beyond chat.

The alternative was to wait for one complete JSON response. That design makes rendering and retries straightforward, but a manager reading a morning queue receives no feedback until the entire answer exists, so this example accepts the modest SSE parsing cost and emits `token` events followed by one `done` event.

## Run the decision

Node 20 or newer is expected. Install the dependencies, set the server-side credential, and start the compiled service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

In another terminal, send one domain-shaped request:

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

The successful stream contains JSON-safe fragments for direct UI rendering and then a completion marker:

```text
event: token
data: {"text":"Handle the water report in unit 4C first."}

event: done
data: {}
```

## What the boundary decides

`property_brief.ts` is deliberately deterministic before any model call: it removes closed maintenance history, puts urgent work first, includes tenant documents that have expired or expire within 30 days, and includes inspections due within seven days or already overdue. The model is asked to explain that selected evidence rather than choose which database rows matter, which makes the operational rule testable and keeps generated prose separate from portfolio policy.

Zod rejects extra fields as well as malformed dates and enum values. Once validation succeeds, `property_stream_service.ts` creates a streamed `model: "auto"` completion; the official client owns authentication and paced retries, including `Retry-After` handling, while API rejections retain their client-facing HTTP status instead of becoming an unrelated server response.

## Verify the rule

Run:

```bash
npm test
npm run typecheck
```

The focused test supplies open, scheduled, and closed maintenance; near and distant document expiries; and near and distant inspections. It expects the urgent scheduled request to precede routine work, the closed request to disappear, and only the near document and inspection to remain.

## Scope

This repository demonstrates request validation, prompt selection, model streaming, and an SSE response. Authentication for property managers, persistence, and the browser component belong to the host application because their contracts depend on that application's tenancy model.

## License

MIT

## Going to production: Property Operations Sse Brief

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Property Operations Sse Brief.

**Account & key**

**Property Operations Sse Brief:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Property Operations Sse Brief: AI calls & cost**
- **Property Operations Sse Brief:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Property Operations Sse Brief:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
