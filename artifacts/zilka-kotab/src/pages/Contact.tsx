import React, { useState } from 'react';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';
import { MapPin, Phone, Clock, Send, CheckCircle, AlertCircle } from 'lucide-react';

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, '');

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

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch(`${BASE_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong.');
      setStatus('success');
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message ?? 'Something went wrong. Please try again.');
    }
  };

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start max-w-5xl mx-auto">

            {/* Left: contact info + map */}
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

            {/* Right: contact form */}
            <FadeIn delay={0.15}>
              <div className="bg-muted rounded-2xl p-8 border border-border">
                <h2 className="text-2xl font-display font-semibold text-foreground mb-6">Send Us a Message</h2>

                {status === 'success' ? (
                  <div className="flex flex-col items-center text-center py-10 gap-4">
                    <CheckCircle className="w-14 h-14 text-green-500" />
                    <h3 className="text-xl font-display font-semibold text-foreground">Message Sent</h3>
                    <p className="text-muted-foreground max-w-xs">
                      Thank you for reaching out. We'll be in touch shortly.
                    </p>
                    <button
                      onClick={() => setStatus('idle')}
                      className="mt-2 text-sm text-primary font-medium hover:underline"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name + Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="name">
                          Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="name" name="name" type="text" required
                          value={form.name} onChange={handleChange}
                          placeholder="Jane Smith"
                          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="email">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="email" name="email" type="email" required
                          value={form.email} onChange={handleChange}
                          placeholder="jane@company.com"
                          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                    </div>

                    {/* Phone + Subject */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="phone">
                          Phone
                        </label>
                        <input
                          id="phone" name="phone" type="tel"
                          value={form.phone} onChange={handleChange}
                          placeholder="(555) 000-0000"
                          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="subject">
                          Subject
                        </label>
                        <select
                          id="subject" name="subject"
                          value={form.subject} onChange={handleChange}
                          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                        >
                          <option value="">Select a topic…</option>
                          <option>Patent Strategy</option>
                          <option>Patent Prosecution</option>
                          <option>Portfolio Management</option>
                          <option>Litigation Support</option>
                          <option>General Inquiry</option>
                        </select>
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="message">
                        Message <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="message" name="message" required rows={5}
                        value={form.message} onChange={handleChange}
                        placeholder="Tell us about your IP needs…"
                        className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
                      />
                    </div>

                    {/* Error */}
                    {status === 'error' && (
                      <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        {errorMsg}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={status === 'submitting'}
                      className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-white shadow transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
                    >
                      {status === 'submitting' ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          Sending…
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send Message
                        </>
                      )}
                    </button>

                    <p className="text-xs text-muted-foreground text-center">
                      All inquiries are kept strictly confidential.
                    </p>
                  </form>
                )}
              </div>
            </FadeIn>

          </div>
        </section>
      </main>
    </>
  );
}
