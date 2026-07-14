import React from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, Linkedin, Mail } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';
import { getMemberBySlug, team } from '@/data/team';

export default function TeamMember() {
  const { slug } = useParams<{ slug: string }>();
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
  const member = getMemberBySlug(slug ?? '');

  if (!member) {
    return (
      <main className="flex-1 w-full pt-40 pb-24 text-center">
        <h1 className="text-4xl font-display font-bold mb-4">Not Found</h1>
        <p className="text-muted-foreground mb-8">We couldn't find that team member.</p>
        <Link href="/team" className="text-primary font-medium hover:underline">← Back to Our Team</Link>
      </main>
    );
  }

  // Other team members for the "Also meet" section
  const others = team.filter((m) => m.slug !== member.slug).slice(0, 3);

  return (
    <>
      <SEO
        title={`${member.name} — ${member.role}`}
        description={member.shortBio}
        url={`/team/${member.slug}`}
      />

      <main className="flex-1 w-full pt-32 pb-24">
        {/* Back link */}
        <div className="container mx-auto px-4 mb-12">
          <Link href="/team" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Back to Our Team
          </Link>
        </div>

        {/* Profile header */}
        <section className="container mx-auto px-4 mb-20">
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-16 items-start">
            <FadeIn direction="right">
              <div className="sticky top-32">
                <div className="overflow-hidden rounded-2xl aspect-square bg-muted mb-6 shadow-xl">
                  <img
                    src={`${baseUrl}${member.photo}`}
                    alt={member.name}
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <h1 className="text-3xl font-display font-bold text-foreground mb-1">{member.name}</h1>
                <p className="text-primary font-semibold text-lg mb-6">{member.role}</p>

                <div className="flex gap-3 mb-8">
                  <a
                    href={`mailto:${member.email}`}
                    className="inline-flex items-center gap-2 h-10 px-4 rounded-sm bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    {member.email}
                  </a>
                  {member.linkedin && (
                    <a
                      href={member.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 h-10 px-4 rounded-sm border border-border text-sm font-medium hover:bg-muted transition-colors"
                    >
                      <Linkedin className="w-4 h-4" />
                      LinkedIn
                    </a>
                  )}
                </div>

                {/* Focus areas */}
                <div>
                  <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-foreground/50 mb-3">Areas of Focus</h3>
                  <ul className="space-y-2">
                    {member.focus.map((area) => (
                      <li key={area} className="flex items-center gap-2 text-sm text-foreground/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </FadeIn>

            {/* Bio */}
            <FadeIn direction="left">
              <div className="pt-2">
                <div className="prose prose-lg max-w-none">
                  {member.fullBio.map((para, i) => (
                    <p key={i} className="text-foreground/80 leading-relaxed text-lg mb-6 last:mb-0">
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Also meet section */}
        <section className="container mx-auto px-4 mt-12 pt-12 border-t border-border">
          <FadeIn>
            <h2 className="text-2xl font-display font-bold mb-8 text-foreground">Also Meet Our Team</h2>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {others.map((other, i) => (
              <FadeIn key={other.slug} delay={i * 0.1}>
                <Link href={`/team/${other.slug}`} className="group block">
                  <div className="overflow-hidden rounded-xl aspect-square bg-muted mb-4">
                    <img
                      src={`${baseUrl}${other.photo}`}
                      alt={other.name}
                      className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105 filter grayscale group-hover:grayscale-0"
                    />
                  </div>
                  <p className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">{other.name}</p>
                  <p className="text-sm text-muted-foreground">{other.role}</p>
                </Link>
              </FadeIn>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
