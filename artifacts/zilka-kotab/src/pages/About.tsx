import React, { useState } from 'react';
import { Link } from 'wouter';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';

const qaVideos = [
  { id: 1, question: "Can you tell us what the firm is all about?", src: "https://www.wevideo.com/embed/#4149571869" },
  { id: 2, question: "What is your vision for the firm?", src: "https://www.wevideo.com/embed/#4149573104" },
  { id: 3, question: "Every law firm says they're client focused. What actually distinguishes your firm?", src: "https://www.wevideo.com/embed/#4149574274" },
  { id: 4, question: "Do you see yourselves as just a patent prosecution firm?", src: "" },
  { id: 5, question: "What types of clients do you enjoy working with?", src: "https://www.wevideo.com/embed/#4149575913" },
  { id: 6, question: "AI is changing so much. How is it changing patent law?", src: "" },
  { id: 7, question: "If you had to describe the firm's culture in a few words, what would they be?", src: "" },
  { id: 8, question: "If someone watching is considering your firm, what would you want them to know?", src: "" },
];

export default function About() {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');
  const [activeVideo, setActiveVideo] = useState<number | null>(null);

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
        {/* Q&A Video Section */}
        <section className="container mx-auto px-4 py-20">
          <FadeIn>
            <div className="text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center gap-3 mb-4">
                <span className="w-8 h-px bg-accent" />
                <span className="text-xs font-semibold uppercase tracking-widest text-accent">In Their Own Words</span>
                <span className="w-8 h-px bg-accent" />
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
                Q&amp;A with Our Managing Partner
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Hear directly from Britten Sessions on what sets Zilka-Kotab apart.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {qaVideos.map((v, i) => (
              <FadeIn key={v.id} delay={i * 0.06}>
                <button
                  onClick={() => setActiveVideo(v.id)}
                  className="group relative w-full text-left rounded-2xl overflow-hidden bg-muted border border-border hover:border-accent/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label={`Play video: ${v.question}`}
                >
                  {/* Thumbnail placeholder */}
                  <div className="aspect-video bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.06)_0%,_transparent_70%)]" />
                    {/* Question number */}
                    <span className="absolute top-3 left-4 text-white/30 font-display font-bold text-4xl leading-none select-none">
                      {String(v.id).padStart(2, '0')}
                    </span>
                    {/* Play button */}
                    <div className="relative z-10 w-14 h-14 rounded-full bg-white/15 border border-white/25 flex items-center justify-center group-hover:bg-accent group-hover:border-accent transition-all duration-300 group-hover:scale-110">
                      <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    </div>
                  </div>
                  {/* Question text */}
                  <div className="p-4">
                    <p className="text-sm font-medium text-foreground leading-snug group-hover:text-accent transition-colors duration-200">
                      {v.question}
                    </p>
                  </div>
                </button>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* Video Modal */}
        {activeVideo !== null && (() => {
          const video = qaVideos.find(v => v.id === activeVideo)!;
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={() => setActiveVideo(null)}
            >
              <div
                className="relative w-full max-w-3xl bg-background rounded-2xl overflow-hidden shadow-2xl border border-border"
                onClick={e => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={() => setActiveVideo(null)}
                  className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors"
                  aria-label="Close video"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {/* Video player */}
                <div className="aspect-video bg-black relative">
                  <iframe
                    title={video.question}
                    src={video.src}
                    width="100%"
                    height="100%"
                    className="absolute inset-0 w-full h-full"
                    scrolling="no"
                    frameBorder="0"
                    style={{ border: 'none' }}
                    allowFullScreen
                  />
                </div>
                {/* Caption */}
                <div className="px-6 py-4 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">Question {video.id}</p>
                  <p className="text-base font-medium text-foreground">{video.question}</p>
                </div>
              </div>
            </div>
          );
        })()}

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