import React from 'react';
import { Link } from 'wouter';
import { Linkedin, ArrowRight } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';
import { team } from '@/data/team';

export default function Team() {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <>
      <SEO
        title="Team"
        description="Meet the principals, patent attorneys, agents, paralegals, and intellectual property professionals at Zilka-Kotab PC."
        url="/team"
      />

      <main className="flex-1 w-full pt-20">
        {/* Page Header */}
        <section className="container mx-auto px-4 mb-20">
          <FadeIn>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground mb-6">Team</h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed">
              Engineers and scientists first, attorneys second. Our team combines deep technical fluency with relentless legal precision.
            </p>
          </FadeIn>
        </section>

        {/* Team grid */}
        <section className="container mx-auto px-4 mb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {team.map((member, index) => (
              <React.Fragment key={member.slug}>
                <FadeIn delay={index * 0.08}>
                <div className="group flex flex-col h-full">
                  <Link href={`/team/${member.slug}`} className="block mb-5 overflow-hidden rounded-2xl aspect-square bg-muted">
                    <img
                      src={`${baseUrl}${member.photo}`}
                      alt={member.name}
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                  </Link>

                  <div className="flex-1 flex flex-col">
                    {/* Name / role / LinkedIn */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <Link href={`/team/${member.slug}`}>
                          <h3 className="text-xl font-display font-bold text-foreground hover:text-primary transition-colors">{member.name}</h3>
                        </Link>
                        <p className="text-primary font-medium text-sm">{member.role}</p>
                      </div>
                      {member.linkedin && (
                        <a
                          href={member.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors p-1 mt-0.5 shrink-0"
                          aria-label={`${member.name} on LinkedIn`}
                        >
                          <Linkedin className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    {/* Education */}
                    <ul className="mt-3 mb-3 space-y-0.5 flex-1">
                      {member.education.map((line, i) => (
                        <li key={i} className="text-sm text-muted-foreground leading-snug">{line}</li>
                      ))}
                    </ul>

                    {/* Awards */}
                    {member.awards && member.awards.length > 0 && (
                      <p className="text-xs text-muted-foreground mb-4">
                        <span className="font-semibold text-foreground/60">Awards: </span>
                        {member.awards.join(' / ')}
                      </p>
                    )}

                    <Link
                      href={`/team/${member.slug}`}
                      className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:text-primary/80 group/link mt-auto"
                    >
                      Full Profile
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-1" />
                    </Link>
                  </div>
                </div>
                </FadeIn>
                {/* Spacer: fills the 4th column of row 1 so Brill starts on row 2 */}
                {index === 2 && <div className="hidden lg:block" />}
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* CTA */}
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
            <FadeIn delay={0.2}>
              <h2 className="text-4xl md:text-6xl font-display font-bold mb-8">
                Ready to build a smarter IP program?
              </h2>
              <p className="text-xl text-secondary-foreground/80 mb-12 max-w-2xl mx-auto font-light">
                Let's discuss how our expertise aligns with your business objectives.
              </p>
              <a
                href="/contact"
                className="inline-flex h-14 items-center justify-center rounded-sm bg-primary px-10 text-lg font-medium text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
              >
                Contact Our Team
              </a>
            </FadeIn>
          </div>
        </section>

      </main>
    </>
  );
}
