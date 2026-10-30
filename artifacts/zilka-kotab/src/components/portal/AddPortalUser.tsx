import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useCreateAdminUser } from '@/lib/hooks-portal';
import { errorText, fieldClass } from '@/components/portal/StaffOnly';
import type { PortalUser } from '@/lib/api-portal';

/** Admin-only: grants ACTIVE portal access to a firm attorney or paralegal. No invitation email is sent. */
export function AddPortalUser() {
  const create = useCreateAdminUser();
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ATTORNEY' | 'PARALEGAL'>('ATTORNEY');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    try {
      const res = await create.mutateAsync({ name: name.trim(), email: email.trim().toLowerCase(), role, status: 'ACTIVE' } as Partial<PortalUser>);
      await client.invalidateQueries({ queryKey: ['portal'] });
      setMsg({ ok: true, text: `${res.user?.email ?? email} now has active ${role.toLowerCase()} access. Ask them to use this exact email on the portal sign-in page. New users can request an activation invitation there.` });
      setName(''); setEmail('');
    } catch (reason) { setMsg({ ok: false, text: errorText(reason, 'The user could not be added.') }); }
  };

  return (
    <section aria-label="Add portal user" data-testid="panel-add-user" className="mt-6 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-primary" /><h2 className="font-semibold">Add firm user</h2><span className="rounded bg-[#c49a49]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8a6420]">Admin</span></div>
      <p className="mt-1 text-xs text-muted-foreground">Grants active portal access immediately. The person must verify this approved email through Clerk. No email is sent when saving this form; new users can request an activation invitation from the sign-in page. Client and project access is not granted here.</p>
      <form onSubmit={(e) => void submit(e)} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.3fr_160px_auto] sm:items-end">
        <label className="text-xs font-medium">Name<input required data-testid="input-new-user-name" value={name} onChange={(e) => setName(e.target.value)} className={`${fieldClass} mt-1`} /></label>
        <label className="text-xs font-medium">Organizational email<input required type="email" data-testid="input-new-user-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@zilkakotab.com" className={`${fieldClass} mt-1`} /></label>
        <label className="text-xs font-medium">Role<select data-testid="select-new-user-role" value={role} onChange={(e) => setRole(e.target.value as 'ATTORNEY' | 'PARALEGAL')} className={`${fieldClass} mt-1`}><option value="ATTORNEY">Attorney</option><option value="PARALEGAL">Paralegal</option></select></label>
        <button type="submit" disabled={create.isPending} data-testid="button-add-user" className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{create.isPending ? 'Adding' : 'Grant access'}</button>
      </form>
      {msg && <p role={msg.ok ? 'status' : 'alert'} data-testid="status-add-user" className={`mt-3 rounded-md px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{msg.text}</p>}
    </section>
  );
}
