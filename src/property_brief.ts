import { z } from "zod";

const dateText = z.string().date();

export const propertyBriefRequest = z.object({
  propertyName: z.string().min(1).max(120),
  asOf: dateText,
  question: z.string().min(1).max(500),
  maintenanceRequests: z.array(z.object({
    id: z.string().min(1).max(80),
    unit: z.string().min(1).max(40),
    summary: z.string().min(1).max(300),
    priority: z.enum(["routine", "urgent"]),
    status: z.enum(["open", "scheduled", "closed"])
  })).max(100),
  tenantDocuments: z.array(z.object({
    tenant: z.string().min(1).max(120),
    kind: z.string().min(1).max(80),
    expiresOn: dateText
  })).max(100),
  inspectionReminders: z.array(z.object({
    unit: z.string().min(1).max(40),
    dueOn: dateText,
    kind: z.string().min(1).max(100)
  })).max(100)
}).strict();

export type PropertyBriefRequest = z.infer<typeof propertyBriefRequest>;

function daysFrom(asOf: string, date: string): number {
  return Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / 86_400_000);
}

export function buildPropertyBrief(input: PropertyBriefRequest): string {
  const actionableMaintenance = input.maintenanceRequests.filter((item) => item.status !== "closed");
  const documentWindow = input.tenantDocuments.filter((item) => daysFrom(input.asOf, item.expiresOn) <= 30);
  const inspectionWindow = input.inspectionReminders.filter((item) => daysFrom(input.asOf, item.dueOn) <= 7);

  const lines = [
    `Property: ${input.propertyName}`,
    `As of: ${input.asOf}`,
    `Resident manager question: ${input.question}`,
    "",
    "Open maintenance, with urgent items first:",
    ...actionableMaintenance
      .sort((a, b) => Number(b.priority === "urgent") - Number(a.priority === "urgent"))
      .map((item) => `- [${item.priority}] ${item.id}, unit ${item.unit}: ${item.summary} (${item.status})`),
    "",
    "Tenant documents expired or expiring within 30 days:",
    ...documentWindow.map((item) => `- ${item.tenant}: ${item.kind}, ${item.expiresOn}`),
    "",
    "Inspections due within 7 days or overdue:",
    ...inspectionWindow.map((item) => `- Unit ${item.unit}: ${item.kind}, ${item.dueOn}`)
  ];

  return lines.join("\n");
}

export const systemInstruction = [
  "You are a property operations assistant.",
  "Answer the manager's question using only the supplied brief.",
  "Write compact Markdown for a dashboard panel.",
  "Lead with the next action, then explain the evidence under Maintenance, Documents, and Inspections headings.",
  "Do not invent dates, tenants, units, or work status."
].join(" ");
