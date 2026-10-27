import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import {
  ArrowLeft,
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileSearch,
  Filter,
  History,
  Info,
  LockKeyhole,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Search,
  Save,
  SlidersHorizontal,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { SEO } from '@/components/SEO';
import { espacenetUrl, googlePatentsUrl } from '@/lib/patent-links';
import {
  useCommitPatentImport,
  useBulkDeletePatents,
  useBulkUpdatePatents,
  useCreatePatent,
  usePortalAccess,
  usePreviewPatentImport,
  useSearchPatentsByAssignee,
  useProjectWorkspace,
  useRefreshPatent,
  useUpdateClaimMonitoringSelection,
  useUpdatePatentAttorneyNotes,
  useUpdatePatentMonitoring,
} from '@/lib/hooks-portal';
import type { AssigneePatentMatch, AttorneyNote, MonitoredPatent, PatentImportDraft, PatentRecommendation, ProjectWorkspace as ProjectWorkspaceData } from '@/lib/api-portal';
import { getEligibleAssigneePatentNumbers, getSelectedEligibleAssigneePatentNumbers, isAssigneePatentAlreadyAdded } from '@/lib/assignee-search';

const providerLabels = {
  CLIENT_MICROSOFT: 'Client Microsoft environment',
  ZK_MANAGED_AI: 'Zilka-Kotab managed environment',
  MANUAL: 'Manual review',
};

type PatentFilter = 'ALL' | 'ACTIVE' | 'PAUSED';
type MetricLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT_ANALYZED';
type Recommendation = PatentRecommendation;
type SortKey = 'patent' | 'recommendation' | 'citations';
type SortDirection = 'asc' | 'desc';
type MetricFilter = 'ALL' | MetricLevel;
type MetricKey = 'claimScope' | 'detectability' | 'validity' | 'infringement' | 'citations';
type MaintenanceEntitySize = 'MICRO' | 'SMALL' | 'LARGE';
type MaintenanceScenario = 'MAINTAIN' | 'MAINTAIN_REVIEW' | 'ALL';

const maintenanceFeeRates: Record<MaintenanceEntitySize, [number, number, number]> = {
  MICRO: [430, 808, 1656],
  SMALL: [860, 1616, 3312],
  LARGE: [2150, 4040, 8280],
};
const maintenanceMilestones = [
  { label: '3.5-year fee', dueMonths: 42, graceMonths: 48 },
  { label: '7.5-year fee', dueMonths: 90, graceMonths: 96 },
  { label: '11.5-year fee', dueMonths: 138, graceMonths: 144 },
] as const;

const metricDetails: Record<MetricKey, { title: string; purpose: string }> = {
  claimScope: { title: 'Claim scope', purpose: 'How clearly the selected claims can be evaluated against observable products, services, or technical documentation.' },
  detectability: { title: 'Detectability', purpose: 'How likely potential use of the claimed features is to be found in public product or technical evidence.' },
  validity: { title: 'Validity', purpose: 'Potential prior-art or prosecution-history issues that may affect patent strength. This is a research indicator, not a legal conclusion.' },
  infringement: { title: 'Infringement', purpose: 'Evidence that a product or service may practice one or more claim limitations. A potential match is a research lead, not a legal conclusion.' },
  citations: { title: 'Forward Citations', purpose: 'Later patents that cite this patent. Forward citations provide context and do not establish validity or infringement.' },
};

const emptyMetric: MetricLevel = 'NOT_ANALYZED';
const patentImportBatchSize = 20;

const recommendationLabel = (value: Recommendation) => value === 'NOT_ANALYZED' ? 'Not analyzed' : value;
const recommendationTone = (value: Recommendation) => value === 'NOT_ANALYZED'
  ? 'border-slate-200 bg-slate-50 text-slate-500'
  : value === 'MAINTAIN'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : value === 'REVIEW'
      ? 'border-[#dcc69c] bg-[#f6f0e4] text-[#80643c]'
      : 'border-red-200 bg-red-50 text-red-700';
const recommendationPanelTone = (value: Recommendation) => value === 'NOT_ANALYZED'
  ? 'border-border bg-card'
  : value === 'MAINTAIN'
    ? 'border-emerald-200 bg-emerald-50/60'
    : value === 'REVIEW'
      ? 'border-[#dcc69c] bg-[#f6f0e4]'
      : 'border-red-200 bg-red-50/70';
const metricValueTone = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (['high', 'broad', 'good', 'strong', 'maintain'].includes(normalized)) return 'text-emerald-700';
  if (['medium', 'moderate', 'review'].includes(normalized)) return 'text-[#80643c]';
  if (['low', 'narrow', 'poor', 'weak'].includes(normalized)) return 'text-red-700';
  return 'text-slate-400';
};

function dateLabel(value?: string | null) {
  return value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded';
}

