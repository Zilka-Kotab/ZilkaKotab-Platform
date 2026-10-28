import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, Send } from 'lucide-react';
import type { PublicToolInquiryInputTool } from '@workspace/api-client-react';
import { submitContactMessage } from '@/lib/submitContactMessage';

const empty = { name: '', company: '', email: '', message: '', website: '' };

export function ToolInquiry({ tool }: { tool: PublicToolInquiryInputTool }) {
  const [f, setF] = useState(empty);
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const errs = {
    name: f.name.trim().length < 2 ? 'Please enter your name.' : '',
    company: f.company.trim().length < 2 ? 'Please enter your company.' : '',
    email: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim()) ? 'Please enter a valid work email.' : '',
    consent: !consent ? 'Consent is required to contact you.' : '',
  };
  const ok = !Object.values(errs).some(Boolean);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!ok || isPending) return;
    setIsPending(true);
    setSubmitError('');
    const toolName = tool === 'portfolio-analyzer' ? 'Patent Portfolio Analyzer' : 'Patent Examiner Intelligence';
    const message = [
      `Company: ${f.company.trim()}`,
      `Tool requested: ${toolName}`,
      f.message.trim() ? `Message: ${f.message.trim()}` : 'No additional message provided.',
    ].join('\n\n');
    try {
      await submitContactMessage({
        name: f.name.trim(),
        email: f.email.trim(),
        subject: `AI Tools inquiry: ${toolName}`,
        message,
        consent,
        website: f.website,
      });
      setIsSuccess(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'We could not send your message. Please try again.');
    } finally {
      setIsPending(false);
    }
  };
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const label = tool === 'portfolio-analyzer' ? 'portfolio' : 'prosecution';

  return (
    <div className="zk-inquiry">
      <AnimatePresence mode="wait">
        {isSuccess ? (
          <motion.div key="ok" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="py-6 text-center" data-testid="status-inquiry-success">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-6 w-6" /></div>
            <h4 className="mt-4 font-display text-xl font-semibold">Request received</h4>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Your request was sent to Zilka-Kotab PC. No attorney-client relationship is formed until confirmed in writing.</p>
            <button className="zk-btn-ghost mt-5" onClick={() => { setIsSuccess(false); setSubmitError(''); setF(empty); setConsent(false); setTouched(false); }} data-testid="button-inquiry-reset">Send another</button>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={submit} noValidate exit={{ opacity: 0 }} className="space-y-4">
            <div>
              <div className="zk-eyebrow">Optional</div>
              <h4 className="mt-1 font-display text-xl font-semibold">Discuss a full {label} review</h4>
              <p className="mt-1 text-sm text-muted-foreground">Your results stay visible whether or not you write to us. Attorneys can reconcile name variants, assignments, and maintenance status that public data cannot.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id={`${tool}-name`} label="Name" value={f.name} onChange={set('name')} err={touched ? errs.name : ''} testId="input-inquiry-name" autoComplete="name" />
              <Field id={`${tool}-company`} label="Company" value={f.company} onChange={set('company')} err={touched ? errs.company : ''} testId="input-inquiry-company" autoComplete="organization" />
            </div>
            <Field id={`${tool}-email`} label="Work email" type="email" value={f.email} onChange={set('email')} err={touched ? errs.email : ''} testId="input-inquiry-email" autoComplete="email" />
            <div>
              <label htmlFor={`${tool}-msg`} className="zk-flabel">Message <span className="text-muted-foreground font-normal">(optional, no confidential details)</span></label>
              <textarea id={`${tool}-msg`} rows={3} maxLength={2000} value={f.message} onChange={set('message')} className="zk-field resize-none" data-testid="input-inquiry-message" />
            </div>
            <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
              <label htmlFor={`${tool}-website`}>Website</label>
              <input id={`${tool}-website`} tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} />
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-muted-foreground">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" data-testid="checkbox-inquiry-consent" />
              <span>I agree that Zilka-Kotab PC may use this information to respond to my inquiry, as described in the <Link href="/privacy-policy" className="text-primary underline underline-offset-2">Privacy Policy</Link>. Submitting this form does not create an attorney-client relationship. Please do not include confidential information.</span>
            </label>
            {touched && errs.consent && <p className="text-xs text-[hsl(var(--zk-oxblood))]">{errs.consent}</p>}
            {submitError && <p role="alert" className="flex items-start gap-2 text-sm text-[hsl(var(--zk-oxblood))]" data-testid="error-inquiry"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{submitError}</p>}
            <button type="submit" disabled={isPending} className="zk-btn-primary w-full justify-center" data-testid="button-inquiry-submit">
              {isPending ? 'Sending' : 'Request a conversation'} <Send className="h-4 w-4" />
            </button>
            {isPending && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">Contacting our mail server. This can take up to 35 seconds. Please keep this page open.</p>}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ id, label, err, testId, ...rest }: { id: string; label: string; err: string; testId: string; value: string; onChange: (e: { target: { value: string } }) => void; type?: string; autoComplete?: string }) {
  return (
    <div>
      <label htmlFor={id} className="zk-flabel">{label}</label>
      <input id={id} {...rest} aria-invalid={!!err} className={`zk-field ${err ? 'border-[hsl(var(--zk-oxblood))]' : ''}`} data-testid={testId} />
      {err && <p className="mt-1 text-xs text-[hsl(var(--zk-oxblood))]">{err}</p>}
    </div>
  );
}
