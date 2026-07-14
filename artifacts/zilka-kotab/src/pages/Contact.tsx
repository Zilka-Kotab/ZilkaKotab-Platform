import React from 'react';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';

const contactItems = [
  {
    icon: MapPin,
    label: 'Headquarters',
    content: <>1155 North 1st St, Suite 104<br />San Jose, CA 95112</>,
    link: null,
  },
  {
    icon: Phone,
    label: 'Phone',
    content: <a href="tel:408-971-2573" className="hover:text-primary transition-colors">(408) 971-2573</a>,
    link: null,
  },
  {
    icon: Mail,
    label: 'Email',
    content: <a href="mailto:patent@zilkakotab.com" className="hover:text-primary transition-colors">patent@zilkakotab.com</a>,
    link: null,
  },
  {
    icon: Clock,
    label: 'Office Hours',
    content: <>Monday – Friday<br />9:00 AM – 6:00 PM PT</>,
    link: null,
  },
];

export default function Contact() {
  return (
    <>
      <SEO
        title="Contact Us"
        description="Contact Zilka-Kotab PC in San Jose, California. Reach out to schedule a confidential consultation for patent strategy and intellectual property protection."
        url="/contact"
      />

      <main className="flex-1 w-full pt-32 pb-24">
        {/* Page Header */}
        <section className="container mx-auto px-4 mb-20">
          <FadeIn>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-foreground mb-6">Contact Us</h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl leading-relaxed">
              Reach out to schedule a confidential consultation on your intellectual property needs.
            </p>
          </FadeIn>
        </section>

        <section className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

            {/* Contact details */}
            <FadeIn delay={0.1}>
              <ul className="space-y-8 lg:pl-16">
                {contactItems.map(({ icon: Icon, label, content }) => (
                  <li key={label} className="flex items-start gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-accent/15 flex items-center justify-center shrink-0">
                      <Icon className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <p className="font-display font-semibold text-foreground mb-1">{label}</p>
                      <p className="text-muted-foreground leading-relaxed">{content}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </FadeIn>

            {/* Map */}
            <FadeIn delay={0.2}>
              <div className="rounded-2xl overflow-hidden shadow-md border border-border h-[375px]">
                <iframe
                  title="Map of Zilka-Kotab PC"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3171.306079978713!2d-121.90807768469463!3d37.35914597983697!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x808fccf0e2101211%3A0xcda6dc79e51c86fc!2s1155%20N%201st%20St%20%23104%2C%20San%20Jose%2C%20CA%2095112!5e0!3m2!1sen!2sus!4v1684346857121!5m2!1sen!2sus"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </FadeIn>

          </div>
        </section>
      </main>
    </>
  );
}
