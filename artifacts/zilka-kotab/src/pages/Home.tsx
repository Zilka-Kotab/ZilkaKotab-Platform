import React from 'react';
import { Link } from 'wouter';
import { ArrowRight, ShieldCheck, Scale, FileBadge, Code2, Cpu, CreditCard } from 'lucide-react';

const PAY_INVOICE_URL = 'https://secure.lawpay.com/pages/zilkakotabpc/operating';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';
import { AnimatedCounter } from '@/components/AnimatedCounter';

const services = [
  {
    title: "Patent Strategy",
    description: "Organize portfolios, compare against competitors, and increase patent value by aligning claims with market activity and competing R&D.",
    icon: ShieldCheck
  },
  {
    title: "Cost-Effective Prosecution",
    description: "We procure patents built to withstand modern legal challenges, maximizing value per dollar spent without compromising quality.",
    icon: FileBadge
  },
  {
    title: "Litigation Support",
    description: "Expert analysis and strategic positioning for patent disputes. Deep experience in both offensive and defensive scenarios.",
    icon: Scale
  }
];

export default function Home() {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "LegalService",
    "name": "Zilka-Kotab PC",
    "image": `https://zilkakotab.com${baseUrl}/images/hero.jpg`,
    "description": "Silicon Valley intellectual property law firm specializing in patent strategy and prosecution.",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "1155 North 1st St #104",
      "addressLocality": "San Jose",
      "addressRegion": "CA",
      "postalCode": "95112",
      "addressCountry": "US"
    },
    "telephone": "+1-408-971-2573",
    "url": "https://zilkakotab.com",
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "09:00",
      "closes": "18:00"
    }
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
        {/* HERO SECTION */}
        <section className="relative min-h-[90dvh] flex items-center pt-20 pb-32 overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img 
              src={`${baseUrl}/images/hero.jpg`} 
              alt="Modern Silicon Valley office interior overlooking the city"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-secondary/80 mix-blend-multiply" />
            <div className="absolute inset-0 bg-gradient-to-r from-secondary via-secondary/90 to-transparent" />
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl">
              <FadeIn delay={0.1}>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary-foreground backdrop-blur-sm mb-8">
                  <span className="w-2 h-2 rounded-full bg-primary-foreground animate-pulse" />
                  <span className="text-sm font-medium tracking-wide">Silicon Valley IP Strategists</span>
                </div>
              </FadeIn>
              
              <FadeIn delay={0.2}>
                <h1 className="text-5xl md:text-7xl font-display font-semibold text-white leading-[1.1] mb-8 text-balance">
                  Patents engineered for <span className="text-primary-foreground">absolute precision.</span>
                </h1>
              </FadeIn>
              
              <FadeIn delay={0.3}>
                <p className="text-xl md:text-2xl text-white/80 mb-12 max-w-2xl leading-relaxed font-light">
                  We build IP portfolios that survive boardroom scrutiny and courtroom battles. Trusted by the architects of tomorrow's technology.
                </p>
              </FadeIn>

              <FadeIn delay={0.4}>
                <div className="flex flex-wrap gap-4">
                  <Link href="/contact" className="inline-flex h-14 items-center justify-center rounded-sm bg-primary px-8 text-base font-medium text-white shadow-lg transition-all hover:bg-primary/90 hover:scale-105 active:scale-95 group">
                    Schedule a Consultation
                    <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link href="/services" className="inline-flex h-14 items-center justify-center rounded-sm border border-white/20 bg-white/5 backdrop-blur-sm px-8 text-base font-medium text-white transition-colors hover:bg-white/10 hover:border-white/40">
                    Explore Our Expertise
                  </Link>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* STATS BAR */}
        <section className="bg-primary py-12 relative z-20 -mt-8 mx-4 md:mx-8 lg:mx-auto max-w-6xl rounded-lg shadow-xl">
          <div className="container mx-auto px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-white/10">
              <FadeIn delay={0.1} className="text-center px-4">
                <p className="text-4xl md:text-5xl font-display font-bold text-white mb-2">
                  <AnimatedCounter value={1200} suffix="+" />
                </p>
                <p className="text-primary-foreground/80 text-sm font-medium uppercase tracking-wider">Issued Patents</p>
              </FadeIn>
              <FadeIn delay={0.2} className="text-center px-4">
                <p className="text-4xl md:text-5xl font-display font-bold text-white mb-2">
                  <AnimatedCounter value={6} suffix="+" />
                </p>
                <p className="text-primary-foreground/80 text-sm font-medium uppercase tracking-wider">Years in Business</p>
              </FadeIn>
              <FadeIn delay={0.3} className="text-center px-4">
                <p className="text-4xl md:text-5xl font-display font-bold text-white mb-2">
                  <AnimatedCounter value={32} />
                </p>
                <p className="text-primary-foreground/80 text-sm font-medium uppercase tracking-wider">Top-Rated Pros</p>
              </FadeIn>
              <FadeIn delay={0.4} className="text-center px-4">
                <p className="text-4xl md:text-5xl font-display font-bold text-white mb-2">
                  <AnimatedCounter value={4} />
                </p>
                <p className="text-primary-foreground/80 text-sm font-medium uppercase tracking-wider">Expert Attorneys</p>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* SERVICES OVERVIEW */}
        <section className="py-24 md:py-32 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-20">
              <FadeIn>
                <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-6">Strategic Legal Action</h2>
                <p className="text-lg text-muted-foreground">
                  We don't just write patents. We fuse IP procurement with a deep understanding of your business objectives, competitors, and market landscape.
                </p>
              </FadeIn>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {services.map((service, index) => (
                <FadeIn key={service.title} delay={index * 0.1}>
                  <div className="group h-full bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-xl transition-all duration-300 hover:border-primary/20">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                      <service.icon className="w-7 h-7 text-primary" />
                    </div>
                    <h3 className="text-xl font-display font-semibold mb-4 text-foreground">{service.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                </FadeIn>
              ))}
            </div>

            <FadeIn delay={0.4} className="mt-16 text-center">
              <Link href="/services" className="inline-flex items-center text-primary font-medium hover:text-primary/80 group">
                View all practice areas
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </FadeIn>
          </div>
        </section>

        {/* TECHNICAL EXPERTISE */}
        <section className="py-24 bg-muted overflow-hidden relative">
          <div className="container mx-auto px-4 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <FadeIn direction="right">
                <h2 className="text-3xl md:text-5xl font-display font-bold mb-6 text-balance">
                  Speaking the language of <span className="text-primary">innovation</span>.
                </h2>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  While we work with mechanical and chemical technologies, our firm specializes in cutting-edge computer-related hardware and software technology. We don't need things explained twice.
                </p>
                <ul className="space-y-4 mb-10">
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Code2 className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="font-medium text-foreground">Software & Algorithms</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Cpu className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="font-medium text-foreground">Semiconductors & Hardware</span>
                  </li>
                </ul>
                <Link href="/about" className="inline-flex h-12 items-center justify-center rounded-sm bg-secondary px-8 text-sm font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary/90">
                  Read Our Story
                </Link>
              </FadeIn>
              
              <FadeIn direction="left">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/5 rounded-3xl translate-x-4 translate-y-4" />
                  <img 
                    src={`${baseUrl}/images/services.jpg`} 
                    alt="Abstract IP and technology representation" 
                    className="relative rounded-3xl shadow-2xl object-cover aspect-square md:aspect-[4/3] w-full"
                  />
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* CTA SECTION */}
        <section className="py-32 relative overflow-hidden bg-secondary text-secondary-foreground">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-primary rounded-full blur-3xl opacity-20" />
          <div className="container mx-auto px-4 text-center relative z-10">
            <FadeIn>
              <h2 className="text-4xl md:text-6xl font-display font-bold mb-8">Ready to secure your assets?</h2>
              <p className="text-xl text-secondary-foreground/80 mb-12 max-w-2xl mx-auto font-light">
                Position your intellectual property for maximum value and defensibility. Schedule a confidential consultation with our partners.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Link href="/contact" className="inline-flex h-14 items-center justify-center rounded-sm bg-primary px-10 text-lg font-medium text-white shadow-xl transition-transform hover:scale-105 active:scale-95">
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