// Pure helpers for workflow billing drafts and stage history.
import type { FirmWorkflowBilling } from '@workspace/api-client-react';

export type AllocInput = Pick<FirmWorkflowBilling, 'ownerShareBasisPoints' | 'ownerFixedCents' | 'assigneeShareBasisPoints'>;

/** Owner and assignee each take a share of GROSS. Owner fixed cents override owner percent. */
export function allocate(gross: number, d: AllocInput) {
  const ownerCents = d.ownerFixedCents != null ? d.ownerFixedCents : Math.round((gross * d.ownerShareBasisPoints) / 10000);
  const assigneeCents = Math.round((gross * d.assigneeShareBasisPoints) / 10000);
  const firmCents = gross - ownerCents - assigneeCents;
  return { ownerCents, assigneeCents, firmCents, over: firmCents < 0 };
}

export const percentToBp = (s: string): number | null => {
  const n = Number(s);
  return s.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) : null;
};
export const bpToPercent = (bp: number) => String(bp / 100);
