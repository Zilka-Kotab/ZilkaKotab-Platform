import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { usePortalAccess } from '@/lib/hooks-portal';
import PortalDashboard from './Dashboard';

const STAFF = ['ADMIN', 'ATTORNEY', 'PARALEGAL'];

/** /portal: staff land on the Dashboard workflow tab; clients keep the portal overview. */
export default function PortalHome() {
  const role = usePortalAccess().data?.user?.role ?? '';
  const [, navigate] = useLocation();
  const staff = STAFF.includes(role);
  useEffect(() => { if (staff) navigate('/portal/internal-workflow', { replace: true }); }, [staff, navigate]);
  if (staff) return <div className="mx-auto max-w-[1600px] px-4 py-10 sm:px-9"><div className="h-28 animate-pulse rounded-xl bg-muted" /></div>;
  return <PortalDashboard />;
}