async function downloadPortfolioWorkbook(workspace: ProjectWorkspaceData, includeAttorneyNotes: boolean) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Zilka-Kotab Patent Monitor';
  workbook.created = new Date();

  const patents = workspace.patents;
  const activePatents = patents.filter((patent) => !patent.archivedAt);
  const countByRecommendation = (recommendation: Recommendation) =>
    activePatents.filter((patent) => patent.recommendation === recommendation).length;
  const analysisByPatent = new Map<string, ProjectWorkspaceData['analysisRuns']>();
  for (const run of workspace.analysisRuns) {
    if (!run.patentId) continue;
    analysisByPatent.set(run.patentId, [...(analysisByPatent.get(run.patentId) ?? []), run]);
  }
  for (const runs of analysisByPatent.values()) {
    runs.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }

  const analytics = workbook.addWorksheet('Portfolio Analytics');
  analytics.addRows([
    [`${workspace.project.name} — Portfolio Analytics`, ''],
    ['Client', workspace.client.name],
    ['Tool', workspace.tool.name],
    ['Generated', new Date().toLocaleString()],
    ['Records included', patents.length],
    ['Non-archived portfolio records', activePatents.length],
    ['Monitoring enabled', activePatents.filter((patent) => patent.monitoringActive).length],
    ['Monitoring paused', activePatents.filter((patent) => !patent.monitoringActive).length],
    ['Archived records included', patents.filter((patent) => Boolean(patent.archivedAt)).length],
    ['Non-archived — Maintain', countByRecommendation('MAINTAIN')],
    ['Non-archived — Review', countByRecommendation('REVIEW')],
    ['Non-archived — Prune', countByRecommendation('PRUNE')],
    ['Non-archived — Not analyzed', countByRecommendation('NOT_ANALYZED')],
    ['Total claims', patents.reduce((total, patent) => total + patent.claims.length, 0)],
    ['Claims selected for monitoring', patents.reduce((total, patent) => total + patent.claims.filter((claim) => claim.selectedForMonitoring).length, 0)],
    ['Recorded analysis runs', workspace.analysisRuns.filter((run) => run.patentId && patents.some((patent) => patent.publicId === run.patentId)).length],
  ]);
  analytics.mergeCells('A1:B1');
  analytics.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF173A63' } };
  analytics.getRow(1).height = 26;
  analytics.getColumn(1).width = 38;
  analytics.getColumn(2).width = 34;
  for (let row = 2; row <= analytics.rowCount; row += 1) {
    analytics.getCell(row, 1).font = { bold: true, color: { argb: 'FF536273' } };
    analytics.getCell(row, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  }
  analytics.views = [{ state: 'frozen', ySplit: 1 }];

  const detailHeaders = [
    'Patent Record ID', 'Project ID', 'Patent Number', 'Title', 'Application Number',
    'Filing Date', 'Issue Date', 'Earliest Priority Date', 'Current Assignee', 'Inventors',
    'Abstract', 'Patent Status', 'Source Status', 'Jurisdiction', 'Source URL', 'Source',
    'Source Identifier', 'Retrieval Method', 'Retrieved At', 'Verification Status',
    'Monitoring Active', 'Recommendation', 'Archived At', 'Last Analyzed At', 'Created At',
    'Claim Count', 'Claims Selected for Monitoring', 'Selected Claim Numbers',
    'Latest Analysis Summary', 'Latest Analysis Provider', 'Latest Analysis Date',
  ];
  if (includeAttorneyNotes) detailHeaders.push('Attorney Notes', 'Notes Created By', 'Notes Updated By', 'Attorney Notes Updated At', 'Attorney Notes History');
  const detailSheet = workbook.addWorksheet('Patent Details');
  detailSheet.addRow(detailHeaders);
  for (const patent of patents) {
    const latestAnalysis = analysisByPatent.get(patent.publicId)?.[0];
    const row: (string | number | boolean | Date | null)[] = [
      patent.publicId, patent.projectId, patent.patentNumber, patent.title, patent.applicationNumber ?? '',
      patent.filingDate ?? '', patent.issueDate ?? '', patent.earliestPriorityDate ?? '', patent.assignee ?? '',
      patent.inventors.join('; '), patent.abstract ?? '', patent.patentStatus, patent.sourceStatus ?? '',
      patent.jurisdiction, patent.sourceUrl ?? '', patent.source, patent.sourceIdentifier ?? '',
      patent.retrievalMethod, patent.retrievedAt ?? '', patent.verificationStatus, patent.monitoringActive,
      patent.recommendation, patent.archivedAt ?? '', patent.lastAnalyzedAt ?? '', patent.createdAt,
      patent.claims.length, patent.claims.filter((claim) => claim.selectedForMonitoring).length,
      patent.claims.filter((claim) => claim.selectedForMonitoring).map((claim) => claim.claimNumber).join(', '),
      latestAnalysis?.summary ?? '', latestAnalysis?.provider ?? '', latestAnalysis?.createdAt ?? '',
    ];
    if (includeAttorneyNotes) row.push(
      patent.attorneyNotes?.notes ?? '',
      patent.attorneyNotes?.createdBy?.name ?? '',
      patent.attorneyNotes?.updatedBy?.name ?? '',
      patent.attorneyNotes?.updatedAt ?? '',
      patent.attorneyNotes?.history.map((entry) => `${entry.createdAt} — ${entry.actor?.name ?? 'Unknown user'}: ${entry.notes}`).join('\n') ?? '',
    );
    detailSheet.addRow(row);
  }

  const claimsSheet = workbook.addWorksheet('Claims');
  claimsSheet.addRow(['Patent Number', 'Patent Title', 'Claim Number', 'Claim Type', 'Selected for Monitoring', 'Depends On Claim', 'Claim Text', 'Version', 'Source', 'Source Identifier', 'Retrieved At', 'Verification Status']);
  for (const patent of patents) {
    for (const claim of patent.claims) {
      claimsSheet.addRow([
        patent.patentNumber, patent.title, claim.claimNumber, claim.claimType, claim.selectedForMonitoring,
        claim.dependsOnClaimNumber ?? '', claim.claimText, claim.version, claim.source,
        claim.sourceIdentifier ?? '', claim.retrievedAt ?? '', claim.verificationStatus,
      ]);
    }
  }

  const analysisSheet = workbook.addWorksheet('Analysis Records');
  analysisSheet.addRow(['Patent Number', 'Claim Number', 'Analysis ID', 'Provider', 'Triage', 'Review Status', 'Analysis Summary', 'Created At', 'Reviews']);
  for (const run of workspace.analysisRuns) {
    const patent = patents.find((item) => item.publicId === run.patentId);
    if (!patent) continue;
    const claim = patent.claims.find((item) => item.publicId === run.claimId);
    analysisSheet.addRow([
      patent.patentNumber, claim?.claimNumber ?? '', run.publicId, run.provider, run.triage,
      run.reviewStatus, run.summary, run.createdAt,
      run.reviews.map((review) => `${review.createdAt} — ${review.status}: ${review.note}`).join('\n'),
    ]);
  }

  for (const sheet of [detailSheet, claimsSheet, analysisSheet]) {
    const lastColumn = sheet.columnCount;
    const lastRow = Math.max(sheet.rowCount, 1);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: lastRow, column: lastColumn } };
    sheet.getRow(1).height = 32;
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF244B78' } };
    sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true };
    for (let column = 1; column <= lastColumn; column += 1) {
      sheet.getColumn(column).width = Math.min(42, Math.max(16, String(sheet.getCell(1, column).value ?? '').length + 3));
    }
    for (let row = 2; row <= lastRow; row += 1) {
      sheet.getRow(row).alignment = { vertical: 'top', wrapText: true };
    }
  }
  detailSheet.getColumn(4).width = 36;
  detailSheet.getColumn(11).width = 48;
  detailSheet.getColumn(15).width = 42;
  detailSheet.getColumn(29).width = 56;
  claimsSheet.getColumn(2).width = 36;
  claimsSheet.getColumn(7).width = 72;
  analysisSheet.getColumn(7).width = 56;
  analysisSheet.getColumn(9).width = 56;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${workspace.project.name.replace(/[^a-z0-9-_]+/gi, '_')}_patent_portfolio.xlsx`;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function addMonthsToDate(value: string, months: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const source = new Date(Date.UTC(year, month, day));
  if (source.getUTCFullYear() !== year || source.getUTCMonth() !== month || source.getUTCDate() !== day) return null;
  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const finalDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, finalDay))).toISOString().slice(0, 10);
}

function maintenanceFeeWindows(issueDate?: string | null) {
  if (!issueDate) return [];
  const todayParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const todayValues = Object.fromEntries(todayParts.map((part) => [part.type, part.value]));
  const today = `${todayValues.year}-${todayValues.month}-${todayValues.day}`;
  return [
    { label: '3.5-year fee', graceMonths: 48 },
    { label: '7.5-year fee', graceMonths: 96 },
    { label: '11.5-year fee', graceMonths: 144 },
  ].map((window) => {
    const graceEnds = addMonthsToDate(issueDate, window.graceMonths);
    if (!graceEnds) return null;
    return { label: window.label, remaining: today <= graceEnds };
  }).filter((window): window is NonNullable<typeof window> => window !== null);
}

function estimateMaintenanceCost(
  patents: MonitoredPatent[],
  entitySize: MaintenanceEntitySize,
  scenario: MaintenanceScenario,
) {
  const todayParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const todayValues = Object.fromEntries(todayParts.map((part) => [part.type, part.value]));
  const today = `${todayValues.year}-${todayValues.month}-${todayValues.day}`;
  const includedPatents = patents.filter((patent) => {
    if (scenario === 'MAINTAIN') return patent.recommendation === 'MAINTAIN';
    if (scenario === 'MAINTAIN_REVIEW') return patent.recommendation === 'MAINTAIN' || patent.recommendation === 'REVIEW';
    return true;
  });
  const byMilestone = maintenanceMilestones.map((milestone) => ({ ...milestone, count: 0, subtotal: 0 }));
  let missingIssueDateCount = 0;
  let noFutureWindowCount = 0;
  let patentsWithFutureFees = 0;

  for (const patent of includedPatents) {
    if (!patent.issueDate) {
      missingIssueDateCount += 1;
      continue;
    }
    let hasFutureFee = false;
    byMilestone.forEach((milestone, index) => {
      const graceEnd = addMonthsToDate(patent.issueDate!, milestone.graceMonths);
      if (graceEnd && graceEnd >= today) {
        const amount = maintenanceFeeRates[entitySize][index];
        milestone.count += 1;
        milestone.subtotal += amount;
        hasFutureFee = true;
      }
    });
    if (hasFutureFee) patentsWithFutureFees += 1;
    else noFutureWindowCount += 1;
  }

  return {
    total: byMilestone.reduce((sum, milestone) => sum + milestone.subtotal, 0),
    includedCount: includedPatents.length,
    patentsWithFutureFees,
    missingIssueDateCount,
    noFutureWindowCount,
    byMilestone,
  };
}

function extractPatentNumbers(value: string) {
  const normalizedText = value.toUpperCase().replace(/,/g, '');
  const pattern = /(?:US\s*)?(\d{6,9})(?:\s*[A-Z]\d)?/g;
  const seen = new Set<string>();
  const numbers: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalizedText)) !== null) {
    const normalizedNumber = `US${match[1]}`;
    if (!seen.has(normalizedNumber)) {
      seen.add(normalizedNumber);
      numbers.push(normalizedNumber);
    }
  }
  return numbers;
}

function StatusPill({ active }: { active: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-amber-500'}`} />{active ? 'Monitoring' : 'Paused'}</span>;
}

