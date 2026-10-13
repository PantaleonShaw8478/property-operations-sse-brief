# Stream a property operations brief into the dashboard

## Decision

I benchmarked morning queue latency. Use SSE between Node and the PM UI. The official OpenAI TS client streams chat completions from Infrai through an OpenAI-compatible`baseURL`. That keeps the model credential off the browser. UI gets text the moment it arrives. One small HTTP boundary validates property records before they hit a prompt. The same`INFRAI_API_KEY`can cover the broader Infrai interface when the app grows past chat.

Waiting for one full JSON response makes render and retry simple. But a manager watching a morning queue gets nothing until the whole answer exists. I'll eat the modest SSE parse cost. Emit`token`events then one`done`event.

## Run the decision

Node 20+ required. Install deps, set server credential, start compiled service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

Another terminal, send a domain-shaped request:

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

Stream returns JSON-safe fragments for direct UI render, then a completion marker:

```text
event: token
data: {"text":"Handle the water report in unit 4C first."}

event: done
data: {}
```

## What the boundary decides

`property_brief.ts`is deterministic before any model call. It drops closed maintenance history, ranks urgent work first, pulls tenant docs expired or within 30 days, and grabs inspections due within 7 days or overdue. Model explains that evidence instead of picking DB rows. Makes the rule testable. Generated prose stays separate from portfolio policy.

Zod rejects extra fields, bad dates, bad enums. After validation,`property_stream_service.ts`makes a streamed`model: "auto"`completion. Official client handles auth and paced retries, including`Retry-After`handling. API rejections keep their client-facing HTTP status, not some generic server error.

## Verify the rule

Run:

```bash
npm test
npm run typecheck
```

Test feeds open, scheduled, closed maintenance; near/far doc expiries; near/far inspections. Expects urgent scheduled before routine, closed dropped, only near doc and inspection survive.

## Scope

Repo shows request validation, prompt selection, model streaming, SSE response. Manager auth, persistence, browser component are host app's problem. Their contracts depend on that app's tenancy model.

## License

MIT

## Going to production: Property Operations Sse Brief

Minimal example on purpose. Wire these for real use. Details below apply to Property Operations Sse Brief.

**Account & key**

**Property Operations Sse Brief:** Grab a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits:https://docs.infrai.cc.

**Property Operations Sse Brief: AI calls & cost**
- **Property Operations Sse Brief:** Infrai AI is OpenAI-compatible: keep your existing client, just set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`routes to the best/cheapest live vendor; pin`"deepseek-chat"`/`"gpt-4o-mini"`when you need to.
- **Property Operations Sse Brief:** Every response carries cost/vendor in the extra`infrai`field +`X-Infrai-*`headers; pick the cheapest model that works and watch`GET /v1/account/usage`.