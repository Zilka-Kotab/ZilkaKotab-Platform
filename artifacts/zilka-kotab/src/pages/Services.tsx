import React from 'react';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';
import { Link } from 'wouter';
import {
  Layers, Cpu, Target, Users, GraduationCap, Zap,
  Lightbulb, Bot, ClipboardCheck, BarChart2, RefreshCw, Briefcase,
  ShieldCheck, TrendingUp, DollarSign, Scale,
} from 'lucide-react';

const whyUs = [
  {
    icon: Layers,
    title: 'We own the pipeline, not just the paperwork.',
    body: 'In a world where a first draft can be produced in minutes, the highest-value counsel is the one who designs and manages the process that consistently converts innovation into valuable, defensible IP. That is the role we play for our clients.',
  },
  {
    icon: Cpu,
    title: 'Technical depth.',
    body: 'Registered patent practitioners with engineering and science backgrounds — spanning software and AI, semiconductors, battery and energy storage, advanced materials, medical devices, and telecommunications — who speak the language of your inventors.',
  },
  {
    icon: Target,
    title: 'Strategy behind every filing.',
    body: 'Every application we draft serves a portfolio-level objective: competitive positioning, investor readiness, licensing value, or litigation strength. We benchmark portfolios against competitors and align claims with real market activity.',
  },
  {
    icon: Users,
    title: 'An extension of your in-house team.',
    body: 'We work as outside counsel that behaves like inside counsel — rapid-turnaround searches, beating bar dates, executive-ready presentations, and direct access to the attorneys doing the work.',
  },
  {
    icon: GraduationCap,
    title: 'Educators by trade.',
    body: 'Our attorneys teach patent law, build IP training programs, and run legal clinics. Training engineers, inventors, and managers isn\'t an add-on for us; it\'s a core competency few prosecution boutiques can match.',
  },
  {
    icon: Zap,
    title: 'Boutique speed and value.',
    body: 'Industry-leading turnaround on application drafts, without the overhead that burdens large general-practice firms. We have been the consolidation point for hundreds of files transferred from larger firms and other boutiques.',
  },
];

const aiServices = [
  {
    icon: Lightbulb,
    title: 'Innovation capture and training.',
    body: 'We train engineers and product teams to recognize patentable subject matter and train inventors to produce complete, AI-ready invention disclosures — so counsel receives decision-ready submissions instead of raw fragments.',
  },
  {
    icon: Bot,
    title: 'AI workflow design and governance.',
    body: 'We develop standardized disclosure templates, review protocols, and prompting frameworks that let legal departments adopt AI-assisted drafting safely, consistently, and with attorney oversight where it matters.',
  },
  {
    icon: ClipboardCheck,
    title: 'Invention review and triage.',
    body: 'We establish and participate in invention review committees, and train managers on the patent-versus-trade-secret decision, so filing dollars flow to the innovations that matter.',
  },
  {
    icon: BarChart2,
    title: 'Pipeline insight and executive reporting.',
    body: 'We help IP leadership see and communicate what the pipeline is actually producing — from disclosure quality to portfolio health — with insights that demonstrate value to the business.',
  },
  {
    icon: RefreshCw,
    title: 'Overflow prosecution and continuity.',
    body: 'As the team maintaining your processes, we are the natural overflow counsel when volume spikes — with none of the ramp-up cost of onboarding a new firm.',
  },
  {
    icon: Briefcase,
    title: 'Fractional Chief IP Officer.',
    body: 'For companies too small to justify a full-time IP executive but too sophisticated for purely transactional outside counsel, we provide senior IP leadership on a retained basis: innovation capture, portfolio strategy, prosecution management, international coordination, competitive monitoring, licensing readiness, and board-level reporting.',
  },
];

