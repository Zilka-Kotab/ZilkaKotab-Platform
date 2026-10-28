import type { PublicPortfolioAnalysis, PublicPortfolioAdvancedAnalysis } from '@workspace/api-client-react';
import { ExportPdfButton } from './ExportPdfButton';
import { createPortfolioSnapshotBlob } from './portfolio-snapshot-pdf';

export function PortfolioSnapshotPdfButton({ portfolio, advanced }: {
  portfolio: PublicPortfolioAnalysis;
  advanced?: PublicPortfolioAdvancedAnalysis;
}) {
  return <ExportPdfButton onDownload={() => downloadPortfolioSnapshot(portfolio, advanced)} label="Download snapshot PDF" />;
}

export async function downloadPortfolioSnapshot(portfolio: PublicPortfolioAnalysis, advanced?: PublicPortfolioAdvancedAnalysis) {
  {
    const blob = await createPortfolioSnapshotBlob(portfolio, advanced);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${portfolio.companyName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'patent-portfolio'}-snapshot.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
