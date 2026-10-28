import { useState } from 'react';
import { Download } from 'lucide-react';
import { downloadPdfReport, type PdfReport } from './pdf-export';

export function ExportPdfButton({ report, label = 'Download PDF' }: { report: PdfReport; label?: string }) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setError('');
    try {
      await downloadPdfReport(report);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The PDF could not be created.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button type="button" onClick={download} disabled={isExporting} className="zk-btn-secondary inline-flex items-center gap-2 disabled:cursor-wait disabled:opacity-60" data-testid="button-export-pdf">
        <Download className="h-4 w-4" />
        {isExporting ? 'Preparing PDF…' : label}
      </button>
      {error && <span role="alert" className="max-w-xs text-right text-xs text-destructive">{error}</span>}
    </div>
  );
}
