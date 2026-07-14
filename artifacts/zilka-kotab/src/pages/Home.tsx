import React from 'react';
import { Link } from 'wouter';
import {
  ArrowRight, ShieldCheck, Scale, FileBadge,
  Code2, Cpu, Settings2, Layers, FlaskConical,
  CreditCard, Brain, Award, PlayCircle,
} from 'lucide-react';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';
import { AnimatedCounter } from '@/components/AnimatedCounter';

const PAY_INVOICE_URL = 'https://secure.lawpay.com/pages/zilkakotabpc/operating';
const FOUNDED_YEAR = 2000;

const services = [
  {
    title: 'Patent Strategy',
    description:
      'Organize portfolios, compare against competitors, and increase patent value by aligning claims with market activity and competing R&D.',
    icon: ShieldCheck,
  },
  {
    title: 'Cost-Effective Prosecution',
    description:
      'We procure patents built to withstand modern legal challenges, maximizing value per dollar spent without compromising quality.',
    icon: FileBadge,
  },
  {
    title: 'Litigation Support',
    description:
      'Expert analysis and strategic positioning for patent disputes. Deep experience in both offensive and defensive scenarios.',
    icon: Scale,
  },
];

const techAreas = [
  { label: 'Software & Algorithms', icon: Code2 },
  { label: 'Semiconductors & Hardware', icon: Cpu },
  { label: 'Mechanical Systems', icon: Settings2 },
  { label: 'Materials Science', icon: Layers },
  { label: 'Chemical Technologies', icon: FlaskConical },
];

