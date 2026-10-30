import type { FirmWorkflowRow } from '@/lib/hooks-firm-operations';

/** Operational urgency: the EARLIER of priority deadline and official due date. Never hides official overdue. */
export function urgencyDate(r: Pick<FirmWorkflowRow, 'dueDate' | 'priorityDeadline'>): string | null {
  const p = r.priorityDeadline ?? null; const d = r.dueDate ?? null;
  if (p && d) return p < d ? p : d;
  return p ?? d;
}
