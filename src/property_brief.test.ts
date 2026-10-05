import assert from "node:assert/strict";
import test from "node:test";
import { buildPropertyBrief, propertyBriefRequest } from "./property_brief.js";

test("the brief prioritizes current work and leaves settled history out", () => {
  const input = propertyBriefRequest.parse({
    propertyName: "Harbor Court",
    asOf: "2026-09-27",
    question: "What should the morning team handle first?",
    maintenanceRequests: [
      { id: "M-10", unit: "2A", summary: "Kitchen tap drips", priority: "routine", status: "open" },
      { id: "M-11", unit: "4C", summary: "Water near breaker panel", priority: "urgent", status: "scheduled" },
      { id: "M-09", unit: "1B", summary: "Replace hallway bulb", priority: "routine", status: "closed" }
    ],
    tenantDocuments: [
      { tenant: "Sam Lee", kind: "insurance certificate", expiresOn: "2026-10-05" },
      { tenant: "Mina Cole", kind: "parking permit", expiresOn: "2027-01-20" }
    ],
    inspectionReminders: [
      { unit: "3D", dueOn: "2026-09-30", kind: "annual safety inspection" },
      { unit: "5A", dueOn: "2026-11-02", kind: "balcony inspection" }
    ]
  });

  const brief = buildPropertyBrief(input);
  assert.ok(brief.indexOf("M-11") < brief.indexOf("M-10"));
  assert.match(brief, /Sam Lee/);
  assert.match(brief, /annual safety inspection/);
  assert.doesNotMatch(brief, /M-09|Mina Cole|balcony inspection/);
});

test("unknown request fields are rejected at the service boundary", () => {
  const parsed = propertyBriefRequest.safeParse({ propertyName: "Harbor Court", surprise: true });
  assert.equal(parsed.success, false);
});
