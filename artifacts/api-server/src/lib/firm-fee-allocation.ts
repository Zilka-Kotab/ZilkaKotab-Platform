import type { WorkflowBilling, FeeAllocation } from "@workspace/db";

export function feeAllocations(draft: WorkflowBilling, staff: { id: number; name: string }[]): FeeAllocation[] {
  const owner = staff.find((s) => s.id === draft.ownerId);
  const assignee = staff.find((s) => s.id === draft.assigneeId);
  if (!owner) throw new Error("Choose an active allocation owner.");
  if (draft.assigneeId != null && !assignee) throw new Error("Choose an active allocation assignee.");
  if (!assignee && draft.assigneeShareBasisPoints > 0) throw new Error("Choose the assignee receiving this share.");
  if (draft.ownerId === draft.assigneeId && draft.assigneeShareBasisPoints > 0) throw new Error("Owner and paid assignee must be different people.");
  const ownerCents = draft.ownerFixedCents ?? Math.round(draft.amountCents * draft.ownerShareBasisPoints / 10000);
  const assigneeCents = Math.round(draft.amountCents * draft.assigneeShareBasisPoints / 10000);
  if (ownerCents + assigneeCents > draft.amountCents) throw new Error("Owner and assignee allocations cannot exceed the gross fee.");
  return [
    { userId: owner.id, name: owner.name, role: "OWNER", amountCents: ownerCents },
    ...(assignee ? [{ userId: assignee.id, name: assignee.name, role: "ASSIGNEE" as const, amountCents: assigneeCents }] : []),
  ];
}

export function workflowBillValues(draft: WorkflowBilling, allocations: FeeAllocation[]) {
  return {
    ownerId: draft.ownerId, kind: "FEE", amountCents: draft.amountCents,
    description: draft.itemShort, code: draft.code, jurisdiction: draft.jurisdiction,
    subjectMatter: draft.subjectMatter,
    associate: allocations.find((a) => a.role === "ASSIGNEE")?.name ?? "",
    notes: [draft.description, draft.details, draft.notes].filter(Boolean).join("\n\n"),
    shareBasisPoints: draft.ownerFixedCents == null ? draft.ownerShareBasisPoints :
      draft.amountCents ? Math.round(draft.ownerFixedCents * 10000 / draft.amountCents) : 0,
    allocations,
  };
}