function PatentRowActions({
  patent,
  canManageMonitoring,
}: {
  patent: MonitoredPatent;
  canManageMonitoring: boolean;
}) {
  const refresh = useRefreshPatent(patent.publicId);
  const monitoring = useUpdatePatentMonitoring(patent.publicId);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <button type="button" aria-label={`Actions for ${patent.patentNumber}`} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>
      {open && <div className="absolute right-0 top-10 z-20 min-w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl">
        {canManageMonitoring && <button type="button" disabled={monitoring.isPending} onClick={() => { setOpen(false); monitoring.mutate(!patent.monitoringActive); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-muted disabled:opacity-50">{patent.monitoringActive ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}{patent.monitoringActive ? 'Pause monitoring' : 'Resume monitoring'}</button>}
        <button type="button" disabled={refresh.isPending} onClick={() => { setOpen(false); refresh.mutate(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-muted disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} /> Refresh from USPTO</button>
        {(refresh.error || monitoring.error) && <p className="px-3 py-2 text-[11px] text-red-700">{(refresh.error || monitoring.error) instanceof Error ? (refresh.error || monitoring.error)?.message : 'The requested row action could not be completed.'}</p>}
      </div>}
    </div>
  );
}

function MetricBreakdownItem({ label, fullLabel, value }: { label: string; fullLabel: string; value: string }) {
  return <span title={`${fullLabel}: ${value === '—' ? 'Not analyzed' : value}`} className="whitespace-nowrap text-[10px]"><span className="text-muted-foreground">{label}:</span> <span className={`font-bold ${metricValueTone(value)}`}>{value}</span></span>;
}

function RecommendationPill({ value }: { value: Recommendation }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${recommendationTone(value)}`}>{recommendationLabel(value)}</span>;
}

function MetricDetailsDialog({
  metric,
  latestSummary,
  analyzedAt,
  onClose,
}: {
  metric: { title: string; purpose: string };
  latestSummary?: string;
  analyzedAt?: string;
  onClose: () => void;
}) {
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="metric-details-title" className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">AI metric details</p><h2 id="metric-details-title" className="mt-1 font-display text-lg font-semibold">{metric.title}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close metric details" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-4 space-y-4 text-sm">
        <div><p className="text-xs font-semibold text-foreground">What this metric represents</p><p className="mt-1 leading-5 text-muted-foreground">{metric.purpose}</p></div>
        <div className="rounded-xl bg-muted/40 p-3">
          <p className="text-xs font-semibold text-foreground">Rationale</p>
          {latestSummary?.trim()
            ? <><p className="mt-1 text-[10px] text-muted-foreground">Latest overall analysis context{analyzedAt ? ` · ${dateLabel(analyzedAt)}` : ''}. This is not a metric-specific explanation.</p><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-foreground">{latestSummary}</p></>
            : <p className="mt-1 text-xs leading-5 text-muted-foreground">No analysis rationale is recorded for this patent yet. The metric value and its supporting rationale will appear here after an analysis is completed.</p>}
        </div>
      </div>
    </section>
  </div>;
}

function CompactSortButton({ label, active, direction, onClick }: { label: string; active: boolean; direction: SortDirection; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 text-left text-[10px] font-bold uppercase tracking-[0.14em] transition ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>{label}{active ? direction === 'asc' ? <ArrowUpAZ className="h-3 w-3" /> : <ArrowDownAZ className="h-3 w-3" /> : <ArrowDownAZ className="h-3 w-3 opacity-40" />}</button>;
}

function compactClaimText(value: string) {
  return value.replace(/\n[ \t]*\n+/g, '\n').trim();
}

function ClaimViewerModal({ patent, canEdit, onClose }: { patent: MonitoredPatent; canEdit: boolean; onClose: () => void }) {
  const selection = useUpdateClaimMonitoringSelection(patent.publicId);
  const [selected, setSelected] = useState(() => patent.claims.filter((claim) => claim.selectedForMonitoring).map((claim) => claim.claimNumber));
  const toggleClaim = (claimNumber: string, checked: boolean) => setSelected((current) => checked ? [...new Set([...current, claimNumber])] : current.filter((number) => number !== claimNumber));
  const selectAll = () => setSelected(patent.claims.map((claim) => claim.claimNumber));

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-2 sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="claim-viewer-title" className="flex h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">USPTO grant claims</p><h2 id="claim-viewer-title" className="mt-1 truncate font-display text-lg font-semibold">Claims — {patent.patentNumber}</h2><p className="mt-1 text-xs text-muted-foreground">{patent.claims.length} claims · {selected.length} selected for monitoring</p></div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close full claim set"><X className="h-4 w-4" /></button>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-3 text-slate-900 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 py-3 backdrop-blur">
            <p className="text-xs text-slate-600">Select the claims to include in monitoring.</p>
            {canEdit && <div className="flex shrink-0 gap-3 text-xs font-medium"><button type="button" onClick={selectAll} className="text-blue-700 hover:underline">Select all</button><button type="button" onClick={() => setSelected([])} className="text-slate-600 hover:underline">Clear</button></div>}
          </div>
          {patent.claims.length ? <div className="divide-y divide-slate-200">
            {patent.claims.map((claim) => <article key={claim.publicId} className="grid grid-cols-[20px_minmax(0,1fr)] gap-3 py-5 sm:gap-4">
              <label className="mt-1 flex justify-center" title={`Select claim ${claim.claimNumber} for monitoring`}>
                <input type="checkbox" aria-label={`Monitor claim ${claim.claimNumber}`} disabled={!canEdit} checked={selected.includes(claim.claimNumber)} onChange={(event) => toggleClaim(claim.claimNumber, event.target.checked)} className="h-4 w-4 accent-blue-700 disabled:opacity-60" />
              </label>
              <div>
                <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">Claim {claim.claimNumber}</h3>
                  <span className="text-[11px] text-slate-500">{claim.claimType === 'INDEPENDENT' ? 'Independent' : claim.claimType === 'DEPENDENT' ? 'Dependent' : 'Claim'}</span>
                  {claim.dependsOnClaimNumber && <span className="text-[11px] text-slate-500">Depends on claim {claim.dependsOnClaimNumber}</span>}
                </div>
                <p className="whitespace-pre-wrap font-serif text-[15px] leading-7 text-slate-800">{compactClaimText(claim.claimText)}</p>
              </div>
            </article>)}
          </div> : <p className="py-12 text-center font-serif text-sm text-slate-500">No claims are stored for this patent.</p>}
        </div>
      </main>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Info className="h-3.5 w-3.5" /> Claim text from the USPTO grant document.</div>
        {canEdit && <button type="button" disabled={selection.isPending || (patent.claims.length > 0 && selected.length === 0)} onClick={() => selection.mutate(selected, { onSuccess: onClose })} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Check className="h-3.5 w-3.5" />{selection.isPending ? 'Saving…' : 'Save Monitoring Selection'}</button>}
        {selection.error && <p className="w-full text-xs text-red-700">{selection.error instanceof Error ? selection.error.message : 'The claim selection could not be saved.'}</p>}
      </footer>
    </div>
  </div>;
}

function ExpandedMonitoringControl({ patent, canEdit }: { patent: MonitoredPatent; canEdit: boolean }) {
  const monitoring = useUpdatePatentMonitoring(patent.publicId);
  return <div className="flex flex-col items-start gap-1">
    {canEdit
      ? <select aria-label="Monitoring status" value={patent.monitoringActive ? 'ACTIVE' : 'PAUSED'} disabled={monitoring.isPending} onChange={(event) => monitoring.mutate(event.target.value === 'ACTIVE')} className="h-8 min-w-40 rounded-full border border-input bg-background px-3 text-[10px] font-semibold text-foreground outline-none ring-primary/20 transition focus:ring-4 disabled:opacity-50"><option value="ACTIVE">Active Monitoring</option><option value="PAUSED">Paused / Not Monitoring</option></select>
      : <StatusPill active={patent.monitoringActive} />}
    {monitoring.error && <p role="alert" className="text-[11px] text-red-700">{monitoring.error instanceof Error ? monitoring.error.message : 'The monitoring state could not be changed.'}</p>}
  </div>;
}

function AttorneyNotesPanel({ patent, canEdit }: { patent: MonitoredPatent; canEdit: boolean }) {
  const note = patent.attorneyNotes;
  const update = useUpdatePatentAttorneyNotes(patent.publicId);
  const [notes, setNotes] = useState(note?.notes ?? '');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setNotes(note?.notes ?? '');
    setSaved(false);
  }, [note?.notes]);
  const save = () => update.mutate(notes, { onSuccess: () => setSaved(true) });
  return <section className="rounded-xl border border-primary/15 bg-card p-3">
    <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><History className="h-3.5 w-3.5 text-primary" /><h3 className="text-sm font-semibold">Attorney notes</h3></div>{note?.history.length ? <span className="text-[10px] text-muted-foreground">{note.history.length} edit{note.history.length === 1 ? '' : 's'}</span> : null}</div>
    <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Attorney work product. Not visible to client users.</p>
    <textarea value={notes} onChange={(event) => { setNotes(event.target.value); setSaved(false); }} disabled={!canEdit || update.isPending} maxLength={20000} placeholder="Add patent-specific attorney notes…" className="mt-2 min-h-24 w-full resize-y rounded-lg border border-input bg-background px-2.5 py-2 text-xs leading-5 outline-none ring-primary/20 focus:ring-4 disabled:opacity-70" />
    {canEdit && <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] text-muted-foreground">{saved ? 'Saved' : `${notes.length.toLocaleString()} / 20,000`}</span><button type="button" disabled={update.isPending} onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"><Save className="h-3 w-3" />{update.isPending ? 'Saving…' : 'Save Notes'}</button></div>}
    {note && <details className="mt-2 text-[10px] text-muted-foreground"><summary className="cursor-pointer font-semibold">Edit history and authors</summary><div className="mt-2 space-y-1.5">{note.history.slice(0, 5).map((entry) => <div key={entry.publicId} className="flex justify-between gap-3 border-t border-border pt-1.5"><span>{entry.actor?.name ?? 'Unknown user'}</span><span>{dateLabel(entry.createdAt)}</span></div>)}</div></details>}
    {update.error && <p className="mt-2 text-[11px] text-red-700">{update.error instanceof Error ? update.error.message : 'The notes could not be saved.'}</p>}
  </section>;
}

export default function ProjectWorkspace() {
  const projectId = useParams().projectId ?? '';
  const [, setLocation] = useLocation();
  const { data, isLoading, error } = useProjectWorkspace(projectId, true);
  const { data: access } = usePortalAccess();
  const bulkUpdatePatents = useBulkUpdatePatents(projectId);
  const bulkDeletePatents = useBulkDeletePatents(projectId);
  const createPatent = useCreatePatent(projectId);
  const previewPatent = usePreviewPatentImport(projectId);
  const assigneeSearch = useSearchPatentsByAssignee(projectId);
  const commitPatent = useCommitPatentImport(projectId);

  const [filter, setFilter] = useState<PatentFilter>('ALL');
  const [search, setSearch] = useState('');
  const [selectedPatentIds, setSelectedPatentIds] = useState<string[]>([]);
  const [bulkRecommendation, setBulkRecommendation] = useState<Recommendation | ''>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [monitorFilter, setMonitorFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  const [recommendationFilter, setRecommendationFilter] = useState<Recommendation | 'ALL'>('ALL');
  const [claimScopeFilter, setClaimScopeFilter] = useState<MetricFilter>('ALL');
  const [detectabilityFilter, setDetectabilityFilter] = useState<MetricFilter>('ALL');
  const [validityFilter, setValidityFilter] = useState<MetricFilter>('ALL');
  const [infringementFilter, setInfringementFilter] = useState<MetricFilter>('ALL');
  const [citationMin, setCitationMin] = useState('');
  const [citationMax, setCitationMax] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('patent');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [claimSelectionId, setClaimSelectionId] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [patentNumbers, setPatentNumbers] = useState('');
  const [assigneeSearchText, setAssigneeSearchText] = useState('');
  const [alternateAssigneeNames, setAlternateAssigneeNames] = useState('');
  const [includeAssignmentRecords, setIncludeAssignmentRecords] = useState(false);
  const [assigneeMatches, setAssigneeMatches] = useState<AssigneePatentMatch[]>([]);
  const [selectedAssigneeNumbers, setSelectedAssigneeNumbers] = useState<string[]>([]);
  const [assigneeSearchTruncated, setAssigneeSearchTruncated] = useState(false);
  const [assignmentSearchTruncated, setAssignmentSearchTruncated] = useState(false);
  const [drafts, setDrafts] = useState<PatentImportDraft[]>([]);
  const [selectedClaims, setSelectedClaims] = useState<Record<string, string[]>>({});
  const [manualDraft, setManualDraft] = useState<PatentImportDraft | null>(null);
  const [manual, setManual] = useState({ title: '', claimNumber: '1', claimText: '' });
  const [patentImportProgress, setPatentImportProgress] = useState<{ completed: number; total: number } | null>(null);
  const [patentInputError, setPatentInputError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [maintenanceEntitySize, setMaintenanceEntitySize] = useState<MaintenanceEntitySize>('LARGE');
  const [maintenanceScenario, setMaintenanceScenario] = useState<MaintenanceScenario>('MAINTAIN');
  const [loadedPatentFiles, setLoadedPatentFiles] = useState<string[]>([]);
  useEffect(() => {
    if (!addOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && patentImportProgress === null) setAddOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [addOpen, patentImportProgress]);

  const canCreateWorkProduct = access?.user?.role !== 'CLIENT';
  const canManageMonitoring = access?.user?.role === 'ADMIN' || access?.user?.role === 'ATTORNEY';
  const exportPortfolio = async () => {
    if (!data || exporting) return;
    setExporting(true);
    setExportError('');
    try {
      await downloadPortfolioWorkbook(data, canManageMonitoring);
    } catch (error) {
      console.error('Portfolio spreadsheet export failed:', error);
      setExportError('The spreadsheet could not be created. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const patents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const minimumCitations = citationMin === '' ? null : Number(citationMin);
    const maximumCitations = citationMax === '' ? null : Number(citationMax);
    const filtered = (data?.patents ?? []).filter((patent) => {
      const matchesFilter = filter === 'ALL'
        || (filter === 'ACTIVE' && patent.monitoringActive)
        || (filter === 'PAUSED' && !patent.monitoringActive);
      const matchesSearch = !query || patent.patentNumber.toLowerCase().includes(query) || patent.title.toLowerCase().includes(query);
      const matchesMonitoring = monitorFilter === 'ALL'
        || (monitorFilter === 'ACTIVE' && patent.monitoringActive)
        || (monitorFilter === 'PAUSED' && !patent.monitoringActive);
      const matchesRecommendation = recommendationFilter === 'ALL' || patent.recommendation === recommendationFilter;
      const matchesClaimScope = claimScopeFilter === 'ALL' || emptyMetric === claimScopeFilter;
      const matchesDetectability = detectabilityFilter === 'ALL' || emptyMetric === detectabilityFilter;
      const matchesValidity = validityFilter === 'ALL' || emptyMetric === validityFilter;
      const matchesInfringement = infringementFilter === 'ALL' || emptyMetric === infringementFilter;
      const citations = null;
      const matchesCitationRange = (minimumCitations === null || (citations !== null && citations >= minimumCitations))
        && (maximumCitations === null || (citations !== null && citations <= maximumCitations));
      return matchesFilter && matchesSearch && matchesMonitoring && matchesRecommendation && matchesClaimScope && matchesDetectability && matchesValidity && matchesInfringement && matchesCitationRange;
    });
    return [...filtered].sort((left, right) => {
      let comparison = 0;
      if (sortKey === 'patent') comparison = left.patentNumber.localeCompare(right.patentNumber, undefined, { numeric: true });
      if (sortKey === 'recommendation') comparison = recommendationLabel(left.recommendation).localeCompare(recommendationLabel(right.recommendation));
      if (sortKey === 'citations') comparison = 0;
      return sortDirection === 'asc' ? comparison : comparison * -1;
    });
  }, [claimScopeFilter, citationMax, citationMin, data?.patents, detectabilityFilter, filter, infringementFilter, monitorFilter, recommendationFilter, search, sortDirection, sortKey, validityFilter]);

  const selectablePatentIds = patents.map((patent) => patent.publicId);
  const selectedVisiblePatentIds = selectedPatentIds.filter((id) => selectablePatentIds.includes(id));
  const allVisibleSelected = selectablePatentIds.length > 0 && selectedVisiblePatentIds.length === selectablePatentIds.length;
  useEffect(() => {
    const visibleIds = new Set(selectablePatentIds);
    setSelectedPatentIds((current) => {
      const next = current.filter((id) => visibleIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [patents]);

  const filtersActive = Boolean(search.trim() || monitorFilter !== 'ALL' || recommendationFilter !== 'ALL' || claimScopeFilter !== 'ALL' || detectabilityFilter !== 'ALL' || validityFilter !== 'ALL' || infringementFilter !== 'ALL' || citationMin || citationMax);
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
    setValidityFilter('ALL');
    setInfringementFilter('ALL');
    setCitationMin('');
    setCitationMax('');
    setFilter('ALL');
    setSelectedPatentIds([]);
  };

  if (isLoading) {
    return <div className="mx-auto max-w-7xl p-6 lg:p-8"><div className="animate-pulse space-y-5"><div className="h-5 w-32 rounded bg-muted" /><div className="h-12 w-3/4 rounded bg-muted" /><div className="h-24 rounded-2xl bg-muted" /><div className="h-72 rounded-2xl bg-muted" /></div></div>;
  }
  if (error || !data) {
    return <div className="mx-auto max-w-3xl p-6 lg:p-8"><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800"><p className="font-semibold">The project workspace could not be loaded.</p><p className="mt-1 text-red-700">Refresh the page or return to the portal and try again.</p><Link href="/portal" className="mt-4 inline-flex rounded-lg bg-red-800 px-3 py-2 font-semibold text-white">Back to portal</Link></div></div>;
  }

  const counts = {
    all: data.patents.length,
    active: data.patents.filter((patent) => patent.monitoringActive).length,
    paused: data.patents.filter((patent) => !patent.monitoringActive).length,
  };
  const recommendationCounts = data.patents.reduce((totals, patent) => {
    totals[patent.recommendation] += 1;
    return totals;
  }, { NOT_ANALYZED: 0, MAINTAIN: 0, REVIEW: 0, PRUNE: 0 });
  const maintenanceEstimate = estimateMaintenanceCost(data.patents, maintenanceEntitySize, maintenanceScenario);
  const feeCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  const applyBulkUpdate = (updates: { monitoringActive?: boolean; recommendation?: Recommendation }) => {
    if (!selectedVisiblePatentIds.length) return;
    bulkUpdatePatents.mutate(
      { patentIds: selectedVisiblePatentIds, ...updates },
      { onSuccess: () => { setSelectedPatentIds([]); setBulkRecommendation(''); } },
    );
  };
  const deleteSelectedPatents = () => {
    const patentCount = selectedVisiblePatentIds.length;
    if (!patentCount || bulkDeletePatents.isPending) return;
    const confirmed = window.confirm(
      `Permanently delete ${patentCount} patent record${patentCount === 1 ? '' : 's'}? This also deletes their claims, attorney notes, and claim-limitation records. Historical analysis runs are retained but detached from the deleted patents. This cannot be undone.`,
    );
    if (!confirmed) return;
    bulkDeletePatents.mutate(selectedVisiblePatentIds, {
      onSuccess: () => {
        setSelectedPatentIds([]);
        setExpandedId(null);
        setClaimSelectionId(null);
      },
    });
  };

  const handlePatentFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    setPatentInputError('');
    const unsupportedFiles = files.filter((file) => !/\.(csv|txt)$/i.test(file.name));
    if (unsupportedFiles.length) {
      setPatentInputError('Choose CSV or TXT files containing U.S. patent numbers.');
      input.value = '';
      return;
    }
    try {
      const contents = (await Promise.all(files.map((file) => file.text()))).filter((content) => content.trim());
      if (!contents.length) {
        setPatentInputError('The selected file does not contain any text.');
        setLoadedPatentFiles([]);
        return;
      }
      setPatentNumbers((current) => [current.trim(), ...contents].filter(Boolean).join('\n'));
      setLoadedPatentFiles(files.map((file) => file.name));
    } catch {
      setPatentInputError('The selected file could not be read. Try a CSV or TXT file.');
      setLoadedPatentFiles([]);
    } finally {
      input.value = '';
    }
  };
  const retrievePatentNumbers = async (numbers: string[], clearNumberInput: boolean) => {
    if (patentImportProgress || !numbers.length) return;
    setPatentInputError('');
    setPatentImportProgress({ completed: 0, total: numbers.length });
    let completed = 0;

    for (let offset = 0; offset < numbers.length; offset += patentImportBatchSize) {
      const batch = numbers.slice(offset, offset + patentImportBatchSize);
      try {
        const { drafts: nextDrafts } = await previewPatent.mutateAsync(batch.join('\n'));
        setDrafts((current) => {
          const draftsByNumber = new Map(current.map((draft) => [draft.normalizedPatentNumber, draft]));
          nextDrafts.forEach((draft) => draftsByNumber.set(draft.normalizedPatentNumber, draft));
          return [...draftsByNumber.values()];
        });
        setSelectedClaims((current) => ({
          ...current,
          ...Object.fromEntries(nextDrafts.map((draft) => [
            draft.publicId,
            draft.patent.claims.filter((claim) => claim.claimType === 'INDEPENDENT' && claim.selectedForMonitoring).map((claim) => claim.claimNumber),
          ])),
        }));
        completed += batch.length;
        if (clearNumberInput) setPatentNumbers(numbers.slice(completed).join('\n'));
        setPatentImportProgress({ completed, total: numbers.length });
      } catch {
        const remaining = numbers.slice(completed);
        if (clearNumberInput) setPatentNumbers(remaining.join('\n'));
        setPatentInputError(`Stopped after ${completed} of ${numbers.length}. The remaining ${remaining.length} patent number${remaining.length === 1 ? '' : 's'} are still in the list and can be retried.`);
        setPatentImportProgress(null);
        return;
      }
    }

    if (clearNumberInput) setPatentNumbers('');
    setPatentImportProgress(null);
  };
  const submitPatent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (patentImportProgress) return;
    const numbers = extractPatentNumbers(patentNumbers);
    if (!numbers.length) {
      setPatentInputError('No valid U.S. patent numbers were found. Enter numbers or load a CSV/TXT list.');
      return;
    }
    setLoadedPatentFiles([]);
    await retrievePatentNumbers(numbers, true);
  };
  const searchAssignee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPatentInputError('');
    setAssigneeMatches([]);
    setSelectedAssigneeNumbers([]);
    setAssigneeSearchTruncated(false);
    setAssignmentSearchTruncated(false);
    const alternateAssignees = [...new Set(alternateAssigneeNames.split(/[\n,;]+/).map((name) => name.trim()).filter(Boolean))];
    if (alternateAssignees.length > 10) {
      setPatentInputError('Enter up to 10 alternate assignee names.');
      return;
    }
    try {
      const response = await assigneeSearch.mutateAsync({
        assignee: assigneeSearchText,
        alternateAssignees,
        includeAssignments: includeAssignmentRecords,
      });
      setAssigneeMatches(response.results);
      setAssigneeSearchTruncated(response.truncated);
      setAssignmentSearchTruncated(response.assignmentSearchTruncated ?? false);
      setSelectedAssigneeNumbers(getEligibleAssigneePatentNumbers(response.results, data?.patents ?? []));
    } catch (error) {
      setPatentInputError(error instanceof Error ? error.message : 'USPTO assignee search failed.');
    }
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
           <div className="flex flex-wrap items-center gap-2">
             <button type="button" onClick={exportPortfolio} disabled={exporting} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted/50 disabled:cursor-wait disabled:opacity-60"><Download className="h-4 w-4" /> {exporting ? 'Preparing…' : 'Export spreadsheet'}</button>
             <button type="button" aria-expanded={addOpen} aria-controls="add-patent-panel" onClick={() => setAddOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"><Plus className="h-4 w-4" /> Add patent</button>
          </div>
        </header>
        {exportError && <p role="alert" className="-mt-5 mb-5 text-xs font-medium text-red-700">{exportError}</p>}

        <section className="mb-6" aria-labelledby="portfolio-analytics-heading">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="portfolio-analytics-heading" className="font-display text-sm font-semibold text-foreground">Portfolio analytics</h2>
            <p className="text-[11px] text-muted-foreground">Portfolio and recommendation status at a glance</p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-5">
            <div className="bg-card px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Portfolio</p><p className="mt-1 font-display text-2xl font-semibold">{counts.all}<span className="ml-1 text-sm font-medium text-muted-foreground">records</span></p></div>
            <div className="bg-card px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Monitoring</p><p className="mt-1 font-display text-2xl font-semibold text-emerald-700">{counts.active}<span className="ml-1 text-sm font-medium text-muted-foreground">running</span></p></div>
            {([
              ['Maintain', 'border-t-2 border-t-emerald-300 text-emerald-700', 'bg-emerald-50/45'],
              ['Review', 'border-t-2 border-t-[#c4a56e] text-[#80643c]', 'bg-[#f6f0e4]'],
              ['Prune', 'border-t-2 border-t-red-300 text-red-700', 'bg-red-50/60'],
            ] as const).map(([label, tone, surface]) => (
              <div key={label} data-testid={`stat-recommendation-${label.toLowerCase()}`} className={`bg-card px-5 py-4 ${tone} ${surface}`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em]">{label}</p>
                <p className="mt-1 font-display text-2xl font-semibold">{recommendationCounts[label.toUpperCase() as Recommendation]}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{counts.all ? 'designated records' : 'No patents in portfolio'}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-[0_12px_35px_-26px_rgba(24,45,72,0.45)] sm:p-5" aria-labelledby="maintenance-estimate-heading">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Portfolio analytics</p>
              <h2 id="maintenance-estimate-heading" className="mt-1 font-display text-base font-semibold">Maintenance fee cost estimate</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Compare projected future USPTO maintenance fees by entity size and portfolio decision.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Entity size</span>
              <div role="group" aria-label="Entity size" className="inline-flex rounded-xl bg-muted/70 p-1">
                {([
                  ['MICRO', 'Micro'],
                  ['SMALL', 'Small'],
                  ['LARGE', 'Large'],
                ] as const).map(([size, label]) => <button key={size} type="button" aria-pressed={maintenanceEntitySize === size} onClick={() => setMaintenanceEntitySize(size)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${maintenanceEntitySize === size ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>)}
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,.75fr)]">
            <div className="min-w-0">
              <div role="group" aria-label="Maintenance scenario" className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1">
                {([
                  ['MAINTAIN', 'Maintain Only'],
                  ['MAINTAIN_REVIEW', 'Maintain + Review'],
                  ['ALL', 'All Patents'],
                ] as const).map(([scenario, label]) => <button key={scenario} type="button" aria-pressed={maintenanceScenario === scenario} onClick={() => setMaintenanceScenario(scenario)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${maintenanceScenario === scenario ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{label}</button>)}
              </div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-display text-4xl font-semibold tracking-tight text-foreground">{feeCurrency(maintenanceEstimate.total)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{maintenanceEstimate.includedCount} portfolio patents in scenario · {maintenanceEstimate.patentsWithFutureFees} with remaining fee windows</p>
                </div>
                <p className="text-xs font-semibold text-primary">{maintenanceEntitySize[0] + maintenanceEntitySize.slice(1).toLowerCase()} entity rate</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Projected fee windows</h3>
              <div className="mt-2 space-y-2">
                {maintenanceEstimate.byMilestone.map((milestone) => <div key={milestone.label} className="flex items-center justify-between gap-3 text-xs"><span className="text-muted-foreground">{milestone.label} · {milestone.count} patents</span><span className="font-semibold">{feeCurrency(milestone.subtotal)}</span></div>)}
              </div>
            </div>
          </div>
          {(maintenanceEstimate.missingIssueDateCount > 0 || maintenanceEstimate.noFutureWindowCount > 0) && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] leading-4 text-amber-900">
            {maintenanceEstimate.missingIssueDateCount > 0 && `${maintenanceEstimate.missingIssueDateCount} patent${maintenanceEstimate.missingIssueDateCount === 1 ? ' has' : 's have'} no issue date and could not be estimated. `}
            {maintenanceEstimate.noFutureWindowCount > 0 && `${maintenanceEstimate.noFutureWindowCount} selected patent${maintenanceEstimate.noFutureWindowCount === 1 ? ' has' : 's have'} no remaining scheduled fee window; verify payment and current status.`}
          </p>}
          <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-[10px] leading-4 text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
            <p>Estimates remaining fee windows through 11.5 years from issue date. Assumes each included fee is unpaid; payment status is not verified. Excludes late surcharges and other costs.</p>
            <a href="https://www.uspto.gov/learning-and-resources/fees-and-payment/uspto-fee-schedule" target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-primary underline-offset-2 hover:underline">USPTO fee schedule (revised Aug. 2026)</a>
          </div>
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
              ] as const).map(([key, label, count]) => {
                const statusTone = key === 'ACTIVE' ? 'text-emerald-700' : key === 'PAUSED' ? 'text-amber-700' : '';
                const markerTone = key === 'ACTIVE' ? 'bg-emerald-500' : key === 'PAUSED' ? 'bg-amber-500' : '';
                const textTone = statusTone || (filter === key ? 'text-primary' : 'text-muted-foreground hover:text-foreground');
                return <button key={key} type="button" onClick={() => setFilter(key)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${textTone} ${filter === key ? 'bg-card shadow-sm' : ''}`}>{markerTone && <span aria-hidden="true" className={`mr-1.5 inline-block h-2 w-2 rounded-full ${markerTone}`} />}{label} <span className="ml-1 text-[10px] opacity-70">{count}</span></button>;
              })}
              <button type="button" onClick={() => { setFilter('ALL'); setRecommendationFilter((value) => value === 'PRUNE' ? 'ALL' : 'PRUNE'); }} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${recommendationFilter === 'PRUNE' ? 'bg-card text-red-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Prune <span className="ml-1 text-[10px] opacity-70">{recommendationCounts.PRUNE}</span></button>
            </div>
            {filtersOpen && <div className="mt-4 grid gap-3 rounded-xl border border-border bg-muted/25 p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <label className="flex min-w-0 flex-col text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><span className="flex h-8 items-end leading-3">Monitoring</span><select value={monitorFilter} onChange={(event) => setMonitorFilter(event.target.value as typeof monitorFilter)} className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground"><option value="ALL">All states</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option></select></label>
              <label className="flex min-w-0 flex-col text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><span className="flex h-8 items-end leading-3">Recommendation</span><select value={recommendationFilter} onChange={(event) => setRecommendationFilter(event.target.value as Recommendation | 'ALL')} className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground"><option value="ALL">All</option><option value="NOT_ANALYZED">Not analyzed</option><option value="MAINTAIN">Maintain</option><option value="REVIEW">Review</option><option value="PRUNE">Prune</option></select></label>
              <label className="flex min-w-0 flex-col text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><span className="flex h-8 items-end leading-3">Claim scope</span><select value={claimScopeFilter} onChange={(event) => setClaimScopeFilter(event.target.value as MetricFilter)} className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground"><option value="ALL">All</option><option value="NOT_ANALYZED">Not analyzed</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label>
              <label className="flex min-w-0 flex-col text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><span className="flex h-8 items-end leading-3">Detectability</span><select value={detectabilityFilter} onChange={(event) => setDetectabilityFilter(event.target.value as MetricFilter)} className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground"><option value="ALL">All</option><option value="NOT_ANALYZED">Not analyzed</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label>
              <label className="flex min-w-0 flex-col text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><span className="flex h-8 items-end leading-3">Validity</span><select value={validityFilter} onChange={(event) => setValidityFilter(event.target.value as MetricFilter)} className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground"><option value="ALL">All</option><option value="NOT_ANALYZED">Not analyzed</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label>
              <label className="flex min-w-0 flex-col text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><span className="flex h-8 items-end leading-3">Infringement</span><select value={infringementFilter} onChange={(event) => setInfringementFilter(event.target.value as MetricFilter)} className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground"><option value="ALL">All</option><option value="NOT_ANALYZED">Not analyzed</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select></label>
              <label className="flex min-w-0 flex-col text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><span className="flex h-8 items-end leading-3">Forward citations min</span><input inputMode="numeric" value={citationMin} onChange={(event) => setCitationMin(event.target.value.replace(/\D/g, ''))} placeholder="—" className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground" /></label>
              <label className="flex min-w-0 flex-col text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground"><span className="flex h-8 items-end leading-3">Forward citations max</span><input inputMode="numeric" value={citationMax} onChange={(event) => setCitationMax(event.target.value.replace(/\D/g, ''))} placeholder="—" className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs font-medium normal-case tracking-normal text-foreground" /></label>
            </div>}
          </div>

          {canManageMonitoring && <div className="flex flex-col gap-3 border-b border-border bg-primary/[0.025] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="inline-flex cursor-pointer items-center gap-2 font-semibold">
                <input type="checkbox" aria-label="Select all visible patents" checked={allVisibleSelected} disabled={!selectablePatentIds.length} onChange={(event) => setSelectedPatentIds(event.target.checked ? selectablePatentIds : [])} className="accent-[hsl(var(--primary))]" />
                Select all visible
              </label>
              <span className="text-muted-foreground">{selectedVisiblePatentIds.length} selected</span>
              {selectedVisiblePatentIds.length > 0 && <button type="button" onClick={() => setSelectedPatentIds([])} className="font-semibold text-muted-foreground underline-offset-2 hover:underline">Clear selection</button>}
            </div>
            {selectedVisiblePatentIds.length > 0 && <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Set selected patent recommendation" value={bulkRecommendation} onChange={(event) => setBulkRecommendation(event.target.value as Recommendation | '')} className="h-9 rounded-lg border border-input bg-background px-2 text-xs">
                <option value="">Set designation…</option><option value="NOT_ANALYZED">Not analyzed</option><option value="MAINTAIN">Maintain</option><option value="REVIEW">Review</option><option value="PRUNE">Prune</option>
              </select>
              <button type="button" disabled={!bulkRecommendation || bulkUpdatePatents.isPending} onClick={() => applyBulkUpdate({ recommendation: bulkRecommendation as Recommendation })} className="h-9 rounded-lg border border-border bg-card px-3 text-xs font-semibold disabled:opacity-50">{bulkUpdatePatents.isPending ? 'Saving…' : 'Apply designation'}</button>
               <button type="button" disabled={bulkUpdatePatents.isPending || bulkDeletePatents.isPending} onClick={() => applyBulkUpdate({ monitoringActive: false })} className="h-9 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-800 disabled:opacity-50">Pause monitoring</button>
               <button type="button" disabled={bulkUpdatePatents.isPending || bulkDeletePatents.isPending} onClick={() => applyBulkUpdate({ monitoringActive: true })} className="h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 disabled:opacity-50">Resume monitoring</button>
               <button type="button" disabled={bulkDeletePatents.isPending || bulkUpdatePatents.isPending} onClick={deleteSelectedPatents} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-800 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> {bulkDeletePatents.isPending ? 'Deleting…' : 'Delete selected'}</button>
            </div>}
            {bulkUpdatePatents.error && <p role="alert" className="text-xs text-red-700">{bulkUpdatePatents.error instanceof Error ? bulkUpdatePatents.error.message : 'The selected patents could not be updated.'}</p>}
            {bulkDeletePatents.error && <p role="alert" className="text-xs text-red-700">{bulkDeletePatents.error instanceof Error ? bulkDeletePatents.error.message : 'The selected patents could not be deleted.'}</p>}
          </div>}

          <div className="hidden grid-cols-[minmax(200px,1.5fr)_minmax(130px,.8fr)_minmax(250px,1.4fr)_40px] items-center gap-3 border-b border-border bg-muted/30 px-5 py-3 lg:grid">
            <CompactSortButton label="Patent" active={sortKey === 'patent'} direction={sortDirection} onClick={() => setSort('patent')} />
            <CompactSortButton label="Recommendation" active={sortKey === 'recommendation'} direction={sortDirection} onClick={() => setSort('recommendation')} />
            <CompactSortButton label="AI metrics" active={sortKey === 'citations'} direction={sortDirection} onClick={() => setSort('citations')} />
            <span className="text-right text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Actions</span>
          </div>
          <div className="divide-y divide-border">
            {patents.map((patent) => {
              const expanded = expandedId === patent.publicId;
              const selectedClaimsForMonitoring = patent.claims.filter((claim) => claim.selectedForMonitoring);
              const findings = data.analysisRuns.filter((run) => run.patentId === patent.publicId);
              const latestFinding = findings[0];
              const feeWindows = maintenanceFeeWindows(patent.issueDate);
              const toggleExpanded = () => {
                setExpandedId(expanded ? null : patent.publicId);
                setSelectedMetric(null);
                if (expanded) setClaimSelectionId(null);
              };
              const rowTone = patent.monitoringActive
                ? 'border-l-emerald-400 bg-emerald-50/35'
                : 'border-l-amber-400 bg-amber-50/45';
              return (
                <div key={patent.publicId} className={`border-l-4 ${rowTone} ${expanded ? 'ring-1 ring-inset ring-primary/20' : ''} transition-colors`}>
                  <div className="flex items-start gap-3 px-4 sm:px-5">
                  <label className={`mt-4 inline-flex shrink-0 items-center ${!canManageMonitoring ? 'invisible' : ''}`}>
                    <input type="checkbox" aria-label={`Select ${patent.patentNumber}`} checked={selectedVisiblePatentIds.includes(patent.publicId)} disabled={!canManageMonitoring} onChange={(event) => setSelectedPatentIds((current) => event.target.checked ? [...new Set([...current, patent.publicId])] : current.filter((id) => id !== patent.publicId))} className="accent-[hsl(var(--primary))]" />
                  </label>
                  <div role="button" aria-label={`${patent.patentNumber}, ${patent.monitoringActive ? 'monitoring' : 'paused'}`} tabIndex={0} onClick={toggleExpanded} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleExpanded(); } }} className="grid min-w-0 flex-1 cursor-pointer gap-3 py-3 outline-none transition hover:bg-primary/[0.035] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:grid-cols-[minmax(0,1fr)_minmax(120px,auto)] md:items-center lg:grid-cols-[minmax(200px,1.5fr)_minmax(130px,.8fr)_minmax(250px,1.4fr)_40px] lg:gap-3">
                    <div className="flex min-w-0 items-center gap-2"><span className="hidden shrink-0 text-muted-foreground md:block">{expanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4" />}</span><div className="min-w-0"><p className="font-mono text-sm font-semibold tracking-tight text-foreground">{patent.patentNumber}</p><p className="truncate text-xs text-muted-foreground">{patent.title || 'Title unavailable'}</p></div></div>
                    <div><RecommendationPill value={patent.recommendation} /></div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <MetricBreakdownItem label="Claims" fullLabel="Claim scope" value="—" /><span aria-hidden="true" className="text-muted-foreground/50">/</span>
                      <MetricBreakdownItem label="Detect" fullLabel="Detectability" value="—" /><span aria-hidden="true" className="text-muted-foreground/50">/</span>
                      <MetricBreakdownItem label="Validity" fullLabel="Validity" value="—" /><span aria-hidden="true" className="text-muted-foreground/50">/</span>
                      <MetricBreakdownItem label="Infringe" fullLabel="Infringement" value="—" /><span aria-hidden="true" className="text-muted-foreground/50">/</span>
                      <MetricBreakdownItem label="Fwd cites" fullLabel="Forward citations" value="—" />
                    </div>
                    <div className="ml-auto"><PatentRowActions patent={patent} canManageMonitoring={canManageMonitoring} /></div>
                  </div>
                  </div>
                       {expanded && <div className="border-t border-primary/10 bg-primary/[0.025] px-4 pb-3 pt-2 sm:px-5">
                        <div className="mb-2 flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Expanded patent dashboard</p><ExpandedMonitoringControl patent={patent} canEdit={canManageMonitoring} /></div>
                       <div className="grid gap-2.5 lg:grid-cols-2">
                          <div className="order-2 space-y-2.5">
                          <section className={`rounded-xl border p-3 ${recommendationPanelTone(patent.recommendation)}`}>
                            <h3 className="text-sm font-semibold">Recommendation</h3>
                             <div className="mt-1.5"><RecommendationPill value={patent.recommendation} /></div>
                             <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Rationale and attorney disposition will appear when recorded.</p>
                          </section>
                           <section className="rounded-xl border border-primary/15 bg-card p-2.5">
                            <div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-primary" /><h3 className="text-sm font-semibold">AI overview</h3></div>
                            {latestFinding?.summary
                               ? <><p className="mt-1.5 whitespace-pre-wrap text-xs leading-4 text-foreground">{latestFinding.summary}</p><p className="mt-1.5 text-[10px] text-muted-foreground">Recorded {dateLabel(latestFinding.createdAt)} · {latestFinding.provider}</p></>
                               : <p className="mt-1.5 text-xs leading-4 text-muted-foreground">No AI analysis has been recorded for this patent.</p>}
                          </section>
                          <section className="order-1 rounded-xl border border-border bg-card p-2.5">
                             <div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">AI metrics</h3><p className="mt-0.5 text-[10px] text-muted-foreground">Select a score for details.</p></div><Sparkles className="h-3.5 w-3.5 text-primary" /></div>
                             <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                              {([
                                ['claimScope', 'Claim scope', 'Not analyzed'],
                                ['detectability', 'Detectability', 'Not analyzed'],
                                ['validity', 'Validity', 'Not analyzed'],
                                ['infringement', 'Infringement', 'Not analyzed'],
                                ['citations', 'Forward Citations', '—'],
                               ] as const).map(([key, label, value]) => <button key={key} type="button" onClick={(event) => { event.stopPropagation(); setSelectedMetric(key); }} className="flex min-h-11 min-w-0 flex-col justify-center rounded-lg border border-border bg-muted/25 px-2 py-1.5 text-left transition hover:border-primary/30 hover:bg-primary/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                 <span className="truncate text-[9px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{label}</span>
                                 <span className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">{value}</span>
                              </button>)}
                            </div>
                          </section>
                        </div>
                        <section className="rounded-xl border border-border bg-card p-2.5">
                          <h3 className="text-sm font-semibold">Bibliographic information</h3>
                          <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-3">
                            <div className="col-span-2 sm:col-span-3"><dt className="text-[9px] text-muted-foreground">Patent title</dt><dd className="mt-0.5 font-medium">{patent.title || 'Not recorded'}</dd></div>
                            <div><dt className="text-[10px] text-muted-foreground">Patent number</dt><dd className="mt-0.5 font-medium">{patent.patentNumber}</dd></div>
                            <div><dt className="text-[10px] text-muted-foreground">Application number</dt><dd className="mt-0.5 font-medium">{patent.applicationNumber || 'Not recorded'}</dd></div>
                            <div><dt className="text-[10px] text-muted-foreground">Jurisdiction</dt><dd className="mt-0.5 font-medium">{patent.jurisdiction || 'Not recorded'}</dd></div>
                            <div className="col-span-2 sm:col-span-3"><dt className="text-[10px] text-muted-foreground">Current assignee</dt><dd className="mt-0.5 font-medium">{patent.assignee || 'Not recorded'}</dd></div>
                            <div className="col-span-2 sm:col-span-3"><dt className="text-[10px] text-muted-foreground">Inventors</dt><dd className="mt-0.5 font-medium">{patent.inventors.length ? patent.inventors.join(', ') : 'Not recorded'}</dd></div>
                            <div><dt className="text-[10px] text-muted-foreground">Filing date</dt><dd className="mt-0.5 font-medium">{dateLabel(patent.filingDate)}</dd></div>
                            <div><dt className="text-[10px] text-muted-foreground">Issue date</dt><dd className="mt-0.5 font-medium">{dateLabel(patent.issueDate)}</dd></div>
                            <div><dt className="text-[10px] text-muted-foreground">Earliest priority</dt><dd className="mt-0.5 font-medium">{dateLabel(patent.earliestPriorityDate)}</dd></div>
                            <div><dt className="text-[10px] text-muted-foreground">USPTO status</dt><dd className="mt-0.5">{patent.patentStatus && /expired/i.test(patent.patentStatus) ? <span className="inline-flex rounded bg-red-50 px-1.5 py-0.5 font-semibold text-red-700">{patent.patentStatus}</span> : <span className="font-medium">{patent.patentStatus || 'Not recorded'}</span>}</dd></div>
                            <div title="Estimated from the issue date; payment history is not verified."><dt className="text-[10px] text-muted-foreground">Next Maintenance Fee</dt><dd aria-label="Estimated next maintenance fee; payment history is not verified" className="mt-0.5 font-semibold">{/expired/i.test(patent.patentStatus || '') ? 'No upcoming fee' : (feeWindows.find((window) => window.remaining)?.label || (patent.issueDate ? 'No upcoming fee' : 'Not available'))}</dd></div>
                          </dl>
                        </section>
                      </div>
                      <div className="mt-2.5 grid gap-2.5 lg:grid-cols-2">
                        <section className="rounded-xl border border-border bg-card p-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Monitored claims</h3><p className="mt-1 text-[10px] text-muted-foreground">Selected claims included in monitoring.</p></div><button type="button" onClick={(event) => { event.stopPropagation(); setClaimSelectionId(patent.publicId); }} className="portal-action inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/50"><FileSearch className="h-3.5 w-3.5" /> View Full Claim Set</button></div><div className="mt-2 grid gap-2">{selectedClaimsForMonitoring.map((claim) => <article key={claim.publicId} className="rounded-lg bg-muted/35 p-2"><p className="text-xs font-semibold">Claim {claim.claimNumber} <span className="font-normal text-muted-foreground">· Selected for monitoring</span></p><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-4 text-muted-foreground">{compactClaimText(claim.claimText)}</p></article>)}{!selectedClaimsForMonitoring.length && <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">No claims are selected for monitoring.</p>}</div></section>
                       {canManageMonitoring && <AttorneyNotesPanel patent={patent} canEdit={canManageMonitoring} />}
                     </div>
                       <div className="mt-3 flex flex-wrap items-center gap-2"><a href={googlePatentsUrl(patent.patentNumber)} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/50">Open in Google Patents <ExternalLink className="h-3.5 w-3.5" /></a><a href={espacenetUrl(patent.patentNumber)} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/50">Open in Espacenet <ExternalLink className="h-3.5 w-3.5" /></a><span className="ml-auto text-[11px] text-muted-foreground">Last analyzed {dateLabel(patent.lastAnalyzedAt || latestFinding?.createdAt)}</span></div>
                      {selectedMetric && <MetricDetailsDialog metric={metricDetails[selectedMetric]} latestSummary={latestFinding?.summary} analyzedAt={latestFinding?.createdAt} onClose={() => setSelectedMetric(null)} />}
                   </div>}
                   {claimSelectionId === patent.publicId && <ClaimViewerModal key={patent.publicId} patent={patent} canEdit={canManageMonitoring} onClose={() => setClaimSelectionId(null)} />}
                </div>
              );
            })}
            {!patents.length && <div className="px-6 py-16 text-center"><Filter className="mx-auto h-7 w-7 text-muted-foreground/60" /><p className="mt-3 text-sm font-semibold">No records match this view</p><p className="mt-1 text-sm text-muted-foreground">{filtersActive ? 'Clear or adjust the active filters.' : 'Add a patent to begin monitoring this project.'}</p></div>}
          </div>
        </section>

        {addOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-2 sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && patentImportProgress === null) setAddOpen(false); }}>
          <section id="add-patent-panel" role="dialog" aria-modal="true" aria-labelledby="add-patent-heading" aria-describedby="add-patent-description" tabIndex={-1} onMouseDown={(event) => event.stopPropagation()} className="max-h-[94vh] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card shadow-2xl">
          <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-border bg-card/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between"><div><h2 id="add-patent-heading" className="font-display text-lg font-semibold">Add patents</h2><p id="add-patent-description" className="mt-1 text-sm text-muted-foreground">Paste patent numbers or load CSV/TXT files. Large lists are retrieved in batches, then reviewed before records are added.</p></div><button type="button" aria-label="Close add patents dialog" disabled={patentImportProgress !== null} onClick={() => setAddOpen(false)} className="self-start rounded-lg border border-border p-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 sm:self-auto"><X className="h-4 w-4" /></button></div>
           <form onSubmit={searchAssignee} className="space-y-3 border-b border-border bg-muted/20 p-5">
             <div><h3 className="text-sm font-semibold">Find patents by assignee</h3><p className="mt-1 text-xs text-muted-foreground">Search issued U.S. patents in USPTO records, then select the ones to retrieve for review.</p></div>
             <div className="flex flex-col gap-2 sm:flex-row"><input required minLength={2} maxLength={120} value={assigneeSearchText} onChange={(event) => setAssigneeSearchText(event.target.value)} placeholder="Company or assignee name" className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm" /><button type="submit" disabled={assigneeSearch.isPending || patentImportProgress !== null} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold disabled:opacity-50"><Search className={`h-4 w-4 ${assigneeSearch.isPending ? 'animate-pulse' : ''}`} />{assigneeSearch.isPending ? 'Searching USPTO…' : 'Search USPTO'}</button></div>
              <label className="block text-xs font-semibold text-foreground">Former or alternate company names <span className="font-normal text-muted-foreground">(optional, up to 10; separate names with commas or new lines)</span>
                <textarea value={alternateAssigneeNames} onChange={(event) => setAlternateAssigneeNames(event.target.value)} maxLength={1300} rows={2} placeholder={'Example Holdings, Inc.\nPrevious Company LLC'} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal" />
              </label>
              <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={includeAssignmentRecords} onChange={(event) => setIncludeAssignmentRecords(event.target.checked)} className="mt-0.5 accent-[hsl(var(--primary))]" /><span><span className="font-semibold text-foreground">Check USPTO assignment records</span><span className="mt-0.5 block">Checks recorded transfers for patents found by assignee-name search. Coverage is limited to the 500 most recently issued candidates per search.</span></span></label>
             {assigneeMatches.length > 0 && <div className="space-y-2">
                 <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-semibold">{assigneeMatches.length} matching patents{assigneeSearchTruncated ? ' (result limit reached; refine the name)' : ''}</span><button type="button" onClick={() => { const eligible = getEligibleAssigneePatentNumbers(assigneeMatches, data?.patents ?? []); setSelectedAssigneeNumbers(selectedAssigneeNumbers.length === eligible.length ? [] : eligible); }} className="font-semibold text-primary">Select / clear eligible</button></div>
                {assignmentSearchTruncated && <p className="text-xs text-amber-800">Assignment records were checked for the 500 most recently issued candidates only. Narrow the name search to check additional patents.</p>}
               <div className="max-h-64 overflow-auto rounded-lg border border-border bg-background">
                 {assigneeMatches.map((item) => {
                    const alreadyAdded = isAssigneePatentAlreadyAdded(item, data?.patents ?? []);
                   const checked = selectedAssigneeNumbers.includes(item.normalizedPatentNumber);
                   return <label key={item.normalizedPatentNumber} className="flex cursor-pointer gap-3 border-b border-border p-3 last:border-0 hover:bg-muted/30">
                     <input type="checkbox" disabled={alreadyAdded || patentImportProgress !== null} checked={checked} onChange={(event) => setSelectedAssigneeNumbers((current) => event.target.checked ? [...current, item.normalizedPatentNumber] : current.filter((number) => number !== item.normalizedPatentNumber))} className="mt-1 accent-[hsl(var(--primary))]" />
                      <span className="min-w-0 flex-1"><span className="font-mono text-xs font-semibold">{item.normalizedPatentNumber}</span><span className="ml-2 text-[10px] text-muted-foreground">{item.issueDate || 'Issue date unavailable'}{alreadyAdded ? ' · Already in project' : ''}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{item.title || 'Title unavailable'} · {item.assignee}</span><span className="mt-1 flex flex-wrap gap-1">{item.matchSources.map((source, index) => <span key={`${source.type}-${source.matchedName}-${index}`} className={`rounded px-1.5 py-0.5 text-[10px] ${source.type === 'assignment' ? 'bg-amber-100 text-amber-900' : 'bg-muted text-muted-foreground'}`}>{source.type === 'application' ? `Application metadata · ${source.matchedName}` : `USPTO assignment ${source.partyRole === 'ASSIGNOR' ? '(prior owner)' : '(recipient)'} · ${source.matchedName}${source.recordedDate ? ` · recorded ${source.recordedDate}` : ''}${source.conveyance ? ` · ${source.conveyance}` : ''}`}</span>)}</span></span>
                   </label>;
                 })}
               </div>
                <button type="button" disabled={!selectedAssigneeNumbers.length || patentImportProgress !== null} onClick={() => void retrievePatentNumbers(getSelectedEligibleAssigneePatentNumbers(assigneeMatches, selectedAssigneeNumbers, data?.patents ?? []), false)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><RefreshCw className="h-4 w-4" />Retrieve {selectedAssigneeNumbers.length} selected for review</button>
             </div>}
             {assigneeMatches.length === 0 && assigneeSearch.isSuccess && <p className="text-xs text-muted-foreground">No issued patents matched this assignee name.</p>}
           </form>
          <form onSubmit={submitPatent} className="space-y-3 p-5">
            <label className="block text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">U.S. patent numbers
              <textarea required disabled={patentImportProgress !== null} value={patentNumbers} onChange={(event) => { setPatentNumbers(event.target.value); setPatentInputError(''); }} placeholder={'US 12,345,678 B2\n12345679'} className="mt-2 min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal outline-none ring-primary/20 transition focus:ring-4 disabled:opacity-60" />
            </label>
            <p className="text-[11px] leading-4 text-muted-foreground">Numbers are deduplicated automatically. There is no total list limit; retrieval runs in batches of {patentImportBatchSize}.</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <label htmlFor="patent-import-files" className="block text-xs font-semibold text-foreground">Upload one or more CSV/TXT files</label>
                <input id="patent-import-files" type="file" accept=".csv,.txt,text/csv,text/plain" multiple disabled={patentImportProgress !== null} onChange={handlePatentFileChange} className="mt-1 block max-w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-2 file:text-xs file:font-semibold file:text-foreground hover:file:bg-muted disabled:opacity-60" />
                {loadedPatentFiles.length > 0 && <p className="mt-1 text-[10px] text-muted-foreground">Loaded: {loadedPatentFiles.join(', ')}</p>}
              </div>
              <button type="submit" disabled={patentImportProgress !== null || previewPatent.isPending} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${previewPatent.isPending ? 'animate-spin' : ''}`} />
                {patentImportProgress ? `Retrieving ${patentImportProgress.completed}/${patentImportProgress.total}…` : 'Retrieve for review'}
              </button>
            </div>
            {patentImportProgress && <p role="status" aria-live="polite" className="text-xs text-muted-foreground">Retrieved {patentImportProgress.completed} of {patentImportProgress.total} patent numbers. Keep this panel open while retrieval finishes.</p>}
          </form>
          {(patentInputError || previewPatent.error) && <div aria-live="polite" className="space-y-1 px-5 pb-4 text-sm text-red-700">{patentInputError && <p>{patentInputError}</p>}{previewPatent.error && <p>{previewPatent.error instanceof Error ? previewPatent.error.message : 'Patent retrieval failed.'}</p>}</div>}
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
        </section></div>}

        <footer className="mt-8 flex flex-col gap-2 border-t border-border pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span className="inline-flex items-center gap-2"><LockKeyhole className="h-3.5 w-3.5" /> Data added intentionally to this project stays within its access boundary.</span><span>Processing: {providerLabels[data.aiConfig.selectedProvider]}</span></footer>
      </div>
    </div>
  );
}