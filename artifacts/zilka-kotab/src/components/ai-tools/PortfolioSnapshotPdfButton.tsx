import type { PublicPortfolioAnalysis, PublicPortfolioAdvancedAnalysis } from '@workspace/api-client-react';
import handoutFooter from '../../assets/portfolio-handout-footer.png';
import { ExportPdfButton } from './ExportPdfButton';
import { createPortfolioSnapshotBlob } from './portfolio-snapshot-pdf';

export function PortfolioSnapshotPdfButton({ portfolio, advanced }: {
  portfolio: PublicPortfolioAnalysis;
  advanced?: PublicPortfolioAdvancedAnalysis;
}) {
  const download = async () => {
    const response = await fetch(handoutFooter);
    if (!response.ok) throw new Error('The firm branding image could not be loaded. Please try again.');
    const imageBlob = await response.blob();
    const footerImage = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('The firm branding image could not be read.'));
      reader.readAsDataURL(imageBlob);
    });
    const blob = await createPortfolioSnapshotBlob(portfolio, advanced, footerImage);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${portfolio.companyName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'patent-portfolio'}-snapshot.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <ExportPdfButton onDownload={download} label="Download snapshot PDF" />;
}
