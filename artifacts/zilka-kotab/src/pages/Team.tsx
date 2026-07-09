import React from 'react';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';
import { Mail, Linkedin } from 'lucide-react';

const team = [
  {
    id: 1,
    name: "John Zilka",
    role: "Founding Partner",
    bio: "With over two decades of experience in Silicon Valley, John specializes in patent portfolio strategy and prosecution for complex software, artificial intelligence, and network architectures.",
    education: "J.D., Santa Clara University School of Law\nB.S. Computer Engineering",
    image: "/images/team-1.jpg"
  },
  {
    id: 2,
    name: "Dominic Kotab",
    role: "Founding Partner",
    bio: "Dominic brings extensive expertise in hardware, semiconductor, and mechanical systems. He has successfully navigated hundreds of critical patent applications through the USPTO.",
    education: "J.D., University of California\nB.S. Mechanical Engineering",
    image: "/images/team-2.jpg"
  },
  {
    id: 3,
    name: "Sarah Chen",
    role: "Senior Attorney",
    bio: "Sarah leads the firm's litigation support division, offering deep-dive invalidity analysis and claim construction strategies for high-stakes tech disputes.",
    education: "J.D., Stanford Law School\nM.S. Electrical Engineering",
    image: "/images/team-3.jpg"
  }
];

export default function Team() {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <>
      <SEO 
        title="Our Team" 
        description="Meet the top-rated professionals and expert attorneys at Zilka-Kotab PC."
        url="/team"
      />

      <main className="flex-1 w-full pt-32 pb-24">
        {/* Page Header */}
        <section className="container mx-auto px-4 mb-24">
          <FadeIn>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground mb-6">Our Experts</h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed">
              We are engineers and scientists first, attorneys second. Our team combines deep technical fluency with relentless legal precision.
            </p>
          </FadeIn>
        </section>

        {/* Team Grid */}
        <section className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
            {team.map((member, index) => (
              <FadeIn key={member.id} delay={index * 0.1}>
                <div className="group flex flex-col h-full">
                  <div className="mb-6 overflow-hidden rounded-2xl aspect-square bg-muted">
                    <img 
                      src={`${baseUrl}${member.image}`} 
                      alt={member.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 filter grayscale group-hover:grayscale-0"
                    />
                  </div>
                  
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h2 className="text-2xl font-display font-bold text-foreground">{member.name}</h2>
                        <p className="text-primary font-medium">{member.role}</p>
                      </div>
                      <div className="flex gap-2">
                        <a href={`mailto:patent@zilkakotab.com`} className="text-muted-foreground hover:text-primary transition-colors p-2" aria-label={`Email ${member.name}`}>
                          <Mail className="w-5 h-5" />
                        </a>
                      </div>
                    </div>
                    
                    <p className="text-muted-foreground mt-4 mb-6 leading-relaxed flex-1">
                      {member.bio}
                    </p>
                    
                    <div className="pt-6 border-t border-border mt-auto">
                      <h4 className="text-sm font-display font-semibold mb-2 uppercase tracking-wider text-foreground/60">Education</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                        {member.education}
                      </p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* Extended Team Note */}
        <section className="container mx-auto px-4 mt-32 text-center max-w-2xl">
          <FadeIn delay={0.4}>
            <div className="p-8 rounded-2xl bg-muted border border-border">
              <h3 className="text-2xl font-display font-semibold mb-4">A Team of 32+ Professionals</h3>
              <p className="text-muted-foreground leading-relaxed">
                Beyond our partners and senior attorneys, Zilka-Kotab PC is supported by a dedicated staff of patent agents, technical specialists, paralegals, and legal assistants ensuring seamless prosecution and portfolio management.
              </p>
            </div>
          </FadeIn>
        </section>
      </main>
    </>
  );
}