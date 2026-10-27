import { useState } from "react";
import InternalWorkflowWorkspace from "./InternalWorkflowWorkspace";
import { useApplyInternalWorkflowImport, useInternalWorkflow, usePortalAccess, usePreviewInternalWorkflowImport } from "@/lib/hooks-portal";
import type { InternalWorkflowPreview } from "@/lib/api-portal";
import InternalWorkflowTasks from "./InternalWorkflowTasks";

export default function InternalWorkflow() {
  const access = usePortalAccess();
  const workspace = useInternalWorkflow();
  const previewImport = usePreviewInternalWorkflowImport();
  const applyImport = useApplyInternalWorkflowImport();
  const [preview, setPreview] = useState<InternalWorkflowPreview | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onCsvFileSelected = async (file: File) => {
    setFileName(file.name);
    setPreview(null);
    setError(null);
    try {
      const csvText = await file.text();
      setPreview(await previewImport.mutateAsync({ fileName: file.name, csvText }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The CSV could not be previewed.");
    }
  };

  const onApplyConfirm = async () => {
    if (!preview) return;
    try {
      await applyImport.mutateAsync(preview.preview.publicId);
      setPreview(null);
      setFileName(null);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The import could not be applied.");
    }
  };

  const matters = workspace.data?.matters ?? [];
  const history = workspace.data?.imports ?? [];
  const canImport = access.data?.user?.role === "ADMIN";
  const previewSummary = preview ? {
    totalRows: preview.preview.summary.total,
    readyCount: preview.preview.summary.added + preview.preview.summary.changed,
    duplicateCount: preview.preview.summary.unchanged + preview.rows.filter((row) => row.disposition === "duplicate").length,
    invalidCount: preview.preview.summary.invalid,
    rows: preview.rows.map((row) => ({ ...row, disposition: row.disposition === "ready" ? "ready" : row.disposition })),
  } : null;

  return <>
    <InternalWorkflowTasks matters={matters} />
    <InternalWorkflowWorkspace
    canImport={canImport}
    matters={matters.map((matter) => ({
      id: matter.publicId,
      matterNumber: matter.docketId || matter.appCollMatterId,
      title: matter.title,
      clientName: matter.client,
      status: matter.status,
      appCollId: matter.appCollMatterId,
      importedAt: matter.lastImportedAt,
    }))}
    importHistory={history.map((item) => ({
      id: item.publicId,
      fileName: item.fileName,
      importedAt: item.appliedAt ?? item.createdAt,
      status: item.status === "APPLIED" ? "completed" : item.status === "FAILED" ? "failed" : "review",
      totalRows: item.summary.total ?? 0,
      importedCount: item.status === "APPLIED" ? (item.summary.added ?? 0) + (item.summary.changed ?? 0) : 0,
      skippedCount: (item.summary.unchanged ?? 0) + (item.summary.missing ?? 0),
      errorCount: item.exceptions.length,
    }))}
    isLoading={workspace.isLoading}
    error={error ?? (workspace.error instanceof Error ? workspace.error.message : null)}
    uploadState={{ fileName, isPreviewing: previewImport.isPending, isUploading: false, error }}
    previewSummary={previewSummary}
    onCsvFileSelected={onCsvFileSelected}
    onApplyConfirm={onApplyConfirm}
    onRetry={() => { void workspace.refetch(); }}
    onClearPreview={() => { setPreview(null); setFileName(null); setError(null); }}
    />
  </>;
}
