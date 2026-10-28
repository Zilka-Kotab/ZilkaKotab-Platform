import { Link } from 'wouter';
import { EXAMINER_QUESTIONS, PORTFOLIO_QUESTIONS } from './snapshot-questions';

export function QuestionsWorthAsking({ tool }: { tool: 'examiner' | 'portfolio' }) {
  const questions = tool === 'examiner' ? EXAMINER_QUESTIONS : PORTFOLIO_QUESTIONS;
  return (
    <section className="overflow-hidden border-t-2 border-[hsl(var(--zk-brass))] bg-white" data-testid={`questions-${tool}`}>
      <div className="p-5 sm:p-7">
      <h4 className="zk-h4">Questions Worth Asking</h4>
      <ol className="mt-5 space-y-4">
        {questions.map((question, i) => (
          <li key={question} className="flex gap-3 text-sm leading-relaxed">
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--zk-brass))] text-xs font-semibold text-primary">{i + 1}</span>
            <span>{question}</span>
          </li>
        ))}
      </ol>
      </div>
    </section>
  );
}

export function QuestionsContactCTA() {
  return (
      <section className="relative isolate overflow-hidden border-y-4 border-primary bg-secondary px-6 py-16 text-center text-secondary-foreground sm:px-10 sm:py-20">
        <img
          src={`${import.meta.env.BASE_URL}images/hero-new.jpg`}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-5"
        />
        <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 -z-10 h-80 w-80 translate-x-1/3 rounded-full bg-primary opacity-20 blur-3xl" />
        <h4 className="font-display text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Want to discuss more?</h4>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-secondary-foreground/80 sm:text-lg">
          Let’s discuss what these insights mean for your patent strategy.
        </p>
        <Link href="/contact" className="mt-8 inline-flex min-h-14 items-center justify-center rounded-sm bg-primary px-10 py-3 text-lg font-semibold text-white shadow-xl transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-95">
          Contact us
        </Link>
      </section>
  );
}
