import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { ToolInquiry } from '@/components/ai-tools/ToolInquiry';
import { aiTools, type AiToolKey } from '@/components/ai-tools/tool-catalog';

export default function AiTools() {
  const [active, setActive] = useState<AiToolKey>(aiTools[0].key);
  const current = aiTools.find((t) => t.key === active)!;
  const ActiveTool = current.component;

  return (
    <>
      <SEO title="AI Tools" url="/ai-tools"
        description="Free public tools from Zilka-Kotab PC: analyze a company's U.S. patent portfolio or an examiner's allowance history using USPTO data, with sources and limits shown." />
      <main className="zk-tools flex-1 w-full">
        <section className="relative overflow-hidden">
          <div className="zk-grid-bg" aria-hidden="true" />
          <div className="container relative mx-auto px-4 pt-10 pb-4 md:pt-14">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="max-w-4xl">
              <div className="zk-eyebrow">Zilka-Kotab PC / Public patent intelligence</div>
              <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl text-balance">
                Smarter Patent Intelligence. <span className="text-primary">Better Decisions.</span>
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted-foreground">
                Access powerful, AI-enhanced patent analytics developed by experienced patent attorneys. Explore USPTO data, uncover portfolio trends, evaluate examiner behavior, and make more informed IP decisions—all through our complimentary patent intelligence tools.
              </p>
            </motion.div>
            <motion.dl initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }} className="mt-6 grid max-w-3xl grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div><dt className="zk-dt">Data source</dt><dd className="mt-1">USPTO public records</dd></div>
              <div><dt className="zk-dt">Access</dt><dd className="mt-1">Free, no account required</dd></div>
              <div><dt className="zk-dt">Results</dt><dd className="mt-1">Never gated behind a form</dd></div>
            </motion.dl>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-12 pt-4 md:pb-16">
          <h2 className="font-display text-2xl font-semibold">Choose a free tool</h2>
          <div role="tablist" aria-label="Patent tools" className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-4">
            {aiTools.map((t, index) => {
              const on = t.key === active;
              return (
                <button type="button" key={t.key} role="tab" aria-selected={on} aria-controls={`panel-${t.key}`} id={`tab-${t.key}`}
                  onClick={() => setActive(t.key)} className={`zk-tab ${on ? 'zk-tab--on' : ''}`} data-testid={`tab-${t.key}`}>
                  <span className="font-mono text-xs text-[hsl(var(--zk-brass))]">{String(index + 1).padStart(2, '0')}</span>
                  <span className="mt-2 block font-display text-xl font-semibold">{t.name}</span>
                  <span className={`mt-2 block flex-1 text-sm ${on ? 'text-primary-foreground/85' : 'text-muted-foreground'}`}>{t.description}</span>
                  <span className={`mt-5 inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-sm px-4 py-2 text-sm font-semibold ${on ? 'bg-white text-primary' : 'bg-primary text-primary-foreground'}`}>
                    {on ? <><Check className="h-4 w-4 shrink-0" /> Selected — use form below</> : <>{t.actionLabel} <ArrowRight className="h-4 w-4 shrink-0" /></>}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
            <AnimatePresence mode="wait">
              <motion.div key={active} id={`panel-${active}`} role="tabpanel" aria-labelledby={`tab-${active}`}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="min-w-0">
                <h2 className="sr-only">{current.name}</h2>
                {/* Switching tools resets that tool's result view. */}
                <ActiveTool />
              </motion.div>
            </AnimatePresence>
            <div className="lg:sticky lg:top-28 lg:self-start space-y-6">
              <ToolInquiry key={active} tool={current} />
              <div className="text-xs leading-relaxed text-muted-foreground border-l-2 border-[hsl(var(--zk-brass))] pl-4">
                These tools provide general information from public records and are not legal advice. Public USPTO data can lag, omit assignments, and does not reflect maintenance-fee or litigation status.
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
