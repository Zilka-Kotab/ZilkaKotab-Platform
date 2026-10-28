import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';
import { AlertCircle, Check, Clock, MapPin, Phone, Send } from 'lucide-react';

const emptyContactForm = { name: '', email: '', phone: '', subject: '', message: '', website: '' };

const contactItems = [
  {
    icon: MapPin,
    label: 'Headquarters',
    content: <>1155 North 1st St, Suite 104<br />San Jose, CA 95112</>,
  },
  {
    icon: Phone,
    label: 'Phone',
    content: <a href="tel:408-971-2573" className="hover:text-primary transition-colors">(408) 971-2573</a>,
  },
  {
    icon: Clock,
    label: 'Office Hours',
    content: <>Monday – Friday<br />9:00 AM – 6:00 PM PT</>,
  },
];

export default function Contact() {
  return (
    <>
      <SEO
        title="Contact Us"
        description="Contact Zilka-Kotab PC in San Jose, California. Reach out to schedule a confidential consultation for patent strategy and intellectual property protection."
        url="/contact"
      />

      <main className="flex-1 w-full pt-32 pb-24">
        {/* Page Header */}
        <section className="container mx-auto px-4 mb-16">
          <FadeIn>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground mb-6">Contact Us</h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed">
              Reach out to schedule a confidential consultation on your intellectual property needs.
            </p>
          </FadeIn>
        </section>

        <section className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-12 items-stretch">

            {/* Left: contact form */}
            <FadeIn delay={0.15}>
              <ContactForm />
            </FadeIn>

            {/* Right: contact info + map */}
            <div className="space-y-10">
              <FadeIn delay={0.1}>
                <ul className="space-y-7">
                  {contactItems.map(({ icon: Icon, label, content }) => (
                    <li key={label} className="flex items-start gap-5">
                      <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="font-display font-semibold text-foreground mb-0.5">{label}</p>
                        <p className="text-muted-foreground leading-relaxed">{content}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </FadeIn>

              <FadeIn delay={0.2}>
                <div className="rounded-2xl overflow-hidden shadow-md border border-border h-[260px]">
                  <iframe
                    title="Map of Zilka-Kotab PC"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3171.306079978713!2d-121.90807768469463!3d37.35914597983697!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x808fccf0e2101211%3A0xcda6dc79e51c86fc!2s1155%20N%201st%20St%20%23104%2C%20San%20Jose%2C%20CA%2095112!5e0!3m2!1sen!2sus!4v1684346857121!5m2!1sen!2sus"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </FadeIn>
            </div>

          </div>
        </section>
      </main>
    </>
  );
}

function ContactForm() {
  const [form, setForm] = useState(emptyContactForm);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');
  const update = (field: keyof typeof emptyContactForm) => (event: { target: { value: string } }) => setForm((previous) => ({ ...previous, [field]: event.target.value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setFeedback('');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, consent }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'We could not send your message. Please try again.');
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setFeedback(error instanceof Error ? error.message : 'We could not send your message. Please try again.');
    }
  }

  function reset() {
    setForm(emptyContactForm);
    setConsent(false);
    setFeedback('');
    setStatus('idle');
  }

  return (
    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-border shadow-xl ring-1 ring-border/50 h-full">
      {status === 'success' ? (
        <div className="flex h-full min-h-80 flex-col items-center justify-center gap-4 text-center" role="status" data-testid="contact-success">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-7 w-7" /></div>
          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground">Message sent</h2>
            <p className="mt-2 text-sm text-muted-foreground">Thank you. Our team will follow up using the email address you provided.</p>
          </div>
          <button type="button" onClick={reset} className="text-sm font-medium text-primary underline underline-offset-4">Send another message</button>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-display font-semibold text-foreground mb-2">Send Us a Message</h2>
          <p className="mb-6 text-sm text-muted-foreground">Please do not include confidential or time-sensitive information.</p>
          <form onSubmit={submit} className="space-y-5" data-testid="contact-form">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="contact-name">Full Name <span className="text-red-500">*</span></label>
                <input id="contact-name" name="name" type="text" required minLength={2} maxLength={120} autoComplete="name" value={form.name} onChange={update('name')} placeholder="Jane Smith" className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="contact-email">Email <span className="text-red-500">*</span></label>
                <input id="contact-email" name="email" type="email" required maxLength={254} autoComplete="email" value={form.email} onChange={update('email')} placeholder="jane@company.com" className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="contact-phone">Phone</label>
                <input id="contact-phone" name="phone" type="tel" maxLength={40} autoComplete="tel" value={form.phone} onChange={update('phone')} placeholder="(555) 000-0000" className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="contact-subject">Subject</label>
                <select id="contact-subject" name="subject" value={form.subject} onChange={update('subject')} className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors">
                  <option value="">Select a topic…</option>
                  <option>Patent Strategy</option>
                  <option>Patent Prosecution</option>
                  <option>Portfolio Management</option>
                  <option>Litigation Support</option>
                  <option>General Inquiry</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="contact-message">Message <span className="text-red-500">*</span></label>
              <textarea id="contact-message" name="message" required minLength={10} maxLength={5000} rows={5} value={form.message} onChange={update('message')} placeholder="Tell us about your IP needs…" className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-y" />
            </div>
            <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
              <label htmlFor="contact-website">Website</label>
              <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={update('website')} />
            </div>
            <label className="flex items-start gap-3 text-xs leading-relaxed text-muted-foreground">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required className="mt-0.5 h-4 w-4 accent-primary" />
              <span>I agree that Zilka-Kotab PC may use this information to respond to my inquiry, as described in the <Link href="/privacy-policy" className="text-primary underline underline-offset-2">Privacy Policy</Link>. Submitting this form does not create an attorney-client relationship. Please do not include confidential information.</span>
            </label>
            {status === 'error' && <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{feedback}</div>}
            <button type="submit" disabled={status === 'sending'} className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-white shadow transition-all hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed" data-testid="contact-submit">
              {status === 'sending' ? 'Sending…' : 'Send Message'} <Send className="w-4 h-4" />
            </button>
            <p className="text-xs text-muted-foreground text-center">All inquiries are kept confidential. A response does not create an attorney-client relationship.</p>
          </form>
        </>
      )}
    </div>
  );
}
