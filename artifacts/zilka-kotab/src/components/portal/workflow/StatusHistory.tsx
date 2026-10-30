import { useFirmStatusHistory } from '@/lib/hooks-firm-operations';
import { errorText } from '@/components/portal/StaffOnly';

export function StatusHistory({ id }: { id: string }) {
  const q = useFirmStatusHistory(id, true);
  if (q.isLoading) return <div className="space-y-1.5" data-testid={`history-loading-${id}`}>{[0, 1, 2].map((i) => <div key={i} className="h-6 animate-pulse rounded bg-muted" />)}</div>;
  if (q.isError) return <p role="alert" className="text-xs text-rose-800">{errorText(q.error, 'History could not be loaded.')} <button type="button" onClick={() => void q.refetch()} className="underline">Retry</button></p>;
  // API uses insertion order, including tied timestamps and backdated reached dates.
  const events = [...(q.data?.events ?? [])].reverse();
  if (events.length === 0) return <p className="text-xs text-muted-foreground" data-testid={`history-empty-${id}`}>No status updates logged yet.</p>;
  return (
    <ol className="space-y-1" data-testid={`list-history-${id}`}>
      <li className="grid grid-cols-[28px_120px_96px_1fr_170px] gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"><span>#</span><span>Status</span><span>Date</span><span>Note</span><span>Logged by</span></li>
      {events.map((e, i) => (
        <li key={e.publicId} data-testid={`history-event-${e.publicId}`} className={`grid grid-cols-[28px_120px_96px_1fr_170px] gap-2 rounded px-0 py-1 text-xs ${i === events.length - 1 ? 'font-medium' : ''}`}>
          <span className="font-mono text-muted-foreground">{i + 1}</span>
          <span className="font-semibold text-primary">{e.status}</span>
          <span className="font-mono tabular-nums">{e.statusDate ?? 'No date'}</span>
          <span className="whitespace-pre-wrap break-words">{e.note || <span className="text-muted-foreground">—</span>}</span>
          <span className="text-muted-foreground">{e.actorName || 'System'} · {new Date(e.recordedAt).toLocaleString()}</span>
        </li>
      ))}
      <li className="pt-1 text-[10px] text-muted-foreground">Oldest first. Last row is the current status.</li>
    </ol>
  );
}