export default function Home() {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
  const yearsInBusiness = new Date().getFullYear() - FOUNDED_YEAR;

  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'LegalService',
    name: 'Zilka-Kotab PC',
    image: `https://zilkakotab.com${baseUrl}/images/hero-new.jpg`,
    description:
      'Silicon Valley intellectual property law firm specializing in patent strategy and prosecution.',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '1155 North 1st St #104',
      addressLocality: 'San Jose',
      addressRegion: 'CA',
      postalCode: '95112',
      addressCountry: 'US',
    },
    telephone: '+1-408-971-2573',
    url: 'https://zilkakotab.com',
    foundingDate: String(FOUNDED_YEAR),
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '09:00',
      closes: '18:00',
    },
  };

  return (
    <>
      <SEO
        title="Home"
        description="Zilka-Kotab PC is an intellectual property law firm in Silicon Valley, providing strategic patent procurement and IP management for high-tech corporations."
        url="/"
      >
        <script type="application/ld+json">{JSON.stringify(schemaData)}</script>
      </SEO>

      <main className="flex-1 w-full">
        {/* ── HERO ── */}
        <section className="relative min-h-[90dvh] flex items-center pt-20 pb-16 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img
              src={`${baseUrl}/images/hero-new.jpg`}
              alt="Futuristic technology office with neural network displays"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-secondary/75 mix-blend-multiply" />
            <div className="absolute inset-0 bg-gradient-to-r from-secondary via-secondary/90 to-transparent" />
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <FadeIn delay={0.1}>
              </FadeIn>

              <FadeIn delay={0.2}>
                <h1 className="text-5xl md:text-7xl font-display font-semibold text-white leading-[1.1] mb-8 text-balance">
                  Patents engineered for{' '}
                  <span className="text-primary-foreground">absolute precision.</span>
                </h1>
              </FadeIn>

              <FadeIn delay={0.3}>
                <p className="text-xl md:text-2xl text-white/80 mb-12 max-w-2xl leading-relaxed font-light">
                  We build IP portfolios that survive boardroom scrutiny and courtroom battles.
                  Trusted by the architects of tomorrow's technology.
                </p>
              </FadeIn>

              <FadeIn delay={0.4}>
                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/contact"
                    className="inline-flex h-14 items-center justify-center rounded-sm bg-primary px-8 text-base font-medium text-white shadow-lg transition-all hover:bg-primary/90 hover:scale-105 active:scale-95 group"
                  >
                    Schedule a Consultation
                    <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link
                    href="/services"
                    className="inline-flex h-14 items-center justify-center rounded-sm border border-white/20 bg-white/5 backdrop-blur-sm px-8 text-base font-medium text-white transition-colors hover:bg-white/10 hover:border-white/40"
                  >
                    Explore Our Expertise
                  </Link>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ── STATS BAR ── */}
        <section className="bg-primary py-10 relative z-20 -mt-8 mx-4 md:mx-8 lg:mx-auto max-w-6xl rounded-lg shadow-xl">
          <div className="container mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-4">
              <FadeIn delay={0.1} className="text-center px-6 py-2 border-r border-white/10">
                <p className="text-4xl md:text-5xl font-display font-bold text-white mb-2">
                  <AnimatedCounter value={5500} suffix="+" />
                </p>
                <p className="text-primary-foreground/70 text-xs font-semibold uppercase tracking-widest leading-relaxed">
                  Patents<br />Issued
                </p>
              </FadeIn>

              <FadeIn delay={0.2} className="text-center px-6 py-2 md:border-r border-white/10">
                <p className="text-4xl md:text-5xl font-display font-bold text-white mb-2 leading-none">
                  $<AnimatedCounter value={130} suffix="M+" />
                </p>
                <p className="text-primary-foreground/70 text-xs font-semibold uppercase tracking-widest leading-relaxed">
                  Patent<br />Licensing Value
                </p>
              </FadeIn>

              <FadeIn delay={0.3} className="text-center px-6 py-2 border-r border-white/10">
                <p className="text-4xl md:text-5xl font-display font-bold text-white mb-2 leading-none">
                  <AnimatedCounter value={500} suffix="+" />
                </p>
                <p className="text-primary-foreground/70 text-xs font-semibold uppercase tracking-widest leading-relaxed">
                  Active Patent<br />Families Managed
                </p>
              </FadeIn>

              <FadeIn delay={0.4} className="text-center px-6 py-2">
                <p className="text-4xl md:text-5xl font-display font-bold text-white mb-2 leading-none">
                  <AnimatedCounter value={yearsInBusiness} suffix="+" />&nbsp;Yrs
                </p>
                <p className="text-primary-foreground/70 text-xs font-semibold uppercase tracking-widest leading-relaxed">
                  Helping Companies<br />Innovate
                </p>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ── FIRM PHILOSOPHY ── */}
        <section className="pt-20 pb-24 md:pb-32 bg-muted -mt-6">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">

              {/* Video placeholder */}
              <FadeIn direction="right">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl aspect-video bg-secondary group cursor-pointer">
                  {/* Replace this <video> src with your actual video file */}
                  <video
                    className="w-full h-full object-cover opacity-60"
                    poster=""
                    preload="none"
                  />
                  {/* Dark overlay */}
                  <div className="absolute inset-0 bg-secondary/50" />
                  {/* Placeholder text behind play button */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center backdrop-blur-sm group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300">
                      <PlayCircle className="w-10 h-10 text-white" />
                    </div>
                    <p className="text-white/50 text-sm font-medium uppercase tracking-widest">Video coming soon</p>
                  </div>
                  {/* Gold accent corner */}
                  <div className="absolute top-4 left-4 w-12 h-px bg-accent" />
                  <div className="absolute top-4 left-4 w-px h-12 bg-accent" />
                  <div className="absolute bottom-4 right-4 w-12 h-px bg-accent" />
                  <div className="absolute bottom-4 right-4 w-px h-12 bg-accent" />
                </div>
              </FadeIn>

              {/* Philosophy text */}
              <FadeIn direction="left">
                <div className="inline-flex items-center gap-3 mb-6">
                  <span className="w-8 h-px bg-accent" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-accent">Our Philosophy</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-6 leading-tight text-balance">
                  Patents are a business tool,<br className="hidden md:block" /> not just a legal formality.
                </h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p>
                    At Zilka-Kotab, we believe that great IP strategy begins long before a patent is filed.
                    We immerse ourselves in our clients' technology, their markets, and their competitive
                    landscape — so every patent we craft is engineered to do real business work.
                  </p>
                  <p>
                    Our goal is simple: build patent portfolios that create durable competitive moats,
                    support licensing revenue, and hold up under the scrutiny of litigation. We measure
                    success not by volume, but by the strategic value each asset delivers.
                  </p>
                  <p>
                    We are scientists and engineers who became lawyers — and that perspective shapes
                    every engagement. Precision, depth, and relentless attention to the claims that matter.
                  </p>
                </div>
                <div className="mt-8">
                  <Link
                    href="/about"
                    className="inline-flex items-center gap-2 text-primary font-semibold hover:text-primary/80 group"
                  >
                    Learn more about our firm
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </FadeIn>

            </div>
          </div>
        </section>

        {/* ── SERVICES OVERVIEW ── */}
        <section className="py-24 md:py-32 bg-primary overflow-hidden relative">
          <div className="absolute inset-0 z-0">
            <img
              src={`${baseUrl}/images/hero-new.jpg`}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover opacity-5"
            />
          </div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center max-w-3xl mx-auto mb-20">
              <FadeIn>
                <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-6">
                  Strategic Legal Action
                </h2>
                <p className="text-lg text-white/70">
                  We don't just write patents. We fuse IP procurement with a deep understanding of
                  your business objectives, competitors, and market landscape.
                </p>
              </FadeIn>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {services.map((service, index) => (
                <FadeIn key={service.title} delay={index * 0.1}>
                  <div className="group h-full bg-white/5 p-8 rounded-2xl border border-white/10 hover:bg-white/10 transition-all duration-300">
                    <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <service.icon className="w-7 h-7 text-accent" />
                    </div>
                    <h3 className="text-xl font-display font-semibold mb-4 text-white">
                      {service.title}
                    </h3>
                    <p className="text-white/65 leading-relaxed">{service.description}</p>
                  </div>
                </FadeIn>
              ))}
            </div>

            <FadeIn delay={0.4} className="mt-16 text-center">
              <Link
                href="/services"
                className="inline-flex items-center text-accent font-medium hover:text-accent/80 group"
              >
                View services offered
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </FadeIn>
          </div>
        </section>

        {/* ── AI-POWERED PRACTICE ── */}
        <section className="py-24 bg-muted overflow-hidden relative">
          <div className="absolute inset-0 z-0">
            <img
              src={`${baseUrl}/images/tech-bg.jpg`}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover opacity-5"
            />
          </div>
          <div className="container mx-auto px-4 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <FadeIn direction="right">
                <div className="inline-flex items-center gap-3 mb-6">
                  <span className="w-8 h-px bg-accent" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-accent">AI-Powered Practice</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-display font-bold mb-6 text-balance text-foreground">
                  The same AI tools.{' '}
                  <span className="text-primary">A completely different outcome.</span>
                </h2>
                <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                  Every firm has access to AI. What separates Zilka-Kotab is what happens after you turn it on. Our practitioners are IP specialists first — engineers and scientists who understand the technology at a level that allows them to direct, validate, and refine AI-assisted work in ways generalist attorneys simply cannot.
                </p>
                <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
                  We have integrated AI-assisted tools across prior art searching, claim drafting, prosecution strategy, and portfolio analysis — delivering faster turnaround, sharper claims, and strategic insight at a scale previously out of reach for boutique practices.
                </p>
                <Link
                  href="/services"
                  className="inline-flex items-center gap-2 text-primary font-medium hover:text-primary/80 group"
                >
                  See how we work
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </FadeIn>

              <FadeIn direction="left">
                <div className="grid grid-cols-1 gap-4">
                  {[
                    {
                      title: 'AI-Accelerated Search & Analysis',
                      body: 'What once took weeks is now returned in hours. We use AI-assisted tools to uncover prior art, map the competitive landscape, and surface strategic insights earlier in the decision cycle.',
                    },
                    {
                      title: 'AI-Assisted Drafting, Specialist-Reviewed',
                      body: 'AI can generate a first draft. It cannot exercise judgment. Our attorneys use AI tooling to accelerate drafting while applying the technical and legal expertise to ensure every claim is precise and defensible.',
                    },
                    {
                      title: 'Portfolio Intelligence at Scale',
                      body: 'We use AI to benchmark portfolios against competitor filings, identify claim gaps, and surface licensing opportunities — insight previously reserved for the largest in-house teams.',
                    },
                  ].map((item, i) => (
                    <FadeIn key={item.title} delay={i * 0.1}>
                      <div className="p-6 rounded-xl border border-border bg-card shadow-sm">
                        <h3 className="font-display font-semibold text-foreground mb-2">{item.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                      </div>
                    </FadeIn>
                  ))}
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* ── TECHNICAL EXPERTISE ── */}
        <section className="py-24 bg-primary overflow-hidden relative">
          <div className="absolute inset-0 z-0">
            <img
              src={`${baseUrl}/images/patent-doc.jpg`}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover opacity-5"
            />
          </div>
          <div className="container mx-auto px-4 relative z-10 max-w-4xl">
            <FadeIn>
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-6 text-balance text-white">
                Speaking the language of{' '}
                <span className="text-accent">innovation</span>.
              </h2>
              <p className="text-lg text-white/70 mb-10 leading-relaxed max-w-2xl">
                Our attorneys are engineers and scientists first. Across every technology domain we
                serve, we understand the invention deeply before we draft a single claim.
              </p>
            </FadeIn>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
              {techAreas.map(({ label, icon: Icon }, i) => (
                <FadeIn key={label} delay={i * 0.07}>
                  <div className="flex flex-col items-center text-center gap-3 p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300">
                    <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-accent" />
                    </div>
                    <span className="text-sm font-semibold text-white leading-tight">{label}</span>
                  </div>
                </FadeIn>
              ))}
            </div>
            <FadeIn delay={0.4}>
              <Link
                href="/about"
                className="inline-flex h-12 items-center justify-center rounded-sm bg-white px-8 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-white/90"
              >
                Read Our Story
              </Link>
            </FadeIn>
          </div>
        </section>

        {/* ── ACCOLADES BAND ── */}
        <section className="py-20 bg-background border-y border-border overflow-hidden relative">
          <div className="absolute inset-0 z-0">
            <img
              src={`${baseUrl}/images/patent-doc.jpg`}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover opacity-5"
            />
          </div>
          <div className="container mx-auto px-4 relative z-10">
            <FadeIn>
              <div className="flex items-center justify-center gap-3 mb-14">
                <span className="w-8 h-px bg-accent opacity-70" />
                <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  Recognition &amp; Rankings
                </p>
                <span className="w-8 h-px bg-accent opacity-70" />
              </div>
            </FadeIn>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 max-w-5xl mx-auto text-center">
              {[
                {
                  icon: Award,
                  headline: 'Top 300 IP Strategists',
                  sub: 'Repeatedly ranked 10+ years among the world\'s best by IAM Strategy 300',
                },
                {
                  icon: Award,
                  headline: 'Super Lawyers',
                  sub: 'Repeatedly honored in Northern California IP Law',
                },
                {
                  icon: Award,
                  headline: 'Top 10 Allowance Rate',
                  sub: 'Top ranked across multiple USPTO Tech Centers',
                },
              ].map((item, i) => (
                <FadeIn key={item.headline} delay={i * 0.1}>
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-accent/15 flex items-center justify-center">
                      <item.icon className="w-7 h-7 text-accent" />
                    </div>
                    <p className="font-display font-bold text-foreground text-2xl leading-tight">{item.headline}</p>
                    <p className="text-base text-muted-foreground leading-snug max-w-[200px]">{item.sub}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-32 relative overflow-hidden bg-secondary text-secondary-foreground">
          <div className="absolute inset-0 z-0">
            <img
              src={`${baseUrl}/images/hero-new.jpg`}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover opacity-5"
            />
          </div>
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-primary rounded-full blur-3xl opacity-20" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <FadeIn>
              <h2 className="text-4xl md:text-6xl font-display font-bold mb-8">
                Ready to secure your assets?
              </h2>
              <p className="text-xl text-secondary-foreground/80 mb-12 max-w-2xl mx-auto font-light">
                Position your intellectual property for maximum value and defensibility. Schedule a
                confidential consultation with our partners.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/contact"
                  className="inline-flex h-14 items-center justify-center rounded-sm bg-primary px-10 text-lg font-medium text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
                >
                  Contact Our Office
                </Link>
                <a
                  href={PAY_INVOICE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-sm border border-white/20 bg-white/5 backdrop-blur-sm px-8 text-lg font-medium text-white transition-colors hover:bg-white/10 hover:border-white/40"
                >
                  <CreditCard className="w-5 h-5" />
                  Pay Invoice
                </a>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>
    </>
  );
}