const coreServices = [
  {
    icon: ShieldCheck,
    label: 'Protect',
    title: 'Building the Portfolio',
    body: 'Patent preparation and prosecution is the core of our practice: applications built to withstand examination, post-grant challenge, and litigation, filed strategically in the U.S. and worldwide through the PCT and Paris Convention routes with genuine fluency across the USPTO, EPO, and major Asian patent offices. And because not every asset belongs in a patent, we deliver the right protection for each — design patents, trademarks, trade secrets, and copyrights.',
  },
  {
    icon: TrendingUp,
    label: 'Strategize',
    title: 'Aligning IP with the Business',
    body: 'We treat the portfolio as a business asset: benchmarking it against competitors, aligning claims with market activity, and matching spend to value. From taking companies at IP "ground zero" to a strategically constructed portfolio, to freedom-to-operate studies, patentability and invalidity opinions, and landscape searching, our strategic work gives leadership a clear-eyed basis for every launch, filing, and risk decision.',
  },
  {
    icon: DollarSign,
    label: 'Monetize',
    title: 'Extracting Value',
    body: 'We have deep experience on both sides of the licensing table — offensive monetization initiatives backed by evidence-of-use analysis and claim charting, and defensive positioning that has preserved royalty-free resolutions against multimillion-dollar demands. We also handle the transactions that move IP — assignments, licenses, covenants not to sue, joint development agreements — and conduct diligence that holds up under investor scrutiny.',
  },
  {
    icon: Scale,
    label: 'Defend',
    title: 'Protecting the Position',
    body: 'When patents are challenged or asserted, we bring a prosecution-grounded understanding of how claims are built — and how they break. We represent clients in PTAB/USPTO proceedings, and provide high-leverage litigation support to in-house counsel and trial teams, from invalidity searching to portfolio mining for defensive counterclaims.',
  },
];

