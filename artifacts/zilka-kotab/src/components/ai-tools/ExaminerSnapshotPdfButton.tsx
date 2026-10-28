import type { PublicExaminerAnalysis } from '@workspace/api-client-react';
import { ExportPdfButton } from './ExportPdfButton';
import { createExaminerSnapshotBlob, examinerSnapshotTitle } from './examiner-snapshot-pdf';

export function ExaminerSnapshotPdfButton({ data }: { data: PublicExaminerAnalysis }) {
  const download = async () => {
    const blob = await createExaminerSnapshotBlob(data);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const slug = examinerSnapshotTitle(data).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    link.download = `${slug || 'examiner'}-intelligence-snapshot.pdf`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <ExportPdfButton onDownload={download} label="Download snapshot PDF" />;
}
