import type { ComponentType } from 'react';
import { PortfolioAnalyzer } from './PortfolioAnalyzer';
import { ExaminerIntelligence } from './ExaminerIntelligence';
import { PortfolioComparisonTool } from './PortfolioComparisonTool';

export type AiToolDefinition = {
  key: string;
  name: string;
  description: string;
  actionLabel: string;
  reviewLabel: string;
  component: ComponentType;
};

// Add a tool here to register its card, panel, and inquiry context together.
export const aiTools = [
  {
    key: 'portfolio-analyzer',
    name: 'Patent Portfolio Analyzer',
    description: 'What a company has filed, what has issued, and where it is investing.',
    actionLabel: 'Open portfolio tool',
    reviewLabel: 'portfolio',
    component: PortfolioAnalyzer,
  },
  {
    key: 'portfolio-comparison',
    name: 'Patent Portfolio Comparison',
    description: 'Compare two companies’ portfolios, filing trends, technology areas, and prosecution efficiency.',
    actionLabel: 'Open comparison tool',
    reviewLabel: 'portfolio comparison',
    component: PortfolioComparisonTool,
  },
  {
    key: 'examiner-intelligence',
    name: 'Patent Examiner Intelligence',
    description: 'How an examiner or art unit has disposed of applications.',
    actionLabel: 'Open examiner tool',
    reviewLabel: 'prosecution',
    component: ExaminerIntelligence,
  },
] as const satisfies readonly AiToolDefinition[];

export type AiToolKey = (typeof aiTools)[number]['key'];
