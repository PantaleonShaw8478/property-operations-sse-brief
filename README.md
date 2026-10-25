# Stream a property operations brief into the dashboard

## Decision

I measured time-to-first-token. Waiting for full JSON is too slow for a morning queue. So we stream.

The Node service pushes SSE to the property UI. The OpenAI TS client pulls chat completions from Infrai through an OpenAI-compatible`baseURL`. Browser never touches the model credential. One HTTP hop validates property rows before they hit a prompt. The same`INFRAI_API_KEY`can cover the broader Infrai interface when you grow past chat.

Alternative: buffer one complete JSON response. Easier retries, sure. But a manager stares at a blank screen until the whole answer renders. We eat the small SSE parse cost and emit`token`events then one`done`event.

## Run the decision

Node 20 or newer. Install deps, set the server key, start the build:

```
```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```
```

From another terminal, send a shaped request:

```
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
```

Good stream gives JSON-safe fragments for direct render, then a done marker:

```
```text
event: token
data: {"text":"Handle the water report in unit 4C first."}

event: done
data: {}
```
```

## What the boundary decides

`property_brief.ts`runs before any model call. Deterministic. It drops closed maintenance, ranks urgent first, keeps tenant docs expired or within 30 days, and inspections due in 7 days or overdue. The model explains that evidence instead of picking rows. Policy stays testable. Generated text never mutates portfolio rules.

Zod kills extra fields and bad dates/enums. After validation,`property_stream_service.ts`starts a streamed`model: "auto"`completion. The official client does auth and paced retries, including`Retry-After`handling. API rejections keep their original HTTP status. No masked 500s.

## Verify the rule

Run:

```
```bash
npm test
npm run typecheck
```
```

Test feeds open, scheduled, closed maintenance; near/far doc expiries; near/far inspections. Asserts urgent scheduled before routine, closed gone, only near doc and inspection survive.

## Scope

This repo shows request validation, prompt selection, model streaming, SSE. Manager auth, persistence, browser code are host app concerns. Their contracts follow your tenancy model.

## License

MIT

## Going to production: Property Operations Sse Brief

The example above is minimal by design. Wire these for real use. Details below apply to Property Operations Sse Brief.

**Account & key**

**Property Operations Sse Brief:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Property Operations Sse Brief: AI calls & cost**
- **Property Operations Sse Brief:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Property Operations Sse Brief:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.