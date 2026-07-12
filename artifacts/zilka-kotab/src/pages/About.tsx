import React from 'react';
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

      <main className="flex-1 w-full pt-32 pb-24">
        {/* Page Header */}
        <section className="container mx-auto px-4 mb-20">
          <FadeIn>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground mb-6">Our Firm</h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed">
              Based in the heart of Silicon Valley, we deliver the utmost in quality and service for the intellectual property needs of high-technology companies.
            </p>
          </FadeIn>
        </section>

        {/* Main Content */}
        <section className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            
            {/* Story */}
            <div className="lg:col-span-7 space-y-8">
              <FadeIn delay={0.1}>
                <h2 className="text-3xl font-display font-semibold mb-6">Beyond Ordinary Procurement</h2>
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
              <FadeIn delay={0.15}>
                <div className="rounded-2xl overflow-hidden shadow-xl mb-8 aspect-[3/2]">
                  <img
                    src={`${baseUrl}/images/office.jpg`}
                    alt="Zilka-Kotab PC office building in San Jose"
                    className="w-full h-full object-cover"
                  />
                </div>
              </FadeIn>

              <FadeIn delay={0.2} className="bg-muted p-8 md:p-12 rounded-2xl">
                <h3 className="text-2xl font-display font-semibold mb-6">Strategic Location</h3>
                <p className="text-foreground/80 leading-relaxed mb-8">
                  Our First Street headquarters is located in the 30,000+ sq ft Zilka-Kotab building, conveniently situated near the Silicon Valley Satellite Office of the USPTO on Fourth Street in San Jose.
                </p>
                <div className="aspect-[4/3] rounded-xl overflow-hidden bg-background mb-6">
                  <iframe 
                    title="Map of Zilka-Kotab PC"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3171.306079978713!2d-121.90807768469463!3d37.35914597983697!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x808fccf0e2101211%3A0xcda6dc79e51c86fc!2s1155%20N%201st%20St%20%23104%2C%20San%20Jose%2C%20CA%2095112!5e0!3m2!1sen!2sus!4v1684346857121!5m2!1sen!2sus" 
                    width="100%" 
                    height="100%" 
                    style={{ border: 0 }} 
                    allowFullScreen 
                    loading="lazy" 
                    referrerPolicy="no-referrer-when-downgrade"
                  ></iframe>
                </div>
                <div className="space-y-1 text-sm font-medium text-foreground">
                  <p>Zilka-Kotab PC</p>
                  <p className="text-muted-foreground">1155 North 1st St #104</p>
                  <p className="text-muted-foreground">San Jose, CA 95112</p>
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
                  Our clients include companies of all sizes — from select high-tech start-ups and mid-sized manufacturing firms to some of the largest and best-known companies in the world.
                </p>
              </div>
            </FadeIn>

            <div className="flex flex-wrap justify-center gap-3 max-w-4xl mx-auto">
              {[
                'Amdocs', 'AWID', 'Bill.com', 'Clorox', 'Intelleflex', 'JustAnswer', 'Lyten',
                'Monolithic Power Systems', 'Kofax', 'Kynded', 'Method',
                'NVIDIA', 'Reverse Risk', 'Saisei', 'Semphonic', 'TiKL',
                'Pricelite', 'Morisawa', 'Lawrence Livermore National Laboratory',
              ].map((name, i) => (
                <FadeIn key={name} delay={i * 0.04}>
                  <span className="inline-block px-5 py-3 rounded-sm border border-white/15 bg-white/8 text-sm font-semibold text-white/85 hover:bg-white/15 hover:border-accent/50 hover:text-white transition-all duration-200 backdrop-blur-sm">
                    {name}
                  </span>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

      </main>
    </>
  );
}