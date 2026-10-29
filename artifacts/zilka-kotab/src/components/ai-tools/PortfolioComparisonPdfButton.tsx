import { ExportPdfButton } from './ExportPdfButton';
import { createPortfolioComparisonBlob } from './portfolio-comparison-pdf';
import type { ComparisonReportSide } from './portfolio-comparison-report-data';

export function PortfolioComparisonPdfButton({ first, second }: { first: ComparisonReportSide; second: ComparisonReportSide }) {
  const download = async () => {
    const blob = await createPortfolioComparisonBlob(first, second);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const name = `${first.portfolio.companyName}-vs-${second.portfolio.companyName}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    link.download = `${name || 'patent-portfolios'}-comparison.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <ExportPdfButton onDownload={download} label="Download comparison PDF" />;
}
