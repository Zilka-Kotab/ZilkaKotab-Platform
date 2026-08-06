import React from 'react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, Linkedin, Mail } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';
import { getMemberBySlug } from '@/data/team';

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

        {/* Profile */}
        <section className="container mx-auto px-4 mb-20">
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-16 items-start">

            {/* Sidebar */}
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
                    Email
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

                {/* Awards */}
                {member.awards && member.awards.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-xs font-display font-semibold uppercase tracking-widest text-foreground/40 mb-2">Recognition</h2>
                    <ul className="space-y-1">
                      {member.awards.map((a, i) => (
                        <li key={i} className="text-sm text-muted-foreground">{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Education */}
                {member.education.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-xs font-display font-semibold uppercase tracking-widest text-foreground/40 mb-2">Education</h2>
                    <ul className="space-y-1">
                      {member.education.map((e, i) => (
                        <li key={i} className="text-sm text-muted-foreground">{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Admissions */}
                {member.admissions.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-xs font-display font-semibold uppercase tracking-widest text-foreground/40 mb-2">Admissions</h2>
                    <ul className="space-y-1">
                      {member.admissions.map((a, i) => (
                        <li key={i} className="text-sm text-muted-foreground">{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Memberships */}
                {member.memberships && member.memberships.length > 0 && (
                  <div>
                    <h2 className="text-xs font-display font-semibold uppercase tracking-widest text-foreground/40 mb-2">Memberships</h2>
                    <ul className="space-y-1">
                      {member.memberships.map((m, i) => (
                        <li key={i} className="text-sm text-muted-foreground">{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </FadeIn>

            {/* Bio */}
            <FadeIn direction="left">
              <div className="pt-2">
                <div className="space-y-6">
                  {member.fullBio.map((para, i) => (
                    <p key={i} className="text-foreground/80 leading-relaxed text-lg">
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            </FadeIn>

          </div>
        </section>

      </main>
    </>
  );
}
