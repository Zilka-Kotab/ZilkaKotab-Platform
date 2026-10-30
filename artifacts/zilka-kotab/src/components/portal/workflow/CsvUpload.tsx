import { useState } from 'react';
import { X } from 'lucide-react';
import { errorText } from '@/components/portal/StaffOnly';
import { useImportFirmCsv } from '@/lib/hooks-firm-operations';
import type { FirmCsvResult } from '@/lib/hooks-firm-operations';

export function CsvUpload({ canImport, onClose }: { canImport: boolean; onClose: () => void }) {
  const importCsv = useImportFirmCsv();
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<FirmCsvResult | null>(null);
  const [done, setDone] = useState<FirmCsvResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (f: File | undefined) => {
    setPreview(null); setDone(null); setError(null);
    if (!f) return;
    const text = await f.text();
    setFile({ name: f.name, text });
    try { setPreview(await importCsv.mutateAsync({ fileName: f.name, csvText: text, preview: true })); }
    catch (reason) { setError(errorText(reason, 'The CSV could not be previewed.')); }
  };
  const apply = async () => {
    if (!file) return;
    setError(null);
    try { const result = await importCsv.mutateAsync({ fileName: file.name, csvText: file.text, preview: false }); if (result.errors.length) { setPreview(result); } else { setDone(result); setPreview(null); } }
    catch (reason) { setError(errorText(reason, 'The import could not be applied.')); }
  };

  return (
    <section aria-label="Upload AppColl CSV" data-testid="panel-upload" className="mt-5 rounded-xl border border-primary/30 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="font-semibold">Upload AppColl CSV</h2><p className="text-xs text-muted-foreground">Preview first. Any row error blocks the whole import; existing rows are updated, new tasks added.</p></div>
        <button onClick={onClose} aria-label="Close upload" data-testid="button-close-upload" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
      </div>
      {!canImport ? <p className="mt-3 text-sm text-muted-foreground" data-testid="text-import-not-allowed">Your role cannot import CSV files. Ask an administrator to upload the latest AppColl export.</p> : <>
        <label className="mt-3 block text-xs font-medium">CSV file<input type="file" accept=".csv,text/csv" data-testid="input-csv-file" onChange={(e) => void pick(e.target.files?.[0])} className="mt-1 block text-sm" /></label>
        {importCsv.isPending && <p className="mt-3 text-sm text-muted-foreground" role="status">Checking file…</p>}
        {error && <p role="alert" className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
        {preview && <div className="mt-3" data-testid="panel-import-preview">
          <p className="text-sm"><b>{preview.added}</b> new, <b>{preview.updated}</b> updated{preview.errors.length > 0 && <>, <b className="text-rose-700">{preview.errors.length} errors</b></>}.</p>
          {preview.errors.length > 0 && <ul className="mt-2 max-h-40 list-disc overflow-auto rounded-md bg-rose-50 py-2 pl-6 pr-3 text-xs text-rose-800">{preview.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
          {preview.rows.length > 0 && <div className="mt-2 max-h-48 overflow-auto rounded-md border border-border text-xs"><table className="w-full"><thead className="bg-muted/50"><tr><th className="p-1.5 text-left">AppColl ID</th><th className="p-1.5 text-left">Client</th><th className="p-1.5 text-left">Matter</th><th className="p-1.5 text-left">Task</th></tr></thead><tbody>{preview.rows.slice(0, 200).map((r) => <tr key={r.externalId} className="border-t border-border"><td className="p-1.5 font-mono">{r.externalId}</td><td className="p-1.5">{r.client}</td><td className="p-1.5">{r.matter}</td><td className="p-1.5">{r.title}</td></tr>)}</tbody></table></div>}
          <button onClick={() => void apply()} disabled={preview.errors.length > 0 || importCsv.isPending} data-testid="button-apply-import" className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{preview.errors.length > 0 ? 'Fix errors to import' : 'Apply import'}</button>
        </div>}
        {done && <p role="status" data-testid="status-import-done" className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Imported: {done.added} added, {done.updated} updated.</p>}
      </>}
    </section>
  );
}
