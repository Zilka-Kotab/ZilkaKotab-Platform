import React from 'react';
import { Link } from 'wouter';
import { Linkedin, ArrowRight } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';
import { team } from '@/data/team';

export default function Team() {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');

  const principals = team.filter((m) => m.category === 'principal');
  const members = team.filter((m) => m.category === 'member');

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

        {/* Principals */}
        <section className="container mx-auto px-4 mb-20">
          <FadeIn>
            <h2 className="text-xs font-display font-semibold uppercase tracking-widest text-foreground/40 mb-10">Principals</h2>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {principals.map((member, index) => (
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

                    <p className="text-muted-foreground text-sm mt-3 mb-5 leading-relaxed flex-1">
                      {member.shortBio}
                    </p>

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

        {/* Members */}
        {members.length > 0 && (
          <section className="container mx-auto px-4 pt-12 border-t border-border">
            <FadeIn>
              <h2 className="text-xs font-display font-semibold uppercase tracking-widest text-foreground/40 mb-10">Members</h2>
            </FadeIn>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
              {members.map((member, index) => (
                <FadeIn key={member.slug} delay={index * 0.08}>
                  <div className="group flex flex-col h-full">
                    <Link href={`/team/${member.slug}`} className="block mb-5 overflow-hidden rounded-2xl aspect-square bg-muted">
                      <img
                        src={`${baseUrl}${member.photo}`}
                        alt={member.name}
                        className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      />
                    </Link>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <Link href={`/team/${member.slug}`}>
                          <h3 className="text-xl font-display font-bold text-foreground hover:text-primary transition-colors">{member.name}</h3>
                        </Link>
                        <p className="text-primary font-medium text-sm">{member.role}</p>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm mt-3 mb-5 leading-relaxed flex-1">
                      {member.shortBio}
                    </p>
                    <Link
                      href={`/team/${member.slug}`}
                      className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:text-primary/80 group/link mt-auto"
                    >
                      Full Profile
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/link:translate-x-1" />
                    </Link>
                  </div>
                </FadeIn>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
