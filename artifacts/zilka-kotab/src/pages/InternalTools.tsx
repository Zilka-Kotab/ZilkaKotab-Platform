import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserButton, useUser } from '@clerk/react';
import { CheckCircle2, LockKeyhole, ShieldAlert, UserPlus, Wrench } from 'lucide-react';
import { SEO } from '@/components/SEO';

type AccessStatus = {
  status: 'approved' | 'pending' | 'unverified';
  approved: boolean;
  role: 'admin' | 'user' | null;
  email?: string;
};

type AccessUser = {
  id: number;
  email: string;
  role: 'admin' | 'user';
  approved: boolean;
  activated: boolean;
  createdAt: string;
  updatedAt: string;
};

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? 'The request could not be completed.');
  return body as T;
}

function AdminPanel() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const users = useQuery({
    queryKey: ['internal-access-users'],
    queryFn: () => apiRequest<{ users: AccessUser[] }>('/api/internal/users'),
  });
  const addUser = useMutation({
    mutationFn: () =>
      apiRequest('/api/internal/users', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      }),
    onSuccess: () => {
      setEmail('');
      setRole('user');
      queryClient.invalidateQueries({ queryKey: ['internal-access-users'] });
    },
  });
  const updateUser = useMutation({
    mutationFn: ({ id, approved, nextRole }: { id: number; approved: boolean; nextRole: 'admin' | 'user' }) =>
      apiRequest(`/api/internal/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ approved, role: nextRole }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['internal-access-users'] }),
  });

  return (
    <section className="mt-8 rounded-2xl border border-border bg-white p-6 shadow-lg md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <UserPlus className="h-6 w-6 text-accent" />
        <div>
          <h2 className="text-2xl font-semibold font-display text-foreground">Access management</h2>
          <p className="text-sm text-muted-foreground">Approve an email before the person activates an account.</p>
        </div>
      </div>

      <form
        className="grid gap-3 md:grid-cols-[1fr_150px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          addUser.mutate();
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="employee@example.com"
          className="rounded-lg border border-border px-4 py-3 text-foreground"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as 'admin' | 'user')}
          className="rounded-lg border border-border px-4 py-3 text-foreground"
        >
          <option value="user">Employee / guest</option>
          <option value="admin">Administrator</option>
        </select>
        <button
          type="submit"
          disabled={addUser.isPending}
          className="rounded-lg bg-primary px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {addUser.isPending ? 'Adding…' : 'Approve email'}
        </button>
      </form>
      {addUser.error && <p className="mt-3 text-sm text-red-700">{addUser.error.message}</p>}

      <div className="mt-8 overflow-x-auto">
        {users.isLoading ? (
          <p className="text-muted-foreground">Loading access list…</p>
        ) : users.error ? (
          <p className="text-red-700">{users.error.message}</p>
        ) : (
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-3 font-medium">Email</th>
                <th className="pb-3 font-medium">Account</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Access</th>
              </tr>
            </thead>
            <tbody>
              {users.data?.users.map((accessUser) => (
                <tr key={accessUser.id} className="border-b border-border/70">
                  <td className="py-4 pr-4 font-medium text-foreground">{accessUser.email}</td>
                  <td className="py-4 pr-4 text-muted-foreground">
                    {accessUser.activated ? 'Activated' : 'Awaiting activation'}
                  </td>
                  <td className="py-4 pr-4">
                    <select
                      value={accessUser.role}
                      disabled={updateUser.isPending}
                      onChange={(event) =>
                        updateUser.mutate({
                          id: accessUser.id,
                          approved: accessUser.approved,
                          nextRole: event.target.value as 'admin' | 'user',
                        })
                      }
                      className="rounded-md border border-border px-2 py-1"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="py-4">
                    <button
                      type="button"
                      disabled={updateUser.isPending}
                      onClick={() =>
                        updateUser.mutate({
                          id: accessUser.id,
                          approved: !accessUser.approved,
                          nextRole: accessUser.role,
                        })
                      }
                      className={`rounded-full px-3 py-1 font-semibold ${
                        accessUser.approved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {accessUser.approved ? 'Approved' : 'Revoked'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {updateUser.error && <p className="mt-3 text-sm text-red-700">{updateUser.error.message}</p>}
    </section>
  );
}

export default function InternalTools() {
  const { user } = useUser();
  const access = useQuery({
    queryKey: ['internal-access-status'],
    queryFn: () => apiRequest<AccessStatus>('/api/internal/access'),
    retry: false,
  });

  return (
    <>
      <SEO title="Internal Tools" description="Private tools for approved Zilka-Kotab employees and guests." url="/internal" />
      <main className="flex-1 bg-background px-4 py-16 md:py-24">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-10 flex items-start justify-between gap-6">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                <LockKeyhole className="h-4 w-4" /> Private workspace
              </div>
              <h1 className="text-4xl font-bold font-display text-foreground md:text-6xl">
                Welcome{user?.firstName ? `, ${user.firstName}` : ''}
              </h1>
            </div>
            <UserButton />
          </div>

          {access.isLoading && (
            <section className="rounded-2xl border border-border bg-white p-8 shadow-lg">
              <p className="text-muted-foreground">Confirming your access…</p>
            </section>
          )}
          {access.error && (
            <section className="rounded-2xl border border-red-200 bg-red-50 p-8">
              <ShieldAlert className="mb-4 h-8 w-8 text-red-700" />
              <h2 className="text-2xl font-semibold text-red-900">Unable to confirm access</h2>
              <p className="mt-2 text-red-800">{access.error.message}</p>
            </section>
          )}
          {access.data && !access.data.approved && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-8">
              <ShieldAlert className="mb-4 h-8 w-8 text-amber-700" />
              <h2 className="text-2xl font-semibold text-amber-950">Access is pending</h2>
              <p className="mt-2 max-w-2xl text-amber-900">
                Your identity is signed in, but this email has not been approved for private firm tools.
                Contact the firm administrator if you believe this is an error.
              </p>
            </section>
          )}
          {access.data?.approved && (
            <>
              <section className="rounded-2xl border border-border bg-white p-8 shadow-lg md:p-12">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-accent/15">
                  <Wrench className="h-7 w-7 text-accent" />
                </div>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-green-700">
                  <CheckCircle2 className="h-4 w-4" /> Approved access
                </div>
                <h2 className="text-2xl font-semibold font-display text-foreground">Internal tools are coming soon</h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
                  Your account is authorized. Employee resources and private utilities will appear here.
                </p>
              </section>
              {access.data.role === 'admin' && <AdminPanel />}
            </>
          )}
        </div>
      </main>
    </>
  );
}