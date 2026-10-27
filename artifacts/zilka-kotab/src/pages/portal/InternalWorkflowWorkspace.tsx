import { ChangeEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileSpreadsheet,
  FileUp,
  Filter,
  History,
  Loader2,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';

export interface WorkflowMatter {
  id: string;
  matterNumber: string;
  title: string;
  clientName?: string | null;
  status?: string | null;
  appCollId?: string | null;
  importedAt?: string | null;
}

export interface MatterImportHistoryItem {
  id: string;
  fileName: string;
  importedAt: string;
  status: 'completed' | 'partial' | 'failed' | 'processing' | string;
  totalRows: number;
  importedCount: number;
  skippedCount?: number;
  errorCount?: number;
}

export interface CsvPreviewRow {
  id: string;
  matterNumber: string;
  title: string;
  clientName?: string | null;
  disposition: 'ready' | 'duplicate' | 'invalid' | string;
  detail?: string | null;
}

export interface CsvPreviewSummary {
  totalRows: number;
  readyCount: number;
  duplicateCount: number;
  invalidCount: number;
  rows?: CsvPreviewRow[];
}

export interface CsvUploadState {
  fileName?: string | null;
  isUploading?: boolean;
  isPreviewing?: boolean;
  error?: string | null;
}

export interface InternalWorkflowWorkspaceProps {
  canImport?: boolean;
  matters: WorkflowMatter[];
  importHistory: MatterImportHistoryItem[];
  isLoading: boolean;
  error: string | null;
  uploadState: CsvUploadState;
  previewSummary: CsvPreviewSummary | null;
  onCsvFileSelected: (file: File) => void;
  onApplyConfirm: () => void;
  onRetry?: () => void;
  onClearPreview?: () => void;
}

const statusLabels: Record<string, string> = {
  ready: 'Ready to import',
  duplicate: 'Already in AppColl',
  invalid: 'Needs attention',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function statusClass(status: string) {
  if (status === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'partial') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'failed') return 'border-rose-200 bg-rose-50 text-rose-800';
  if (status === 'processing') return 'border-sky-200 bg-sky-50 text-sky-800';
  return 'border-border bg-muted/60 text-muted-foreground';
}

function dispositionClass(disposition: string) {
  if (disposition === 'ready') return 'bg-emerald-50 text-emerald-800';
  if (disposition === 'duplicate') return 'bg-amber-50 text-amber-800';
  return 'bg-rose-50 text-rose-800';
}

export default function InternalWorkflowWorkspace({
  canImport = true,
  matters,
  importHistory,
  isLoading,
  error,
  uploadState,
  previewSummary,
  onCsvFileSelected,
  onApplyConfirm,
  onRetry,
  onClearPreview,
}: InternalWorkflowWorkspaceProps) {
  const [matterSearch, setMatterSearch] = useState('');
  const [matterStatus, setMatterStatus] = useState('all');
  const [historyOpen, setHistoryOpen] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [showAllPreviewRows, setShowAllPreviewRows] = useState(false);

  const visibleMatters = useMemo(() => {
    const query = matterSearch.trim().toLowerCase();
    return matters.filter((matter) => {
      const matchesQuery =
        !query ||
        [matter.matterNumber, matter.title, matter.clientName, matter.appCollId]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      const matchesStatus = matterStatus === 'all' || (matter.status ?? 'Unspecified') === matterStatus;
      return matchesQuery && matchesStatus;
    });
  }, [matters, matterSearch, matterStatus]);

  const matterStatuses = useMemo(
    () => Array.from(new Set(matters.map((matter) => matter.status ?? 'Unspecified'))).sort(),
    [matters],
  );

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) {
      setConfirmed(false);
      onCsvFileSelected(file);
    }
    event.currentTarget.value = '';
  };

  const busy = Boolean(uploadState.isUploading || uploadState.isPreviewing);
  const previewRows = previewSummary?.rows ?? [];
  const shownPreviewRows = showAllPreviewRows ? previewRows : previewRows.slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-9 lg:py-10">
      <header className="mb-8">
        <div className="mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span className="text-primary">Internal workflow</span>
          <span className="text-border">/</span>
          <span>Phase 1</span>
        </div>
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#d7c99f] bg-[#f7f1df] px-3 py-1.5 text-xs font-semibold text-[#725b26]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#a78638]" />
              AppColl Import Center
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
              Bring matters into view.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Review a CSV before applying it, then follow every completed import and the matters it added.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-[18px] w-[18px]" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Import source</p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">AppColl CSV</p>
            </div>
          </div>
        </div>
      </header>

      {canImport && <section aria-labelledby="import-title" className="mb-8 overflow-hidden rounded-2xl border border-[#cbd8df] bg-card shadow-[0_12px_35px_-28px_rgba(24,55,76,0.45)]">
        <div className="grid lg:grid-cols-[0.86fr_1.14fr]">
          <div className="relative overflow-hidden bg-[#163b56] px-6 py-7 text-[#f4f0e5] sm:px-8 sm:py-9">
            <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full border border-white/10" />
            <div className="absolute -right-1 top-0 h-44 w-44 rounded-full border border-white/[0.07]" />
            <div className="relative">
              <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl border border-[#d6b96f]/35 bg-[#d6b96f]/10 text-[#e0c47d]">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d7c280]">Careful by design</p>
              <h2 id="import-title" className="mt-2 max-w-sm font-display text-2xl font-semibold leading-tight tracking-[-0.025em] sm:text-[28px]">
                A clear review before anything is applied.
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-[#c4d0d7]">
                Select an AppColl export to inspect recognized rows, duplicates, and records that need attention.
              </p>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#c4d0d7]">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#d7c280]" /> Preview first</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#d7c280]" /> Confirm to apply</span>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Start an import</p>
                <h3 className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground">Choose an export file</h3>
              </div>
              {uploadState.fileName && (
                <div data-testid="text-selected-csv-file" className="max-w-full truncate rounded-md bg-muted/70 px-2.5 py-1.5 text-xs text-muted-foreground">
                  {uploadState.fileName}
                </div>
              )}
            </div>

            <label
              htmlFor="appcoll-csv-file"
              data-testid="dropzone-csv-upload"
              className={`mt-5 flex min-h-[146px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-5 py-6 text-center transition-colors ${
                busy ? 'pointer-events-none border-primary/30 bg-primary/[0.04]' : 'border-[#b8c9d3] bg-[#f7fafb] hover:border-primary/55 hover:bg-primary/[0.035]'
              }`}
            >
              {busy ? <Loader2 className="mb-3 h-6 w-6 animate-spin text-primary" /> : <FileUp className="mb-3 h-6 w-6 text-primary" />}
              <span className="text-sm font-semibold text-foreground">
                {uploadState.isUploading ? 'Uploading CSV…' : uploadState.isPreviewing ? 'Preparing preview…' : 'Select an AppColl CSV'}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">CSV files only · Your existing matters remain unchanged until you apply</span>
              <input
                id="appcoll-csv-file"
                data-testid="input-appcoll-csv"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                disabled={busy}
                onChange={handleFileChange}
              />
            </label>

            {(uploadState.error || error) && (
              <div data-testid="status-import-error" role="alert" className="mt-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="flex-1">{uploadState.error || error}</span>
                {onRetry && <button type="button" data-testid="button-retry-import" onClick={onRetry} className="shrink-0 font-semibold underline underline-offset-2">Retry</button>}
              </div>
            )}
          </div>
        </div>

        {previewSummary && (
          <div data-testid="section-csv-preview" className="border-t border-border bg-[#f8faf9]">
            <div className="flex flex-col justify-between gap-4 px-5 py-5 sm:px-8 sm:py-6 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary"><Check className="h-4 w-4" /></span>
                  <h3 className="font-display text-lg font-semibold text-foreground">Preview is ready</h3>
                </div>
                <p className="mt-1 pl-9 text-xs text-muted-foreground">Review the row summary before confirming this import.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <SummaryPill label="Rows" value={previewSummary.totalRows} testId="preview-count-total" />
                <SummaryPill label="Ready" value={previewSummary.readyCount} tone="ready" testId="preview-count-ready" />
                <SummaryPill label="Duplicates" value={previewSummary.duplicateCount} tone="duplicate" testId="preview-count-duplicate" />
                <SummaryPill label="Attention" value={previewSummary.invalidCount} tone="invalid" testId="preview-count-invalid" />
              </div>
            </div>

            {previewRows.length > 0 && (
              <div className="border-t border-border">
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-[#f1f5f5] text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                      <tr>
                        <th className="px-8 py-3">Matter number</th>
                        <th className="px-5 py-3">Matter</th>
                        <th className="px-5 py-3">Client</th>
                        <th className="px-5 py-3">Review</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {shownPreviewRows.map((row) => (
                        <tr key={row.id} data-testid={`row-preview-matter-${row.id}`} className="bg-card">
                          <td data-testid={`text-preview-number-${row.id}`} className="px-8 py-3.5 font-mono text-xs font-semibold text-foreground">{row.matterNumber || '—'}</td>
                          <td className="max-w-[320px] truncate px-5 py-3.5 font-medium text-foreground">{row.title || 'Untitled matter'}</td>
                          <td className="px-5 py-3.5 text-muted-foreground">{row.clientName || '—'}</td>
                          <td className="px-5 py-3.5">
                            <span data-testid={`status-preview-${row.id}`} className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${dispositionClass(row.disposition)}`}>
                              {statusLabels[row.disposition] ?? row.disposition}
                            </span>
                            {row.detail && <p className="mt-1 max-w-[210px] text-[11px] leading-4 text-muted-foreground">{row.detail}</p>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="divide-y divide-border sm:hidden">
                  {shownPreviewRows.map((row) => (
                    <div key={row.id} data-testid={`card-preview-matter-${row.id}`} className="bg-card px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] font-semibold text-primary">{row.matterNumber || 'No matter number'}</p>
                          <p className="mt-1 truncate text-sm font-semibold text-foreground">{row.title || 'Untitled matter'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{row.clientName || 'Client not provided'}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${dispositionClass(row.disposition)}`}>{statusLabels[row.disposition] ?? row.disposition}</span>
                      </div>
                      {row.detail && <p className="mt-2 text-xs leading-5 text-muted-foreground">{row.detail}</p>}
                    </div>
                  ))}
                </div>
                {previewRows.length > 6 && (
                  <div className="border-t border-border px-5 py-3 text-center">
                    <button type="button" data-testid="button-toggle-preview-rows" onClick={() => setShowAllPreviewRows((value) => !value)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                      {showAllPreviewRows ? 'Show fewer rows' : `Show all ${previewRows.length} rows`}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllPreviewRows ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-4 border-t border-border px-5 py-5 sm:px-8 md:flex-row md:items-center md:justify-between">
              <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-muted-foreground">
                <input
                  data-testid="checkbox-confirm-import"
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.currentTarget.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#163b56]"
                />
                <span>I have reviewed the preview and confirm applying the ready rows to the matter list.</span>
              </label>
              <div className="flex gap-2 md:shrink-0">
                {onClearPreview && (
                  <button type="button" data-testid="button-cancel-preview" onClick={() => { setConfirmed(false); onClearPreview(); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-muted-foreground transition hover:bg-muted">
                    <X className="h-4 w-4" /> Cancel
                  </button>
                )}
                <button
                  type="button"
                  data-testid="button-apply-import"
                  disabled={!confirmed || previewSummary.readyCount === 0 || busy}
                  onClick={onApplyConfirm}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Confirm and apply
                </button>
              </div>
            </div>
          </div>
        )}
      </section>}

      <div className={canImport ? "grid gap-8 xl:grid-cols-[1.45fr_0.75fr]" : "block"}>
        <section aria-labelledby="matters-title" className="min-w-0">
          <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Imported records</p>
              <h2 id="matters-title" className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em] text-foreground">Matter list</h2>
              <p className="mt-1 text-sm text-muted-foreground">AppColl matters available in this workspace.</p>
            </div>
            <span data-testid="text-matter-count" className="w-fit rounded-full border border-border bg-card px-3 py-1.5 font-mono text-xs font-semibold text-foreground">
              {visibleMatters.length} <span className="font-sans font-medium text-muted-foreground">of {matters.length}</span>
            </span>
          </div>

          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <label className="relative block flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                data-testid="input-search-matters"
                value={matterSearch}
                onChange={(event) => setMatterSearch(event.currentTarget.value)}
                placeholder="Search number, title, client…"
                aria-label="Search matters"
                className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/75 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <label className="relative flex min-w-[160px] items-center">
              <Filter className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
              <select
                data-testid="select-matter-status"
                aria-label="Filter by matter status"
                value={matterStatus}
                onChange={(event) => setMatterStatus(event.currentTarget.value)}
                className="h-10 w-full appearance-none rounded-lg border border-border bg-card pl-9 pr-9 text-sm text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              >
                <option value="all">All statuses</option>
                {matterStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted-foreground" />
            </label>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {isLoading ? (
              <div data-testid="status-matters-loading" className="space-y-3 p-5" aria-label="Loading matters">
                {[0, 1, 2, 3].map((item) => <div key={item} className="h-[58px] animate-pulse rounded-lg bg-muted/70" />)}
              </div>
            ) : error ? (
              <div data-testid="status-matters-error" role="alert" className="flex flex-col items-center px-6 py-12 text-center">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-rose-50 text-rose-700"><AlertCircle className="h-5 w-5" /></div>
                <p className="mt-3 text-sm font-semibold text-foreground">Matter list could not be loaded</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{error}</p>
                {onRetry && <button type="button" data-testid="button-retry-matters" onClick={onRetry} className="mt-4 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-primary hover:bg-muted">Try again</button>}
              </div>
            ) : matters.length === 0 ? (
              <div data-testid="empty-matters" className="flex flex-col items-center px-6 py-12 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-[#d6e0e4] bg-[#f2f6f6] text-primary"><FileSpreadsheet className="h-5 w-5" /></div>
                <h3 className="mt-4 font-display text-lg font-semibold text-foreground">No imported matters yet</h3>
                <p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">Choose an AppColl CSV above to preview the records that can be brought into this workspace.</p>
              </div>
            ) : visibleMatters.length === 0 ? (
              <div data-testid="empty-matter-search" className="px-6 py-12 text-center">
                <Search className="mx-auto h-5 w-5 text-muted-foreground/60" />
                <p className="mt-3 text-sm font-semibold text-foreground">No matching matters</p>
                <p className="mt-1 text-xs text-muted-foreground">Try another search term or status.</p>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="bg-[#f4f7f7] text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3.5">Matter</th>
                        <th className="px-4 py-3.5">Client</th>
                        <th className="px-4 py-3.5">AppColl ID</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Imported</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {visibleMatters.map((matter) => (
                        <tr key={matter.id} data-testid={`row-matter-${matter.id}`} className="transition-colors hover:bg-[#f9fbfa]">
                          <td className="max-w-[310px] px-5 py-4">
                            <p data-testid={`text-matter-number-${matter.id}`} className="font-mono text-[11px] font-semibold text-primary">{matter.matterNumber || '—'}</p>
                            <p data-testid={`text-matter-title-${matter.id}`} className="mt-1 truncate font-semibold text-foreground">{matter.title || 'Untitled matter'}</p>
                          </td>
                          <td className="max-w-[180px] truncate px-4 py-4 text-xs text-muted-foreground">{matter.clientName || '—'}</td>
                          <td className="px-4 py-4 font-mono text-xs text-muted-foreground">{matter.appCollId || '—'}</td>
                          <td className="px-4 py-4">
                            {matter.status ? <span data-testid={`status-matter-${matter.id}`} className="inline-flex rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-semibold text-foreground">{matter.status}</span> : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">{formatDate(matter.importedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="divide-y divide-border md:hidden">
                  {visibleMatters.map((matter) => (
                    <article key={matter.id} data-testid={`card-matter-${matter.id}`} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] font-semibold text-primary">{matter.matterNumber || '—'}</p>
                          <h3 className="mt-1 truncate text-sm font-semibold text-foreground">{matter.title || 'Untitled matter'}</h3>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{matter.clientName || 'Client not provided'}</p>
                        </div>
                        {matter.status && <span className="shrink-0 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[10px] font-semibold text-foreground">{matter.status}</span>}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                        <span>AppColl ID: <span className="font-mono text-foreground">{matter.appCollId || '—'}</span></span>
                        <span>Imported: {formatDate(matter.importedAt)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {canImport && <section aria-labelledby="history-title" className="min-w-0">
          <button
            type="button"
            data-testid="button-toggle-import-history"
            onClick={() => setHistoryOpen((open) => !open)}
            aria-expanded={historyOpen}
            className="mb-4 flex w-full items-center justify-between gap-3 text-left"
          >
            <span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Audit trail</span>
              <span id="history-title" className="mt-1 block font-display text-2xl font-semibold tracking-[-0.025em] text-foreground">Import history</span>
            </span>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
          </button>
          <p className="mb-4 text-sm text-muted-foreground">A record of CSV imports applied to this workspace.</p>

          {historyOpen && (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {isLoading ? (
                <div data-testid="status-history-loading" className="space-y-3 p-5">
                  {[0, 1, 2].map((item) => <div key={item} className="h-[78px] animate-pulse rounded-lg bg-muted/70" />)}
                </div>
              ) : error ? (
                <div data-testid="status-history-error" className="flex items-center gap-2.5 px-5 py-6 text-sm text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0" /> History is unavailable.
                </div>
              ) : importHistory.length === 0 ? (
                <div data-testid="empty-import-history" className="px-5 py-10 text-center">
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#f2f6f6] text-primary"><History className="h-5 w-5" /></div>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">No import activity</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Completed imports will appear here.</p>
                </div>
              ) : (
                <ol className="divide-y divide-border">
                  {importHistory.map((entry) => (
                    <li key={entry.id} data-testid={`item-import-history-${entry.id}`} className="px-4 py-4 sm:px-5">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f1f5f5] text-primary">
                          {entry.status === 'processing' ? <Loader2 className="h-4 w-4 animate-spin" /> : entry.status === 'failed' ? <AlertCircle className="h-4 w-4 text-rose-700" /> : <ArrowDownToLine className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p data-testid={`text-history-file-${entry.id}`} className="max-w-[210px] truncate text-sm font-semibold text-foreground">{entry.fileName}</p>
                            <span data-testid={`status-history-${entry.id}`} className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${statusClass(entry.status)}`}>
                              {entry.status}
                            </span>
                          </div>
                          <p data-testid={`text-history-date-${entry.id}`} className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Clock3 className="h-3 w-3" /> {formatDate(entry.importedAt)}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                            <span><strong className="font-mono text-foreground">{entry.importedCount}</strong> imported</span>
                            <span><strong className="font-mono text-foreground">{entry.skippedCount ?? 0}</strong> skipped</span>
                            {entry.errorCount !== undefined && <span><strong className="font-mono text-foreground">{entry.errorCount}</strong> issues</span>}
                            <span><strong className="font-mono text-foreground">{entry.totalRows}</strong> rows</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
          <p className="mt-3 flex items-center gap-1.5 px-1 text-[10px] leading-5 text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
            Import records are shown for traceability.
          </p>
        </section>}
      </div>
    </div>
  );
}

function SummaryPill({ label, value, tone = 'neutral', testId }: { label: string; value: number; tone?: 'neutral' | 'ready' | 'duplicate' | 'invalid'; testId: string }) {
  const toneClass = tone === 'ready'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : tone === 'duplicate'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'invalid'
        ? 'border-rose-200 bg-rose-50 text-rose-900'
        : 'border-border bg-card text-foreground';
  return (
    <div data-testid={testId} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 ${toneClass}`}>
      <span className="font-mono text-sm font-bold">{value}</span>
      <span className="text-[10px] font-semibold">{label}</span>
    </div>
  );
}
