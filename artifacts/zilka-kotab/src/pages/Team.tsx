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
        description="Meet the principals and patent agents at Zilka-Kotab PC — registered patent attorneys with deep technical expertise in Silicon Valley IP law."
        url="/team"
      />

      <main className="flex-1 w-full pt-32 pb-24">
        {/* Page Header */}
        <section className="container mx-auto px-4 mb-20">
          <FadeIn>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground mb-6">Team</h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed">
              Engineers and scientists first, attorneys second. Our team combines deep technical fluency with relentless legal precision.
            </p>
          </FadeIn>
        </section>

        {/* Team grid — alphabetical by last name */}
        <section className="container mx-auto px-4 mb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {team.map((member, index) => (
              <FadeIn key={member.slug} delay={index * 0.08}>
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
                      <div className="flex flex-wrap gap-1 mb-4">
                        {member.awards.map((award, i) => (
                          <span key={i} className="inline-block text-xs font-semibold text-foreground/70 bg-muted border border-border px-2 py-0.5 rounded-sm">
                            {award}
                          </span>
                        ))}
                      </div>
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
            ))}
          </div>
        </section>

        {/* CTA */}
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
