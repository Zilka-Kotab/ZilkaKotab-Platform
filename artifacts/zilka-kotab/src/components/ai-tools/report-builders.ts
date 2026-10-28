import type {
  PublicExaminerAnalysis,
  PublicPortfolioAdvancedAnalysis,
  PublicPortfolioAnalysis,
} from '@workspace/api-client-react';
import type { PdfReport, PdfSection } from './pdf-export';

const n = (value: number | null | undefined) => value == null ? 'Unavailable' : value.toLocaleString('en-US');
const pct = (value: number | null | undefined) => value == null ? 'Unavailable' : `${value.toFixed(1)}%`;
const date = (value: string | null | undefined) => value || 'Not reported';

export function portfolioPdfReport(
  portfolio: PublicPortfolioAnalysis,
  advanced?: PublicPortfolioAdvancedAnalysis,
): PdfReport {
  const sections: PdfSection[] = [
    {
      type: 'metrics',
      title: 'Portfolio Snapshot',
      items: [
        { label: 'Granted · status unverified', value: n(portfolio.identifiedGrantedPatents) },
        { label: 'Identified pending', value: n(portfolio.identifiedPendingApplications) },
        { label: 'Expired / inactive identified', value: n(portfolio.expiredInactivePatents) },
        { label: 'Grants in last 12 months', value: n(portfolio.recentGrantCount) },
      ],
      note: `Matched applicant names: ${portfolio.matchedApplicantNames.join('; ') || 'None'} · “Granted” does not confirm current in-force status.`,
    },
    {
      type: 'bars',
      title: 'Filing Trend · Last Five Years',
      items: portfolio.filingTrends.map((item) => ({ label: String(item.year), value: item.count, display: n(item.count) })),
      note: 'Recent filing years may be undercounted because many applications publish about 18 months after filing.',
    },
    {
      type: 'table',
      title: 'Leading Technology Areas and CPC Codes',
      columns: ['Technology area', 'CPC classification', 'Occurrences'],
      rows: portfolio.topTechnologyAreas.flatMap((area) => area.classifications.length
        ? area.classifications.map((classification) => [area.label, classification.code, n(classification.count)])
        : [[area.label, '—', n(area.count)]]),
      note: 'Classification counts are occurrences, not unique patents. One application may appear in multiple categories.',
    },
    {
      type: 'table',
      title: 'Recent Applications',
      columns: ['Application', 'Title', 'Filing date', 'Publication', 'USPTO status'],
      rows: portfolio.recentApplications.map((item) => [item.applicationNumber, item.title, date(item.filingDate), item.publicationNumber || 'Not published', item.status]),
    },
    {
      type: 'table',
      title: 'Recent Patent Grants · Last 12 Months',
      columns: ['Patent', 'Title', 'Grant date', 'Technology area'],
      rows: portfolio.recentGrants.map((item) => [item.patentNumber, item.title, date(item.grantDate), item.technologyArea]),
    },
  ];

  if (advanced) {
    const e = advanced.prosecutionEfficiency;
    const p = advanced.portfolioInsights;
    sections.push(
      {
        type: 'metrics',
        title: 'Prosecution Efficiency',
        items: [
          { label: 'Avg. substantive actions per granted case', value: e.averageOfficeActionsPerGrantedPatent?.toFixed(2) ?? 'Unavailable', detail: `Granted cases with history n=${n(e.officeActionDenominator)}` },
          { label: 'RCE rate', value: pct(e.rceRate), detail: `${n(e.rceApplications)} of ${n(e.rceDenominator)} with histories` },
          { label: 'Documented interview rate', value: pct(e.examinerInterviewRate), detail: `${n(e.interviewApplications)} of ${n(e.interviewDenominator)} with histories` },
          { label: 'Allowed with ≤2 actions', value: pct(e.allowedWithTwoOrFewerActionsRate), detail: `${n(e.allowedWithTwoOrFewerActions)} of ${n(e.allowedWithHistory)} allowed cases with histories` },
        ],
        note: `${advanced.coverage.note} Filing-date range: ${e.filingDateStart || 'Unavailable'} to ${e.filingDateEnd || 'Unavailable'}.`,
      },
      {
        type: 'table',
        title: 'Top USPTO Art Units',
        columns: ['Art Unit', 'Applications', 'Share of portfolio'],
        rows: advanced.topArtUnits.map((item) => [item.artUnit, n(item.applicationCount), pct(item.portfolioSharePercent)]),
      },
      {
        type: 'metrics',
        title: 'Portfolio Prosecution Insights',
        items: [
          { label: 'Overall allowance rate', value: pct(p.overallAllowanceRate), detail: `${n(p.knownFinalOutcomes)} known allowed/granted or abandoned outcomes` },
          { label: 'Average time to grant', value: p.averageTimeToGrantMonths == null ? 'Unavailable' : `${(p.averageTimeToGrantMonths / 12).toFixed(1)} years`, detail: `Valid dates n=${n(p.grantDurationSampleSize)}` },
          { label: 'Average pending age', value: p.averagePendingAgeYears == null ? 'Unavailable' : `${p.averagePendingAgeYears.toFixed(1)} years`, detail: `Pending sample n=${n(p.pendingAgeSampleSize)}` },
        ],
      },
      {
        type: 'table',
        title: advanced.outsideCounsel.label,
        columns: ['Firm or attorney', 'Applications', 'Share of analyzed sample'],
        rows: advanced.outsideCounsel.entries.map((item) => [item.name, n(item.applicationCount), pct(item.portfolioSharePercent)]),
        note: advanced.outsideCounsel.note,
      },
      {
        type: 'table',
        title: 'Pending Applications by Age',
        columns: ['Age', 'Applications', 'Share'],
        rows: p.pendingAgeBuckets.map((item) => [item.label, n(item.count), pct(item.sharePercent)]),
        note: `Age sample n=${n(p.pendingAgeSampleSize)}.`,
      },
      {
        type: 'table',
        title: 'Top Examiners in Retrieved Sample',
        columns: ['Examiner', 'Art Unit', 'Applications'],
        rows: p.topExaminers.map((item) => [item.examinerName, item.artUnit || 'Not reported', n(item.applicationCount)]),
        note: `Counts are from the retrieved application sample (n=${n(p.examinerSampleSize)}).`,
      },
    );
  } else {
    sections.push({
      type: 'text',
      title: 'Advanced Metrics',
      paragraphs: ['Advanced prosecution-history metrics were not available at export time. The portfolio snapshot and its aggregate data are included above.'],
    });
  }

  sections.push({
    type: 'text',
    title: 'Source and Coverage',
    paragraphs: [
      `${portfolio.coverage.source} · Retrieved ${portfolio.coverage.retrievedAt}. ${portfolio.coverage.recordsAnalyzed.toLocaleString('en-US')} records analyzed of ${portfolio.coverage.totalMatchesReported.toLocaleString('en-US')} reported matches.`,
      portfolio.coverage.note,
      advanced ? `${advanced.coverage.source} · ${advanced.coverage.note}` : '',
      'USPTO prosecution status does not establish maintenance-fee payment, current ownership, expiration, or enforceability. This report is informational and is not a legal opinion.',
    ].filter(Boolean),
  });

  return {
    filename: `${portfolio.companyName}-patent-portfolio`,
    title: 'Patent Portfolio Analysis',
    subtitle: portfolio.companyName,
    retrievedAt: portfolio.coverage.retrievedAt,
    sections,
  };
}

