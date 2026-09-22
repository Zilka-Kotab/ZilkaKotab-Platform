import { FormEvent, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import {
  Archive,
  ArrowLeft,
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  FileSearch,
  Filter,
  LockKeyhole,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  ShieldAlert,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { SEO } from '@/components/SEO';
import {
  useCommitPatentImport,
  useCreateManualAnalysis,
  useCreatePatent,
  useCreateWorkspaceItem,
  usePortalAccess,
  usePreviewPatentImport,
  useProjectWorkspace,
  useRefreshPatent,
  useUpdateClaimMonitoringSelection,
  useUpdatePatentArchive,
  useUpdatePatentMonitoring,
} from '@/lib/hooks-portal';
import type { AnalysisTriage, DataClassification, MonitoredPatent, PatentImportDraft } from '@/lib/api-portal';

const providerLabels = {
  CLIENT_MICROSOFT: 'Client Microsoft environment',
  ZK_MANAGED_AI: 'Zilka-Kotab managed environment',
  MANUAL: 'Manual review',
};

const classificationLabels = {
  PUBLIC_SOURCE: 'Public source',
  CLIENT_CONFIDENTIAL: 'Client confidential',
  ATTORNEY_WORK_PRODUCT: 'Attorney work product',
};

type PatentFilter = 'ALL' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
type MetricLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT_ANALYZED';
type Recommendation = 'MAINTAIN' | 'REVIEW' | 'PRUNE' | 'NOT_ANALYZED';
type SortKey = 'patent' | 'monitoring' | 'recommendation' | 'citations';
type SortDirection = 'asc' | 'desc';
type MetricFilter = 'ALL' | MetricLevel;

const emptyRecommendation: Recommendation = 'NOT_ANALYZED';
const emptyMetric: MetricLevel = 'NOT_ANALYZED';

const metricLabel = (value: MetricLevel) => value === 'NOT_ANALYZED' ? '—' : value;
const recommendationLabel = (value: Recommendation) => value === 'NOT_ANALYZED' ? 'Not analyzed' : value;
const recommendationTone = (value: Recommendation) => value === 'NOT_ANALYZED'
  ? 'border-slate-200 bg-slate-50 text-slate-500'
  : value === 'MAINTAIN'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : value === 'REVIEW'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-red-200 bg-red-50 text-red-700';
const metricTone = (value: MetricLevel) => value === 'NOT_ANALYZED'
  ? 'text-slate-400'
  : value === 'HIGH'
    ? 'text-red-700'
    : value === 'MEDIUM'
      ? 'text-amber-700'
      : 'text-emerald-700';

function dateLabel(value?: string | null) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded';
}

function StatusPill({ active, archived }: { active: boolean; archived: boolean }) {
  if (archived) return <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600"><Archive className="h-3 w-3" /> Archived</span>;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-amber-500'}`} />{active ? 'Monitoring' : 'Paused'}</span>;
}

function PatentRowActions({
  patent,
  canManageMonitoring,
  canArchive,
  onOpen,
}: {
  patent: MonitoredPatent;
  canManageMonitoring: boolean;
  canArchive: boolean;
  onOpen: () => void;
}) {
  const refresh = useRefreshPatent(patent.publicId);
  const monitoring = useUpdatePatentMonitoring(patent.publicId);
  const archive = useUpdatePatentArchive(patent.publicId);
  const isArchived = Boolean(patent.archivedAt);
  const [open, setOpen] = useState(false);

  const archiveRecord = () => {
    const action = isArchived ? 'restore' : 'archive';
    if (window.confirm(`Are you sure you want to ${action} ${patent.patentNumber}?`)) {
      archive.mutate(!isArchived);
    }
  };

  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <button type="button" aria-label={`Actions for ${patent.patentNumber}`} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>
      {open && <div className="absolute right-0 top-10 z-20 min-w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl">
        <button type="button" onClick={() => { setOpen(false); onOpen(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" /> Open full detail</button>
        {!isArchived && canManageMonitoring && <button type="button" disabled={monitoring.isPending} onClick={() => { setOpen(false); monitoring.mutate(!patent.monitoringActive); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-muted disabled:opacity-50">{patent.monitoringActive ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}{patent.monitoringActive ? 'Pause monitoring' : 'Resume monitoring'}</button>}
        <button type="button" disabled={refresh.isPending} onClick={() => { setOpen(false); refresh.mutate(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-muted disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} /> Refresh from USPTO</button>
        {canArchive && <button type="button" disabled={archive.isPending} onClick={() => { setOpen(false); archiveRecord(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-muted-foreground hover:bg-red-50 hover:text-red-700 disabled:opacity-50">{isArchived ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}{isArchived ? 'Restore from archive' : 'Archive from project'}</button>}
        {(refresh.error || monitoring.error || archive.error) && <p className="px-3 py-2 text-[11px] text-red-700">{(refresh.error || monitoring.error || archive.error) instanceof Error ? (refresh.error || monitoring.error || archive.error)?.message : 'The requested row action could not be completed.'}</p>}
      </div>}
    </div>
  );
}

function PatentMonitoringButton({ patent, canManageMonitoring }: { patent: MonitoredPatent; canManageMonitoring: boolean }) {
  const monitoring = useUpdatePatentMonitoring(patent.publicId);
  if (!canManageMonitoring || patent.archivedAt) {
    return <div className="hidden md:block"><StatusPill active={patent.monitoringActive} archived={Boolean(patent.archivedAt)} /></div>;
  }
  return <button type="button" disabled={monitoring.isPending} className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] disabled:opacity-50 ${patent.monitoringActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'}`} onClick={() => monitoring.mutate(!patent.monitoringActive)}>{patent.monitoringActive ? 'Active' : 'Paused'}</button>;
}

function MetricToken({ label, value }: { label: string; value: MetricLevel }) {
  return <span className={`whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.08em] ${metricTone(value)}`}><span className="text-muted-foreground">{label}</span> {metricLabel(value)}</span>;
}

function RecommendationPill({ value }: { value: Recommendation }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${recommendationTone(value)}`}>{recommendationLabel(value)}</span>;
}

function CompactSortButton({ label, active, direction, onClick }: { label: string; active: boolean; direction: SortDirection; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 text-left text-[10px] font-bold uppercase tracking-[0.14em] transition ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>{label}{active ? direction === 'asc' ? <ArrowUpAZ className="h-3 w-3" /> : <ArrowDownAZ className="h-3 w-3" /> : <ArrowDownAZ className="h-3 w-3 opacity-40" />}</button>;
}

function ClaimSelectionPanel({ patent, canEdit, onClose }: { patent: MonitoredPatent; canEdit: boolean; onClose: () => void }) {
  const selection = useUpdateClaimMonitoringSelection(patent.publicId);
  const [selected, setSelected] = useState(() => patent.claims.filter((claim) => claim.claimType === 'INDEPENDENT' && claim.selectedForMonitoring).map((claim) => claim.claimNumber));
  const independent = patent.claims.filter((claim) => claim.claimType === 'INDEPENDENT');
  const dependent = patent.claims.filter((claim) => claim.claimType !== 'INDEPENDENT');
  const toggleClaim = (claimNumber: string, checked: boolean) => setSelected((current) => checked ? [...new Set([...current, claimNumber])] : current.filter((number) => number !== claimNumber));

  return <div className="mt-4 rounded-xl border border-primary/20 bg-card p-4 shadow-sm" onClick={(event) => event.stopPropagation()}>
    <div className="flex items-start justify-between gap-3"><div><h4 className="text-sm font-semibold">Full claim set</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">Independent claims can be selected for monitoring. Authoritative claim text and prior versions remain unchanged.</p></div><button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close full claim set"><X className="h-4 w-4" /></button></div>
    <div className="mt-4 space-y-2">
      {independent.map((claim) => <label key={claim.publicId} className={`flex gap-3 rounded-lg border p-3 ${canEdit ? 'cursor-pointer hover:border-primary/30 hover:bg-primary/[0.025]' : 'opacity-80'}`}><input type="checkbox" disabled={!canEdit} checked={selected.includes(claim.claimNumber)} onChange={(event) => toggleClaim(claim.claimNumber, event.target.checked)} className="mt-1 accent-[hsl(var(--primary))]" /><span className="min-w-0"><span className="text-xs font-semibold">Claim {claim.claimNumber} <span className="font-normal text-muted-foreground">· Independent · v{claim.version}</span></span><span className="mt-1 block whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{claim.claimText}</span></span></label>)}
      {!independent.length && <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No independent claims are stored for this record.</p>}
    </div>
    {dependent.length > 0 && <details className="mt-4 rounded-lg border border-border bg-muted/25 p-3"><summary className="cursor-pointer text-xs font-semibold">Dependent and other claims ({dependent.length})</summary><div className="mt-3 space-y-2">{dependent.map((claim) => <div key={claim.publicId} className="rounded-lg bg-card p-3"><p className="text-xs font-semibold">Claim {claim.claimNumber}{claim.dependsOnClaimNumber && <span className="ml-1 font-normal text-muted-foreground">· depends on {claim.dependsOnClaimNumber}</span>}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{claim.claimText}</p></div>)}</div></details>}
    {canEdit && <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] text-muted-foreground">{selected.length} independent claim{selected.length === 1 ? '' : 's'} selected</p><button type="button" disabled={selection.isPending || (independent.length > 0 && selected.length === 0)} onClick={() => selection.mutate(selected, { onSuccess: onClose })} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Check className="h-3.5 w-3.5" />{selection.isPending ? 'Saving…' : 'Save selection'}</button></div>}
    {selection.error && <p className="mt-3 text-xs text-red-700">{selection.error instanceof Error ? selection.error.message : 'The claim selection could not be saved.'}</p>}
  </div>;
}

export default function ProjectWorkspace() {
  const projectId = useParams().projectId ?? '';
  const [, setLocation] = useLocation();
  const [includeArchived, setIncludeArchived] = useState(false);
  const { data, isLoading, error } = useProjectWorkspace(projectId, includeArchived);
  const { data: access } = usePortalAccess();
  const createItem = useCreateWorkspaceItem(projectId);
  const createRun = useCreateManualAnalysis(projectId);
  const createPatent = useCreatePatent(projectId);
  const previewPatent = usePreviewPatentImport(projectId);
  const commitPatent = useCommitPatentImport(projectId);

  const [filter, setFilter] = useState<PatentFilter>('ALL');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [monitorFilter, setMonitorFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  const [recommendationFilter, setRecommendationFilter] = useState<Recommendation | 'ALL'>('ALL');
  const [claimScopeFilter, setClaimScopeFilter] = useState<MetricFilter>('ALL');
  const [detectabilityFilter, setDetectabilityFilter] = useState<MetricFilter>('ALL');
  const [hitsFilter, setHitsFilter] = useState<MetricFilter>('ALL');
  const [citationMin, setCitationMin] = useState('');
  const [citationMax, setCitationMax] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('patent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [claimSelectionId, setClaimSelectionId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [patentNumbers, setPatentNumbers] = useState('');
  const [drafts, setDrafts] = useState<PatentImportDraft[]>([]);
  const [selectedClaims, setSelectedClaims] = useState<Record<string, string[]>>({});
  const [manualDraft, setManualDraft] = useState<PatentImportDraft | null>(null);
  const [manual, setManual] = useState({ title: '', claimNumber: '1', claimText: '' });
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [item, setItem] = useState({ title: '', itemType: 'PUBLIC_EVIDENCE', content: '', classification: 'PUBLIC_SOURCE' as DataClassification });
  const [analysis, setAnalysis] = useState({ summary: '', triage: 'MEDIUM' as AnalysisTriage });

  const canCreateWorkProduct = access?.user?.role !== 'CLIENT';
  const canManageMonitoring = access?.user?.role === 'ADMIN' || access?.user?.role === 'ATTORNEY';
  const canArchive = canManageMonitoring;

  const patents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minimumCitations = citationMin === '' ? null : Number(citationMin);
    const maximumCitations = citationMax === '' ? null : Number(citationMax);
    const filtered = (data?.patents ?? []).filter((patent) => {
      const matchesFilter = (filter === 'ALL' && !patent.archivedAt)
        || (filter === 'ACTIVE' && !patent.archivedAt && patent.monitoringActive)
        || (filter === 'PAUSED' && !patent.archivedAt && !patent.monitoringActive)
        || (filter === 'ARCHIVED' && includeArchived && Boolean(patent.archivedAt));
      const matchesSearch = !query || patent.patentNumber.toLowerCase().includes(query) || patent.title.toLowerCase().includes(query);
      const matchesMonitoring = monitorFilter === 'ALL'
        || (monitorFilter === 'ACTIVE' && patent.monitoringActive && !patent.archivedAt)
        || (monitorFilter === 'PAUSED' && !patent.monitoringActive && !patent.archivedAt);
      const matchesRecommendation = recommendationFilter === 'ALL' || emptyRecommendation === recommendationFilter;
      const matchesClaimScope = claimScopeFilter === 'ALL' || emptyMetric === claimScopeFilter;
      const matchesDetectability = detectabilityFilter === 'ALL' || emptyMetric === detectabilityFilter;
      const matchesHits = hitsFilter === 'ALL' || emptyMetric === hitsFilter;
      const citations = null;
      const matchesCitationRange = (minimumCitations === null || (citations !== null && citations >= minimumCitations))
        && (maximumCitations === null || (citations !== null && citations <= maximumCitations));
      return matchesFilter && matchesSearch && matchesMonitoring && matchesRecommendation && matchesClaimScope && matchesDetectability && matchesHits && matchesCitationRange;
    });
    return [...filtered].sort((left, right) => {
      let comparison = 0;
      if (sortKey === 'patent') comparison = left.patentNumber.localeCompare(right.patentNumber, undefined, { numeric: true });
      if (sortKey === 'monitoring') comparison = Number(right.monitoringActive) - Number(left.monitoringActive);
      if (sortKey === 'recommendation') comparison = recommendationLabel(emptyRecommendation).localeCompare(recommendationLabel(emptyRecommendation));
      if (sortKey === 'citations') comparison = 0;
      return sortDirection === 'asc' ? comparison : comparison * -1;
    });
  }, [claimScopeFilter, citationMax, citationMin, data?.patents, detectabilityFilter, filter, hitsFilter, includeArchived, monitorFilter, recommendationFilter, search, sortDirection, sortKey]);

  const filtersActive = Boolean(search.trim() || monitorFilter !== 'ALL' || recommendationFilter !== 'ALL' || claimScopeFilter !== 'ALL' || detectabilityFilter !== 'ALL' || hitsFilter !== 'ALL' || citationMin || citationMax);
  const setSort = (nextKey: SortKey) => {
    if (sortKey === nextKey) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(nextKey);
      setSortDirection('asc');
    }
  };
  const clearFilters = () => {
    setSearch('');
    setMonitorFilter('ALL');
    setRecommendationFilter('ALL');
    setClaimScopeFilter('ALL');
    setDetectabilityFilter('ALL');
    setHitsFilter('ALL');
    setCitationMin('');
    setCitationMax('');
    setFilter('ALL');
  };

  if (isLoading) {
    return <div className="mx-auto max-w-7xl p-6 lg:p-8"><div className="animate-pulse space-y-5"><div className="h-5 w-32 rounded bg-muted" /><div className="h-12 w-3/4 rounded bg-muted" /><div className="h-24 rounded-2xl bg-muted" /><div className="h-72 rounded-2xl bg-muted" /></div></div>;
  }
  if (error || !data) {
    return <div className="mx-auto max-w-3xl p-6 lg:p-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"><p className="font-semibold">The project workspace could not be loaded.</p><p className="mt-1 text-red-700">Refresh the page or return to the portal and try again.</p><Link href="/portal" className="mt-4 inline-flex rounded-lg bg-red-800 px-3 py-2 font-semibold text-white">Back to portal</Link></div></div>;
  }

  const counts = {
    all: data.patents.filter((patent) => !patent.archivedAt).length,
    active: data.patents.filter((patent) => !patent.archivedAt && patent.monitoringActive).length,
    paused: data.patents.filter((patent) => !patent.archivedAt && !patent.monitoringActive).length,
    archived: data.patents.filter((patent) => Boolean(patent.archivedAt)).length,
  };

  const submitItem = (event: FormEvent) => {
    event.preventDefault();
    createItem.mutate(item, { onSuccess: () => setItem({ ...item, title: '', content: '' }) });
  };
  const submitAnalysis = (event: FormEvent) => {
    event.preventDefault();
    createRun.mutate(analysis, { onSuccess: () => setAnalysis({ ...analysis, summary: '' }) });
  };
  const submitPatent = (event: FormEvent) => {
    event.preventDefault();
    previewPatent.mutate(patentNumbers, {
      onSuccess: ({ drafts: nextDrafts }) => {
        setDrafts(nextDrafts);
        setPatentNumbers('');
        setSelectedClaims(Object.fromEntries(nextDrafts.map((draft) => [
          draft.publicId,
          draft.patent.claims.filter((claim) => claim.claimType === 'INDEPENDENT' && claim.selectedForMonitoring).map((claim) => claim.claimNumber),
        ])));
      },
    });
  };
  const commitDraft = (draft: PatentImportDraft) => {
    commitPatent.mutate(
      { draftId: draft.publicId, selectedClaimNumbers: selectedClaims[draft.publicId] ?? [] },
      { onSuccess: () => setDrafts((current) => current.filter((item) => item.publicId !== draft.publicId)) },
    );
  };
  const submitManual = (event: FormEvent) => {
    event.preventDefault();
    if (!manualDraft) return;
    createPatent.mutate({
      patentNumber: manualDraft.normalizedPatentNumber,
      title: manual.title,
      jurisdiction: 'US',
      claims: manual.claimText ? [{ claimNumber: manual.claimNumber, claimText: manual.claimText, claimType: 'UNKNOWN', selectedForMonitoring: false }] : [],
    }, {
      onSuccess: () => {
        setDrafts((current) => current.filter((draft) => draft.publicId !== manualDraft.publicId));
        setManualDraft(null);
        setManual({ title: '', claimNumber: '1', claimText: '' });
      },
    });
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <SEO title={data.project.name} description={`${data.tool.name} project workspace`} url={`/portal/projects/${projectId}`} />
      <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
        <div className="mb-7 flex items-center justify-between gap-4">
          <Link href="/portal" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground transition hover:text-primary"><ArrowLeft className="h-4 w-4" /> Portal</Link>
          <span className="hidden items-center gap-2 text-xs font-medium text-muted-foreground sm:inline-flex"><LockKeyhole className="h-3.5 w-3.5" /> Private workspace · {access?.user?.role ?? 'Authorized user'}</span>
        </div>

        <header className="mb-8 flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
          <div className="max-w-3xl">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">{data.client.name} <span className="mx-1.5 text-border">/</span> {data.tool.name}</p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{data.project.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{data.project.description || 'A private monitoring workspace for reviewing patent records and claim history.'}</p>
          </div>
           <div className="flex items-center gap-2">
             {canArchive && <button type="button" onClick={() => setIncludeArchived((value) => { if (value) setFilter('ALL'); return !value; })} className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition ${includeArchived ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border bg-card text-foreground hover:bg-muted/50'}`}><Archive className="h-4 w-4" /> {includeArchived ? 'Hide archived' : 'Show archived'}</button>}
            <button type="button" onClick={() => setAddOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"><Plus className="h-4 w-4" /> Add patent</button>
          </div>
        </header>

        <section className="mb-6 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
          <div className="bg-card px-5 py-4"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Portfolio</p><p className="mt-1 font-display text-2xl font-semibold">{counts.all}<span className="ml-1 text-sm font-medium text-muted-foreground">active records</span></p></div>
          <div className="bg-card px-5 py-4"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Monitoring</p><p className="mt-1 font-display text-2xl font-semibold text-emerald-700">{counts.active}<span className="ml-1 text-sm font-medium text-muted-foreground">running</span></p></div>
          <div className="bg-card px-5 py-4"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Claim records</p><p className="mt-1 font-display text-2xl font-semibold">{data.patents.reduce((total, patent) => total + patent.claims.length, 0)}<span className="ml-1 text-sm font-medium text-muted-foreground">stored</span></p></div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_35px_-26px_rgba(24,45,72,0.45)]">
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex items-center gap-2"><h2 className="font-display text-lg font-semibold">Monitored patents</h2><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{patents.length}</span></div>
                <p className="mt-1 text-xs text-muted-foreground">Compact portfolio triage. Expand a row for source details, monitored claims, and recorded findings.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative min-w-0 sm:w-64"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patent or title" className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none ring-primary/20 transition focus:ring-4" /></label>
                <button type="button" onClick={() => setFiltersOpen((value) => !value)} className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold ${filtersActive ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border bg-card text-foreground hover:bg-muted/50'}`}><SlidersHorizontal className="h-3.5 w-3.5" /> Filters{filtersActive && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">•</span>}</button>
                {filtersActive && <button type="button" onClick={clearFilters} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground"><X className="h-3.5 w-3.5" /> Clear</button>}
              </div>
            </div>
            <div className="mt-4 flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1">
              {([
                ['ALL', 'All', counts.all],
                ['ACTIVE', 'Monitoring', counts.active],
                ['PAUSED', 'Paused', counts.paused],
                ['ARCHIVED', 'Archived', counts.archived],
              ] as const).filter(([key]) => key !== 'ARCHIVED' || includeArchived).map(([key, label, count]) => <button key={key} type="button" onClick={() => setFilter(key)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filter === key ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{label} <span className="ml-1 text-[10px] opacity-70">{count}</span></button>)}
            </div>
            {filtersOpen && <div className="mt-4 grid gap-3 rounded-xl border border-border bg-muted/25 p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
              <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Monitoring<select value={monitorFilter} onChange={(event) => setMonitorFilter(event.target.value as typeof monitorFilter)} className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground"><option value="ALL">All states</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option></select></label>
              <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Recommendation<select value={recommendationFilter} onChange={(event) => setRecommendationFilter(event.target.value as Recommendation | 'ALL')} className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground"><option value="ALL">All</option><option value="NOT_ANALYZED">Not analyzed</option><option value="MAINTAIN">Maintain</option><option value="REVIEW">Review</option><option value="PRUNE">Prune</option></select></label>
              <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Claim scope<select value={claimScopeFilter} onChange={(event) => setClaimScopeFilter(event.target.value as MetricFilter)} className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground"><option value="ALL">All</option><option value="NOT_ANALYZED">Not analyzed</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label>
              <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Detectability<select value={detectabilityFilter} onChange={(event) => setDetectabilityFilter(event.target.value as MetricFilter)} className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground"><option value="ALL">All</option><option value="NOT_ANALYZED">Not analyzed</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label>
              <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Infringement hits<select value={hitsFilter} onChange={(event) => setHitsFilter(event.target.value as MetricFilter)} className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground"><option value="ALL">All</option><option value="NOT_ANALYZED">Not analyzed</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label>
              <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Cites min<input inputMode="numeric" value={citationMin} onChange={(event) => setCitationMin(event.target.value.replace(/\D/g, ''))} placeholder="—" className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground" /></label>
              <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Cites max<input inputMode="numeric" value={citationMax} onChange={(event) => setCitationMax(event.target.value.replace(/\D/g, ''))} placeholder="—" className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground" /></label>
            </div>}
          </div>

          <div className="hidden grid-cols-[minmax(240px,1.5fr)_minmax(130px,.7fr)_minmax(150px,.8fr)_minmax(290px,1.6fr)_48px] items-center gap-4 border-b border-border bg-muted/30 px-5 py-3 md:grid">
            <CompactSortButton label="Patent" active={sortKey === 'patent'} direction={sortDirection} onClick={() => setSort('patent')} />
            <CompactSortButton label="Monitoring" active={sortKey === 'monitoring'} direction={sortDirection} onClick={() => setSort('monitoring')} />
            <CompactSortButton label="Recommendation" active={sortKey === 'recommendation'} direction={sortDirection} onClick={() => setSort('recommendation')} />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><CompactSortButton label="AI metrics" active={sortKey === 'citations'} direction={sortDirection} onClick={() => setSort('citations')} /><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Claims · Detect · Hits · Cites</span></div>
            <span className="text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Actions</span>
          </div>
          <div className="divide-y divide-border">
            {patents.map((patent) => {
              const expanded = expandedId === patent.publicId;
              const selectedClaimsForMonitoring = patent.claims.filter((claim) => claim.claimType === 'INDEPENDENT' && claim.selectedForMonitoring);
              const findings = data.analysisRuns.filter((run) => run.patentId === patent.publicId);
              const findingCounts = findings.reduce((countsByTriage, run) => {
                countsByTriage[run.triage] += 1;
                return countsByTriage;
              }, { HIGH: 0, MEDIUM: 0, LOW: 0 });
              const toggleExpanded = () => {
                setExpandedId(expanded ? null : patent.publicId);
                if (expanded) setClaimSelectionId(null);
              };
              return (
                <div key={patent.publicId} className={`${expanded ? 'bg-primary/[0.035]' : 'bg-card'} transition-colors`}>
                  <div role="button" tabIndex={0} onClick={toggleExpanded} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleExpanded(); } }} className="grid cursor-pointer gap-3 px-4 py-3 outline-none transition hover:bg-primary/[0.035] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5 md:grid-cols-[minmax(240px,1.5fr)_minmax(130px,.7fr)_minmax(150px,.8fr)_minmax(290px,1.6fr)_48px] md:items-center md:gap-4">
                    <div className="flex min-w-0 items-center gap-2"><span className="hidden shrink-0 text-muted-foreground md:block">{expanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4" />}</span><div className="min-w-0"><p className="font-mono text-sm font-semibold tracking-tight text-foreground">{patent.patentNumber}</p><p className="truncate text-xs text-muted-foreground">{patent.title || 'Title unavailable'}</p></div><div className="ml-auto md:hidden">{(!canManageMonitoring || patent.archivedAt) && <StatusPill active={patent.monitoringActive} archived={Boolean(patent.archivedAt)} />}</div></div>
                    <div onClick={(event) => event.stopPropagation()}><PatentMonitoringButton patent={patent} canManageMonitoring={canManageMonitoring} /></div>
                    <div><RecommendationPill value={emptyRecommendation} /></div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 md:gap-x-2"><MetricToken label="Claims" value={emptyMetric} /><MetricToken label="Detect" value={emptyMetric} /><MetricToken label="Hits" value={emptyMetric} /><MetricToken label="Cites" value={emptyMetric} /></div>
                    <div className="ml-auto"><PatentRowActions patent={patent} canManageMonitoring={canManageMonitoring} canArchive={canArchive} onOpen={() => setLocation(`/portal/patents/${patent.publicId}`)} /></div>
                  </div>
                  {expanded && <div className="border-t border-primary/10 bg-primary/[0.025] px-4 pb-5 pt-4 sm:px-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Expanded portfolio view</p><p className="mt-1 text-xs text-muted-foreground">Factual source data is separated from analytical conclusions.</p></div><div className="flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Recommendation not analyzed</span><span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> AI metrics not analyzed</span></div></div>
                    <div className="grid gap-3 lg:grid-cols-3">
                      <section className="rounded-xl border border-primary/15 bg-card p-4 lg:col-span-2"><div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></span><div><h3 className="text-sm font-semibold">AI overview</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">No AI analysis has been performed yet.</p><p className="mt-3 text-[11px] leading-5 text-muted-foreground">A future overview will reference an immutable analysis run, recommendation, and supporting provenance. No conclusion is inferred from this record.</p></div></div></section>
                      <section className="rounded-xl border border-border bg-card p-4"><h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Recommendation</h3><div className="mt-3"><RecommendationPill value={emptyRecommendation} /></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Rationale, analysis date, provider provenance, and attorney disposition will appear here only when recorded.</p></section>
                      <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">AI metrics</h3></div><div className="mt-4 grid gap-3 sm:grid-cols-4"><div className="rounded-lg bg-muted/35 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Claim scope</p><p className="mt-2 text-sm font-semibold text-muted-foreground">Not analyzed</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">No scope rationale recorded.</p></div><div className="rounded-lg bg-muted/35 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Detectability</p><p className="mt-2 text-sm font-semibold text-muted-foreground">Not analyzed</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">No limitation detectability result.</p></div><div className="rounded-lg bg-muted/35 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Infringement hits</p><p className="mt-2 text-sm font-semibold text-muted-foreground">Not analyzed</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">No monitoring result recorded.</p></div><div className="rounded-lg bg-muted/35 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Forward citations</p><p className="mt-2 text-sm font-semibold text-muted-foreground">—</p><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Citation retrieval is not connected.</p></div></div></section>
                      <section className="rounded-xl border border-border bg-card p-4"><h3 className="text-sm font-semibold">Patent details</h3><dl className="mt-3 grid gap-3 text-xs"><div><dt className="text-muted-foreground">Assignee</dt><dd className="mt-0.5 font-medium">{patent.assignee || 'Not provided'}</dd></div><div><dt className="text-muted-foreground">Filing / issue</dt><dd className="mt-0.5 font-medium">{dateLabel(patent.filingDate)} / {dateLabel(patent.issueDate)}</dd></div><div><dt className="text-muted-foreground">Earliest priority</dt><dd className="mt-0.5 font-medium">{dateLabel(patent.earliestPriorityDate)}</dd></div><div><dt className="text-muted-foreground">Normalized status</dt><dd className="mt-0.5 font-medium">{patent.patentStatus || 'Not recorded'}</dd></div><div><dt className="text-muted-foreground">Estimated legal expiration</dt><dd className="mt-0.5 font-medium">—</dd></div><div><dt className="text-muted-foreground">Maintenance deadline / amount</dt><dd className="mt-0.5 font-medium">—</dd></div></dl></section>
                      <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Monitored claims</h3><p className="mt-1 text-xs text-muted-foreground">Only selected independent claims are shown in the compact view.</p></div><button type="button" onClick={(event) => { event.stopPropagation(); setClaimSelectionId(claimSelectionId === patent.publicId ? null : patent.publicId); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted/50">{claimSelectionId === patent.publicId ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} View full claim set</button></div><div className="mt-3 space-y-2">{selectedClaimsForMonitoring.map((claim) => <article key={claim.publicId} className="rounded-lg bg-muted/35 p-3"><p className="text-xs font-semibold">Claim {claim.claimNumber} <span className="font-normal text-muted-foreground">· Selected for monitoring</span></p><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{claim.claimText}</p><Link href={`/portal/patents/${patent.publicId}/claims/${claim.publicId}/analysis`} onClick={(event) => event.stopPropagation()} className="mt-2 inline-flex text-[11px] font-semibold text-primary hover:underline">Open limitation analysis</Link></article>)}{!selectedClaimsForMonitoring.length && <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No independent claims are selected for monitoring.</p>}</div>{claimSelectionId === patent.publicId && <ClaimSelectionPanel key={patent.publicId} patent={patent} canEdit={canManageMonitoring} onClose={() => setClaimSelectionId(null)} />}</section>
                      <section className="rounded-xl border border-border bg-card p-4"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold">Top potential targets</h3></div><p className="mt-3 text-xs leading-5 text-muted-foreground">No infringement monitoring results yet.</p><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Candidate companies, products, evidence, and attorney review will appear only after actual monitoring results are recorded.</p></section>
                      <section className="rounded-xl border border-border bg-card p-4 lg:col-span-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Recorded findings</h3><p className="mt-1 text-xs text-muted-foreground">Existing patent-linked analysis entries, shown as recorded triage rather than legal conclusions.</p></div><span className="text-xs font-semibold text-muted-foreground">{findings.length ? `${findings.length} entr${findings.length === 1 ? 'y' : 'ies'}` : 'Not analyzed'}</span></div>{findings.length > 0 ? <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">HIGH {findingCounts.HIGH}</span><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">MEDIUM {findingCounts.MEDIUM}</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">LOW {findingCounts.LOW}</span></div> : <p className="mt-3 text-xs text-muted-foreground">No patent-linked analysis runs have been recorded.</p>}</section>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">{patent.sourceUrl && <a href={patent.sourceUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted/50">Open USPTO source <ExternalLink className="h-3.5 w-3.5" /></a>}<button type="button" onClick={(event) => { event.stopPropagation(); setLocation(`/portal/patents/${patent.publicId}`); }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Open full detail <ExternalLink className="h-3.5 w-3.5" /></button><span className="ml-auto text-[11px] text-muted-foreground">Last analyzed {dateLabel(patent.lastAnalyzedAt || findings[0]?.createdAt)}</span></div>
                  </div>}
                </div>
              );
            })}
            {!patents.length && <div className="px-6 py-16 text-center"><Filter className="mx-auto h-7 w-7 text-muted-foreground/60" /><p className="mt-3 text-sm font-semibold">No records match this view</p><p className="mt-1 text-sm text-muted-foreground">{filtersActive ? 'Clear or adjust the active filters.' : 'Add a patent to begin monitoring this project.'}</p></div>}
          </div>
        </section>

        {addOpen && <section className="mt-6 overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border bg-primary/[0.035] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-lg font-semibold">Add a patent</h2><p className="mt-1 text-sm text-muted-foreground">Retrieve bibliographic data and claims for review before committing the record.</p></div><button type="button" onClick={() => setAddOpen(false)} className="self-start rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground sm:self-auto">Close</button></div>
          <form onSubmit={submitPatent} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end"><label className="flex-1 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">U.S. patent numbers<textarea required value={patentNumbers} onChange={(event) => setPatentNumbers(event.target.value)} placeholder={'US 12,345,678 B2\n12345679'} className="mt-2 min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal outline-none ring-primary/20 transition focus:ring-4" /></label><button disabled={previewPatent.isPending} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${previewPatent.isPending ? 'animate-spin' : ''}`} /> Retrieve for review</button></form>
          {previewPatent.error && <p className="px-5 pb-4 text-sm text-red-700">{previewPatent.error instanceof Error ? previewPatent.error.message : 'Patent retrieval failed.'}</p>}
          {drafts.length > 0 && <div className="border-t border-border">
            <div className="px-5 py-4"><h3 className="font-semibold">Review retrieved records</h3><p className="mt-1 text-sm text-muted-foreground">Select the independent claims that should be included in monitoring.</p></div>
            {drafts.map((draft) => {
              const selected = selectedClaims[draft.publicId] ?? [];
              const independent = draft.patent.claims.filter((claim) => claim.claimType === 'INDEPENDENT');
              const dependent = draft.patent.claims.filter((claim) => claim.claimType !== 'INDEPENDENT');
              return <article key={draft.publicId} className="space-y-4 border-t border-border px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-sm font-semibold">{draft.normalizedPatentNumber}</p><p className="mt-1 text-sm text-muted-foreground">{draft.patent.title || 'Title unavailable'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${draft.status === 'READY' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{draft.status === 'READY' ? 'Ready for review' : 'Incomplete retrieval'}</span></div>
                {draft.status === 'READY' ? <><div className="grid gap-3 text-sm sm:grid-cols-3"><div><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Assignee</span><p className="mt-1">{draft.patent.assignee || 'Not provided'}</p></div><div><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Issue date</span><p className="mt-1">{draft.patent.issueDate || 'Not provided'}</p></div><div><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Status</span><p className="mt-1">{draft.patent.patentStatus}</p></div></div><div><h4 className="mb-2 text-sm font-semibold">Independent claims</h4><div className="space-y-2">{independent.map((claim) => <label key={claim.claimNumber} className="flex cursor-pointer gap-3 rounded-xl border border-border p-3 transition hover:border-primary/30 hover:bg-primary/[0.025]"><input type="checkbox" checked={selected.includes(claim.claimNumber)} onChange={(event) => setSelectedClaims((current) => ({ ...current, [draft.publicId]: event.target.checked ? [...selected, claim.claimNumber] : selected.filter((number) => number !== claim.claimNumber) }))} className="mt-1 accent-[hsl(var(--primary))]" /><span><span className="text-sm font-semibold">Claim {claim.claimNumber}</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">{claim.claimText}</span></span></label>)}</div></div>{dependent.length > 0 && <details><summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><ChevronDown className="h-4 w-4" /> Dependent claims ({dependent.length})</summary><div className="mt-2 space-y-2 pl-6">{dependent.map((claim) => <div key={claim.claimNumber} className="rounded-lg bg-muted/40 p-3 text-sm"><span className="font-medium">Claim {claim.claimNumber}</span>{claim.dependsOnClaimNumber && <span className="ml-2 text-xs text-muted-foreground">depends on claim {claim.dependsOnClaimNumber}</span>}<p className="mt-1 leading-6 text-muted-foreground">{claim.claimText}</p></div>)}</div></details>}<button type="button" disabled={commitPatent.isPending} onClick={() => commitDraft(draft)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Check className="h-4 w-4" /> Add to project</button>{commitPatent.error && <p className="text-sm text-red-700">{commitPatent.error instanceof Error ? commitPatent.error.message : 'The patent could not be added.'}</p>}</> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex gap-2 text-sm text-amber-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-medium">The source response was incomplete.</p><ul className="mt-1 list-disc pl-5">{draft.errors.map((message) => <li key={message}>{message}</li>)}</ul><p className="mt-2">No incomplete data was added automatically.</p></div></div>{canCreateWorkProduct && (manualDraft?.publicId === draft.publicId ? <form onSubmit={submitManual} className="mt-4 space-y-2 border-t border-amber-200 pt-4"><input required value={manual.title} onChange={(event) => setManual({ ...manual, title: event.target.value })} placeholder="Corrected patent title" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /><div className="grid gap-2 sm:grid-cols-3"><input value={manual.claimNumber} onChange={(event) => setManual({ ...manual, claimNumber: event.target.value })} placeholder="Claim number" className="rounded-lg border border-input bg-background px-3 py-2 text-sm" /><input value={manual.claimText} onChange={(event) => setManual({ ...manual, claimText: event.target.value })} placeholder="Optional corrected claim text" className="rounded-lg border border-input bg-background px-3 py-2 text-sm sm:col-span-2" /></div><div className="flex gap-2"><button disabled={createPatent.isPending} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save manual correction</button><button type="button" onClick={() => setManualDraft(null)} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Cancel</button></div>{createPatent.error && <p className="text-sm text-red-700">{createPatent.error instanceof Error ? createPatent.error.message : 'Manual correction failed.'}</p>}</form> : <button type="button" onClick={() => setManualDraft(draft)} className="mt-3 rounded-lg border border-amber-300 bg-card px-3 py-2 text-sm font-semibold text-amber-900">Enter manual correction</button>)}</div>}
              </article>;
            })}
          </div>}
        </section>}

        <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <button type="button" onClick={() => setRecordsOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/30"><span className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><FileSearch className="h-4 w-4" /></span><span><span className="block font-display font-semibold">Workspace records and review history</span><span className="mt-0.5 block text-xs text-muted-foreground">{data.workspaceItems.length} records · {data.analysisRuns.length} analysis entries</span></span></span>{recordsOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</button>
          {recordsOpen && <div className="grid gap-6 border-t border-border p-5 lg:grid-cols-2">
            <div><h3 className="font-semibold">Classified records</h3><div className="mt-3 divide-y divide-border rounded-xl border border-border">{data.workspaceItems.map((record) => <article key={record.publicId} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">{record.title}</h4><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">{classificationLabels[record.classification]}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{record.content}</p></article>)}{!data.workspaceItems.length && <p className="p-6 text-center text-sm text-muted-foreground">No records have been added.</p>}</div><form onSubmit={submitItem} className="mt-3 space-y-3 rounded-xl bg-muted/35 p-4"><div className="grid gap-2 sm:grid-cols-2"><input required value={item.title} onChange={(event) => setItem({ ...item, title: event.target.value })} placeholder="Record title" className="rounded-lg border border-input bg-background px-3 py-2 text-sm" /><select value={item.classification} onChange={(event) => setItem({ ...item, classification: event.target.value as DataClassification })} className="rounded-lg border border-input bg-background px-3 py-2 text-sm"><option value="PUBLIC_SOURCE">Public source</option><option value="CLIENT_CONFIDENTIAL">Client confidential</option>{canCreateWorkProduct && <option value="ATTORNEY_WORK_PRODUCT">Attorney work product</option>}</select></div><textarea required value={item.content} onChange={(event) => setItem({ ...item, content: event.target.value })} placeholder="Record content or source notes" className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /><button disabled={createItem.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Add classified record</button></form></div>
            <div><h3 className="font-semibold">Analysis history</h3><div className="mt-3 divide-y divide-border rounded-xl border border-border">{data.analysisRuns.map((run) => <article key={run.publicId} className="p-4"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">{run.reviewStatus}</span><span className="text-xs text-muted-foreground">{dateLabel(run.createdAt)}</span></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{run.summary}</p><p className="mt-2 text-[11px] text-muted-foreground">{run.provider} · {run.triage}</p></article>)}{!data.analysisRuns.length && <p className="p-6 text-center text-sm text-muted-foreground">No analysis entries have been recorded.</p>}</div>{data.aiConfig.selectedProvider === 'MANUAL' && <form onSubmit={submitAnalysis} className="mt-3 space-y-3 rounded-xl bg-muted/35 p-4"><select value={analysis.triage} onChange={(event) => setAnalysis({ ...analysis, triage: event.target.value as AnalysisTriage })} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select><textarea required value={analysis.summary} onChange={(event) => setAnalysis({ ...analysis, summary: event.target.value })} placeholder="Manual analysis summary" className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /><button disabled={createRun.isPending} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Record analysis</button></form>}</div>
          </div>}
        </section>

        <footer className="mt-8 flex flex-col gap-2 border-t border-border pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span className="inline-flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" /> Data added intentionally to this project stays within its access boundary.</span><span>Processing: {providerLabels[data.aiConfig.selectedProvider]}</span></footer>
      </div>
    </div>
  );
}