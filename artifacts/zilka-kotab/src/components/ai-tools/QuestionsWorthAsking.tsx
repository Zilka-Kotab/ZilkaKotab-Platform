import { Link } from 'wouter';
import { EXAMINER_QUESTIONS, PORTFOLIO_QUESTIONS } from './snapshot-questions';

export function QuestionsWorthAsking({ tool }: { tool: 'examiner' | 'portfolio' }) {
  const questions = tool === 'examiner' ? EXAMINER_QUESTIONS : PORTFOLIO_QUESTIONS;
  return (
    <section className="border-t-2 border-[hsl(var(--zk-brass))] bg-white p-5 sm:p-7" data-testid={`questions-${tool}`}>
      <h4 className="zk-h4">Questions Worth Asking</h4>
      <ol className="mt-5 space-y-4">
        {questions.map((question, i) => (
          <li key={question} className="flex gap-3 text-sm leading-relaxed">
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--zk-brass))] text-xs font-semibold text-primary">{i + 1}</span>
            <span>{question}</span>
          </li>
        ))}
      </ol>
      <p className="mt-6 border-t pt-5 text-sm font-medium">
        Want to discuss more?{' '}
        <Link href="/contact" className="text-primary underline underline-offset-4 hover:no-underline">Contact us</Link>.
      </p>
    </section>
  );
}
