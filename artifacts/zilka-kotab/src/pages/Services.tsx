import React from 'react';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';
import { Link } from 'wouter';
import { ArrowRight, ShieldCheck, FileBadge, Scale, Handshake, Lightbulb } from 'lucide-react';

const servicesList = [
  {
    id: "patent-strategy",
    title: "Patent Strategy",
    description: "Full-scale strategic initiatives: organize portfolios, compare against competitors, increase patent value by aligning claims with market activity and competing R&D.",
    icon: ShieldCheck,
    details: "A patent without a strategy is merely an expense. We work closely with executive teams and technical leads to map IP generation directly to business milestones. By analyzing competitor activity and market trajectories, we ensure your claims are positioned to protect current products and block future competitor pivots."
  },
  {
    id: "cost-effective",
    title: "Cost-Effective Prosecution",
    description: "We procure patents built to withstand modern legal challenges, maximizing value per dollar spent.",
    icon: FileBadge,
    details: "High quality does not have to mean unbounded expense. Our streamlined processes and deep technical expertise mean less time translating concepts and more time drafting robust claims. We focus on writing claims that survive Alice/101 challenges and PTAB reviews from the outset."
  },
  {
    id: "litigation-support",
    title: "Litigation Support",
    description: "Expert analysis and strategic positioning for patent disputes. Our attorneys have deep experience in both offensive and defensive scenarios.",
    icon: Scale,
    details: "When disputes arise, technical accuracy is paramount. We provide deep-dive invalidity and non-infringement analysis, claim construction strategies, and technical expert support to trial counsel. We know how a patent will be attacked because we know how to defend them."
  },
  {
    id: "licensing",
    title: "Licensing",
    description: "We help clients monetize their IP portfolios through strategic licensing programs and royalty structures.",
    icon: Handshake,
    details: "Transform your IP from a defensive shield into a revenue-generating asset. We assist in identifying licensing targets, negotiating terms, structuring cross-licensing agreements, and ensuring that the scope of the license protects your core business interests."
  },
  {
    id: "ip-strategies",
    title: "IP Strategies",
    description: "End-to-end IP portfolio management, from discovery through exploitation, aligned with your business objectives.",
    icon: Lightbulb,
    details: "Beyond single patents, we manage the entire lifecycle of corporate innovation. This includes setting up internal invention disclosure processes, establishing trade secret protocols, open-source compliance strategies, and comprehensive IP audits for M&A readiness."
  }
];

export default function Services() {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <>
      <SEO 
        title="Practice Areas" 
        description="Detailed breakdown of Zilka-Kotab PC's services including Patent Strategy, Prosecution, Litigation Support, and Licensing."
        url="/services"
      />

      <main className="flex-1 w-full pt-32 pb-24">
        {/* Page Header */}
        <section className="container mx-auto px-4 mb-24">
          <FadeIn>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground mb-6">Practice Areas</h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed">
              Comprehensive intellectual property solutions engineered for the demands of the modern technology sector.
            </p>
          </FadeIn>
        </section>

        {/* Services List */}
        <section className="container mx-auto px-4">
          <div className="space-y-32">
            {servicesList.map((service, index) => {
              const isEven = index % 2 === 0;
              return (
                <div key={service.id} id={service.id} className="scroll-mt-32">
                  <div className={`flex flex-col lg:flex-row gap-12 lg:gap-24 items-start ${isEven ? '' : 'lg:flex-row-reverse'}`}>
                    
                    <div className="lg:w-1/2 w-full">
                      <FadeIn delay={0.1} direction={isEven ? "right" : "left"}>
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-8">
                          <service.icon className="w-8 h-8 text-primary" />
                        </div>
                        <h2 className="text-3xl md:text-4xl font-display font-bold mb-6">{service.title}</h2>
                        <p className="text-xl text-foreground font-medium mb-6 leading-relaxed">
                          {service.description}
                        </p>
                        <p className="text-lg text-muted-foreground leading-relaxed">
                          {service.details}
                        </p>
                      </FadeIn>
                    </div>

                    <div className="lg:w-1/2 w-full h-full relative">
                      <FadeIn delay={0.2} direction={isEven ? "left" : "right"}>
                        <div className="aspect-[4/3] rounded-3xl overflow-hidden bg-muted relative group">
                           <div className="absolute inset-0 bg-secondary/10 mix-blend-multiply z-10" />
                           <img 
                             src={`${baseUrl}/images/services.jpg`} 
                             alt={service.title} 
                             className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                           />
                        </div>
                      </FadeIn>
                    </div>

                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="container mx-auto px-4 mt-32">
          <FadeIn delay={0.3}>
            <div className="bg-primary rounded-3xl p-12 md:p-20 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-white rounded-full blur-3xl opacity-10" />
              <div className="relative z-10">
                <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-6">Need targeted counsel?</h2>
                <p className="text-xl text-primary-foreground/80 mb-10 max-w-2xl mx-auto font-light">
                  Let's discuss how our expertise aligns with your business objectives.
                </p>
                <Link href="/contact" className="inline-flex h-14 items-center justify-center rounded-sm bg-white px-10 text-lg font-medium text-primary shadow-xl transition-transform hover:scale-105 active:scale-95">
                  Contact Our Team
                </Link>
              </div>
            </div>
          </FadeIn>
        </section>
      </main>
    </>
  );
}