export function examinerPdfReport(data: PublicExaminerAnalysis): PdfReport {
  const title = data.searchType === 'art-unit' ? `Art Unit ${data.artUnit ?? data.query}` : (data.examinerName ?? data.query);
  const sections: PdfSection[] = [
    {
      type: 'metrics',
      title: 'Examiner / Art Unit Summary',
      items: [
        { label: 'Identified applications', value: n(data.identifiedApplications) },
        { label: 'Disposed applications', value: n(data.disposedApplications), detail: 'Allowed plus abandoned' },
        { label: 'Allowance rate', value: pct(data.estimatedAllowanceRate) },
        { label: 'Average prosecution duration', value: data.averageProsecutionDurationMonths == null ? 'Unavailable' : `${data.averageProsecutionDurationMonths.toFixed(1)} months` },
      ],
      note: data.applicationNumberContext ? `Profile opened from application ${data.applicationNumberContext}; current examiner only.` : undefined,
    },
  ];

  if (data.topExaminers.length) {
    sections.push({
      type: 'table',
      title: 'Most Active / Matching Examiners',
      columns: ['Examiner', 'Applications'],
      rows: data.topExaminers.map((item) => [item.examinerName, n(item.count)]),
    });
  }
  if (data.allowanceBenchmarks) {
    const b = data.allowanceBenchmarks;
    sections.push({
      type: 'table',
      title: 'Allowance Benchmarks',
      columns: ['Group', 'Allowance rate', 'Applications with final outcomes'],
      rows: [
        ...(data.searchType === 'examiner' ? [['Examiner', pct(b.examinerAllowanceRate), n(data.disposedApplications)]] : []),
        [`Art Unit ${b.artUnit || '—'}`, pct(b.artUnitAllowanceRate), n(b.artUnitDisposedApplications)],
        [`Technology Center ${b.technologyCenter || '—'}`, pct(b.technologyCenterAllowanceRate), n(b.technologyCenterDisposedApplications)],
      ],
      note: b.calculationNote,
    });
  }
  if (data.officeActionAnalytics) {
    const a = data.officeActionAnalytics;
    sections.push({
      type: 'metrics',
      title: 'Office Action Behavior',
      items: [
        { label: 'Applications with office action', value: n(a.applicationsWithOfficeAction) },
        { label: 'Applications with final rejection', value: n(a.applicationsWithFinalRejection) },
        { label: 'Applications with restriction', value: n(a.applicationsWithRestriction) },
        { label: 'Average non-final actions / application', value: a.averageNonFinalActionsPerApplication.toFixed(2) },
        { label: 'Average final actions / application', value: a.averageFinalActionsPerApplication.toFixed(2) },
        { label: 'Median filing to first action', value: a.medianMonthsFilingToFirstAction == null ? 'Unavailable' : `${a.medianMonthsFilingToFirstAction.toFixed(1)} months` },
      ],
      note: `Event history sample n=${n(a.applicationsWithEventData)}. Event metrics are not outcome rates.`,
    });
  }
  if (data.interviewAnalytics) {
    const i = data.interviewAnalytics;
    const withDisposed = i.interviewSummaryAllowed + i.interviewSummaryAbandoned;
    const withoutDisposed = i.noSummaryAllowed + i.noSummaryAbandoned;
    const withRate = withDisposed ? (i.interviewSummaryAllowed / withDisposed) * 100 : null;
    const withoutRate = withoutDisposed ? (i.noSummaryAllowed / withoutDisposed) * 100 : null;
    sections.push({
      type: 'table',
      title: 'Examiner Interview Records',
      columns: ['Group', 'Applications', 'Allowed', 'Abandoned', 'Other / unresolved', 'Allowance rate'],
      rows: [
        ['Interview summary found', n(i.applicationsWithInterviewSummary), n(i.interviewSummaryAllowed), n(i.interviewSummaryAbandoned), n(i.interviewSummaryOther), pct(withRate)],
        ['No summary located', n(i.applicationsWithoutInterviewSummary), n(i.noSummaryAllowed), n(i.noSummaryAbandoned), n(i.noSummaryOther), pct(withoutRate)],
      ],
      note: 'This is a historical association, not evidence that an interview caused an allowance or that an examiner prefers interviews. No summary located does not prove no interview occurred.',
    });
  }
  sections.push({
    type: 'text',
    title: 'Source and Calculation Notes',
    paragraphs: [
      `${data.coverage.source} · Retrieved ${data.coverage.retrievedAt}. ${n(data.coverage.recordsAnalyzed)} records analyzed of ${n(data.coverage.totalMatchesReported)} reported matches.`,
      data.coverage.note,
      data.calculationNote,
      'Public-record analysis only; not a legal opinion.',
    ],
  });
  return { filename: `${title}-examiner-report`, title: 'Patent Examiner Intelligence', subtitle: title, retrievedAt: data.coverage.retrievedAt, sections };
}
