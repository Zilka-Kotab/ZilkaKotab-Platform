import React from 'react';
import { Link } from 'wouter';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';

export default function About() {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <>
      <SEO 
        title="About Us" 
        description="Zilka-Kotab PC is located in the heart of Silicon Valley, specializing in computer hardware and software patent law near the USPTO Satellite Office."
        url="/about"
      />

      <main className="flex-1 w-full pt-28 pb-24">
        {/* Page Header */}
        <section className="container mx-auto px-4 mb-12">
          <FadeIn>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground mb-4">Our Firm</h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed">
              Based in the heart of Silicon Valley, we deliver the utmost in quality and service for the intellectual property needs of high-technology companies.
            </p>
          </FadeIn>
        </section>

        {/* Main Content */}
        <section className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

            {/* Story */}
            <div className="lg:col-span-7">
              <FadeIn delay={0.15}>
                <h2 className="text-3xl font-display font-semibold mb-5">Beyond Ordinary Procurement</h2>
                <div className="prose prose-lg prose-slate dark:prose-invert">
                  <p>
                    Zilka-Kotab, PC is an intellectual property law firm dedicated to providing the utmost in quality and service for the intellectual property needs of high technology companies.
                  </p>
                  <p>
                    Our attorneys are engineers and scientists first, with deep expertise spanning software &amp; algorithms, semiconductors &amp; hardware, mechanical systems, materials science, and chemical technologies. We are also at the forefront of AI-related patent strategy — protecting machine learning systems, neural network architectures, and AI-powered products. In an era where software and AI patents face immense scrutiny, generic descriptions fail. We speak the language of engineers and developers, ensuring that every technical nuance is precisely captured and legally protected.
                  </p>
                  <p>
                    We go beyond ordinary IP procurement — we fuse it with a deep understanding of your business, your competitors, and your market. An issued patent is only as valuable as its ability to be enforced, licensed, or leveraged. We build portfolios with these end-goals in mind from day one.
                  </p>
                </div>
              </FadeIn>
            </div>

            {/* Sidebar / Location Info */}
            <div className="lg:col-span-5">
              <FadeIn delay={0.2} className="bg-muted p-6 rounded-2xl">
                <h3 className="text-xl font-display font-semibold mb-3">Strategic Location</h3>
                <p className="text-foreground/80 leading-relaxed mb-4 text-sm">
                  Our headquarters is located in the 30,000+ sq ft Zilka-Kotab building, conveniently situated near the Silicon Valley Satellite Office of the USPTO on Fourth Street in San Jose.
                </p>
                <div className="rounded-xl overflow-hidden shadow-md">
                  <img
                    src={`${baseUrl}/images/office.jpg`}
                    alt="Zilka-Kotab PC office building in San Jose"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="mt-3 text-sm text-foreground/70 space-y-0.5">
                  <p>1155 North 1st St, Suite 104</p>
                  <p>San Jose, CA 95112</p>
                </div>
              </FadeIn>
            </div>

          </div>
        </section>
        {/* Representative Clients */}
        <section className="mt-24 py-20 bg-primary overflow-hidden relative">
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
              <div className="text-center max-w-2xl mx-auto mb-14">
                <div className="inline-flex items-center gap-3 mb-4">
                  <span className="w-8 h-px bg-accent" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-accent">Representative Clients</span>
                  <span className="w-8 h-px bg-accent" />
                </div>
                <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
                  Trusted Across Industries
                </h2>
                <p className="text-white/65 leading-relaxed">
                  Our clients include companies of all sizes — from select high-tech start-ups and mid-sized manufacturing firms to some of the largest and best-known companies in the world. Our attorneys bring genuine technical fluency across a broad spectrum of innovation, including:
                </p>
              </div>
            </FadeIn>

            <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
              {[
                'Artificial Intelligence & Machine Learning',
                'Battery & Energy Storage',
                'Communication Systems',
                'Data Storage Technology',
                'Electronics & Semiconductors',
                'Internet & Software',
                'Materials Science',
                'Medical Devices',
                'MEMS Technology',
                'Nanotechnology',
                'Networking & Wireless Technology',
                'Optics & Photonics',
                'Quantum Technology',
                'Robotics & Automation',
                'Satellite Technology',
                'Wearable Electronics',
              ].map((tech, i) => (
                <FadeIn key={tech} delay={i * 0.04}>
                  <span className="inline-block px-5 py-3 rounded-sm border border-white/15 bg-white/8 text-sm font-semibold text-white/85 hover:bg-white/15 hover:border-accent/50 hover:text-white transition-all duration-200 backdrop-blur-sm">
                    {tech}
                  </span>
                </FadeIn>
              ))}
            </div>
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