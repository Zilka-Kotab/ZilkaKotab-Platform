import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';

const qaVideos = [
  { id: 1, question: "Can you tell us what the firm is all about?", src: "https://www.wevideo.com/embed/?cb=20260806#4149571869" },
  { id: 2, question: "What is your vision for the firm?", src: "https://www.wevideo.com/embed/?cb=20260806#4149573104" },
  { id: 3, question: "Every law firm says they're client focused. What actually distinguishes your firm?", src: "https://www.wevideo.com/embed/?cb=20260806#4149574274" },
  { id: 4, question: "Do you see yourselves as just a patent prosecution firm?", src: "https://www.wevideo.com/embed/?cb=20260806#4149575113" },
  { id: 5, question: "What types of clients do you enjoy working with?", src: "https://www.wevideo.com/embed/?cb=20260806#4149575913" },
  { id: 6, question: "AI is changing so much. How is it changing patent law?", src: "https://www.wevideo.com/embed/?cb=20260806#4149576723" },
  { id: 7, question: "If you had to describe the firm's culture in a few words, what would they be?", src: "https://www.wevideo.com/embed/?cb=20260806#4149577366" },
  { id: 8, question: "If someone watching is considering your firm, what would you want them to know?", src: "https://www.wevideo.com/embed/?cb=20260806#4149577889" },
];

export default function About() {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, '');

  // Track which video is active (playing) and per-video keys to force remount (stops playback)
  const [activeVideo, setActiveVideo] = useState<number | null>(null);
  const [iframeKeys, setIframeKeys] = useState<Record<number, number>>(
    () => Object.fromEntries(qaVideos.map(v => [v.id, 0]))
  );
  const videoSectionRef = useRef<HTMLDivElement>(null);
  const activeVideoRef = useRef<number | null>(null);
  activeVideoRef.current = activeVideo;

  const stopVideo = (id: number) => {
    setIframeKeys(k => ({ ...k, [id]: k[id] + 1 }));
    setActiveVideo(null);
  };

  // Carousel
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(3);

  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 640) setVisibleCount(1);
      else if (window.innerWidth < 1024) setVisibleCount(2);
      else setVisibleCount(3);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const maxIndex = qaVideos.length - visibleCount;

  useEffect(() => {
    setCurrentIndex(i => Math.min(i, Math.max(0, maxIndex)));
  }, [visibleCount, maxIndex]);

  const goPrev = () => {
    if (activeVideoRef.current !== null) stopVideo(activeVideoRef.current);
    setCurrentIndex(i => Math.max(0, i - 1));
  };

  const goNext = () => {
    if (activeVideoRef.current !== null) stopVideo(activeVideoRef.current);
    setCurrentIndex(i => Math.min(maxIndex, i + 1));
  };

  const goTo = (i: number) => {
    if (activeVideoRef.current !== null) stopVideo(activeVideoRef.current);
    setCurrentIndex(i);
  };

  // window.blur fires when focus shifts into an iframe (user clicked on it)
  useEffect(() => {
    const handleBlur = () => {
      const focused = document.activeElement as HTMLElement;
      if (focused?.tagName === 'IFRAME') {
        const card = focused.closest('[data-video-id]');
        if (card) {
          const id = Number(card.getAttribute('data-video-id'));
          const prev = activeVideoRef.current;
          if (prev !== null && prev !== id) {
            setIframeKeys(k => ({ ...k, [prev]: k[prev] + 1 }));
          }
          setActiveVideo(id);
        }
      }
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  // Stop active video when clicking outside the video section
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (videoSectionRef.current && !videoSectionRef.current.contains(e.target as Node)) {
        const prev = activeVideoRef.current;
        if (prev !== null) stopVideo(prev);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  return (
    <>
      <SEO 
        title="About Us" 
        description="Zilka-Kotab PC is located in the heart of Silicon Valley, specializing in computer hardware and software patent law near the USPTO Satellite Office."
        url="/about"
      />

      <main className="flex-1 w-full pt-28">
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

          <div ref={videoSectionRef} className="relative">
            {/* Prev arrow */}
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              aria-label="Previous videos"
              className="absolute left-0 top-[45%] -translate-y-1/2 -translate-x-5 z-10 w-10 h-10 rounded-full bg-white border border-border shadow-md flex items-center justify-center hover:bg-muted transition-all disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>

            {/* Track */}
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentIndex * (100 / visibleCount)}%)` }}
              >
                {qaVideos.map((v) => (
                  <div
                    key={v.id}
                    className="flex-shrink-0 px-2.5"
                    style={{ width: `${100 / visibleCount}%` }}
                  >
                    <div className="rounded-2xl overflow-hidden bg-muted border border-border hover:shadow-lg hover:border-accent/50 transition-all duration-300">
                      <div data-video-id={v.id} className="aspect-video bg-black relative">
                        <iframe
                          key={`${v.id}-${iframeKeys[v.id]}`}
                          title={v.question}
                          src={v.src}
                          width="100%"
                          height="100%"
                          className="absolute inset-0 w-full h-full"
                          scrolling="no"
                          frameBorder="0"
                          style={{ border: 'none' }}
                          allowFullScreen
                        />
                      </div>
                      <div className="p-4">
                        <p className="text-sm font-medium text-foreground leading-snug line-clamp-2 min-h-[2.75rem]">
                          {v.question}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Next arrow */}
            <button
              onClick={goNext}
              disabled={currentIndex >= maxIndex}
              aria-label="Next videos"
              className="absolute right-0 top-[45%] -translate-y-1/2 translate-x-5 z-10 w-10 h-10 rounded-full bg-white border border-border shadow-md flex items-center justify-center hover:bg-muted transition-all disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>

            {/* Dot indicators */}
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: maxIndex + 1 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-2 rounded-full transition-all duration-300 ${i === currentIndex ? 'bg-primary w-6' : 'bg-border w-2 hover:bg-muted-foreground'}`}
                />
              ))}
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