export default function Services() {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <>
      <SEO
        title="Services"
        description="Zilka-Kotab PC is a full-service IP law firm offering patent prosecution, portfolio strategy, licensing, and litigation support for technology companies."
        url="/services"
      />

      <main className="flex-1 w-full">

        {/* ── Hero ── */}
        <section className="pt-36 pb-24 container mx-auto px-4">
          <FadeIn>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground mb-8 max-w-4xl leading-[1.08]">
              Intellectual Property,{' '}
              <span className="text-primary">Engineered for Business</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed">
              Zilka-Kotab is a full-service intellectual property law firm serving companies from venture-backed startups to established technology leaders. We don't just draft patents — we design and manage the systems that turn R&amp;D into high-quality, business-aligned intellectual property.
            </p>
          </FadeIn>
        </section>

        {/* ── Why Clients Choose ── */}
        <section className="bg-primary py-24 relative overflow-hidden">
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
              <div className="mb-14">
                <div className="inline-flex items-center gap-3 mb-4">
                  <span className="w-8 h-px bg-accent" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-accent">Our Difference</span>
                  <span className="w-8 h-px bg-accent" />
                </div>
                <h2 className="text-3xl md:text-4xl font-display font-bold text-white">
                  Why Clients Choose Zilka-Kotab
                </h2>
              </div>
            </FadeIn>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {whyUs.map((item, i) => (
                <FadeIn key={item.title} delay={i * 0.07}>
                  <div className="bg-white/6 border border-white/10 rounded-2xl p-7 h-full backdrop-blur-sm hover:bg-white/10 transition-colors duration-200">
                    <div className="w-11 h-11 rounded-xl bg-accent/20 flex items-center justify-center mb-5">
                      <item.icon className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="text-white font-display font-semibold text-base mb-3 leading-snug">{item.title}</h3>
                    <p className="text-white/65 text-sm leading-relaxed">{item.body}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── AI-Enabled Patent Operations ── */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-6">
              <FadeIn>
                <div>
                  <div className="inline-flex items-center gap-3 mb-4">
                    <span className="w-8 h-px bg-accent" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-accent">AI-Enabled Operations</span>
                    <span className="w-8 h-px bg-accent" />
                  </div>
                  <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-6">
                    AI-Enabled Patent Operations
                  </h2>
                  <p className="text-foreground/70 leading-relaxed">
                    AI hasn't eliminated the need for patent counsel — it has moved the bottleneck upstream. The constraint on portfolio quality is no longer drafting speed; it's the organization's ability to capture, qualify, and prepare inventions in the first place. Engineers don't always know when to disclose. Disclosures arrive inconsistent and incomplete. In-house counsel spend their time rewriting submissions instead of making strategic decisions. And AI tools get introduced without standardized prompting, review, or governance. These are workflow problems before they are legal problems — and we solve them.
                  </p>
                  <p className="text-foreground/70 leading-relaxed mt-4">
                    Zilka-Kotab serves as an operational extension of the in-house IP department, optimizing the entire patent pipeline from invention conception to issued asset:
                  </p>
                </div>
              </FadeIn>
              <FadeIn delay={0.15}>
                <div className="rounded-2xl overflow-hidden shadow-lg h-64">
                  <img
                    src={`${baseUrl}/images/tech-bg.jpg`}
                    alt="AI-enabled patent operations"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              </FadeIn>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
              {aiServices.map((item, i) => (
                <FadeIn key={item.title} delay={i * 0.07}>
                  <div className="border border-border rounded-2xl p-7 h-full hover:border-accent/40 hover:shadow-md transition-all duration-200 bg-white/40">
                    <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center mb-5">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-foreground font-display font-semibold text-base mb-3 leading-snug">{item.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{item.body}</p>
                  </div>
                </FadeIn>
              ))}
            </div>

            <FadeIn delay={0.2}>
              <p className="mt-10 text-foreground/65 text-sm leading-relaxed max-w-3xl border-l-2 border-accent pl-5 italic">
                Engagements are flexibly structured around each client's needs — combining training, invention committee participation, workflow optimization, portfolio health reviews, and overflow prosecution into a system, not billable hours.
              </p>
            </FadeIn>
          </div>
        </section>

        {/* ── Core Services ── */}
        <section className="py-24 bg-primary relative overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img
              src={`${baseUrl}/images/hero-new.jpg`}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover opacity-5"
            />
          </div>
          <div className="container mx-auto px-4 relative z-10">
            <FadeIn>
              <div className="mb-14">
                <div className="inline-flex items-center gap-3 mb-4">
                  <span className="w-8 h-px bg-accent" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-accent">Practice Areas</span>
                  <span className="w-8 h-px bg-accent" />
                </div>
                <h2 className="text-3xl md:text-4xl font-display font-bold text-white">
                  Our Services
                </h2>
              </div>
            </FadeIn>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {coreServices.map((item, i) => (
                <FadeIn key={item.label} delay={i * 0.09}>
                  <div className="bg-white/6 border border-white/10 rounded-2xl p-8 h-full backdrop-blur-sm hover:bg-white/10 transition-colors duration-200">
                    <div className="flex items-center gap-4 mb-5">
                      <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                        <item.icon className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <p className="text-accent text-xs font-semibold uppercase tracking-widest">{item.label}</p>
                        <h3 className="text-white font-display font-bold text-xl leading-tight">{item.title}</h3>
                      </div>
                    </div>
                    <p className="text-white/65 text-sm leading-relaxed">{item.body}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="container mx-auto px-4 py-24">
          <FadeIn delay={0.2}>
            <div className="bg-muted rounded-3xl p-12 md:p-20 text-center border border-border">
              <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
                Ready to build a smarter IP program?
              </h2>
              <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
                Let's discuss how our expertise aligns with your business objectives.
              </p>
              <a
                href="mailto:patent@zilkakotab.com"
                className="inline-flex h-14 items-center justify-center rounded-sm bg-primary px-10 text-base font-semibold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                Contact Our Team
              </a>
            </div>
          </FadeIn>
        </section>

      </main>
    </>
  );
}
