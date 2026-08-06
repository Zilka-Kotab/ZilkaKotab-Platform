import React from 'react';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';

export default function Privacy() {
  return (
    <>
      <SEO
        title="Privacy Policy"
        description="Privacy Policy for Zilka-Kotab PC — how we collect, use, and protect your information."
        url="/privacy-policy"
      />

      <main className="flex-1 w-full pt-32 pb-24">
        <section className="container mx-auto px-4 max-w-3xl">
          <FadeIn>
            <h1 className="text-5xl font-display font-bold text-foreground mb-4">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground mb-12">Last updated: July 2025</p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="prose prose-slate max-w-none space-y-10 text-foreground/80 leading-relaxed">

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">1. Introduction</h2>
                <p>
                  Zilka-Kotab PC ("we," "our," or "the Firm") respects your privacy and is committed to
                  protecting the personal information you share with us. This Privacy Policy explains what
                  information we collect through this website (<strong>zilkakotab.com</strong>), how we use
                  it, and your rights regarding that information.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">2. Information We Collect</h2>
                <p>We may collect the following types of information:</p>
                <ul className="list-disc pl-6 space-y-2 mt-3">
                  <li>
                    <strong>Contact form submissions</strong> — name, email address, phone number, and any
                    message content you voluntarily provide when reaching out to us.
                  </li>
                  <li>
                    <strong>Usage data</strong> — standard web server logs including IP address, browser type,
                    pages visited, and referring URLs, collected automatically when you visit our site.
                  </li>
                </ul>
                <p className="mt-3">
                  We do not use tracking cookies, third-party advertising networks, or behavioral analytics
                  tools on this website.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
                <p>Information collected through this website is used solely to:</p>
                <ul className="list-disc pl-6 space-y-2 mt-3">
                  <li>Respond to your inquiries and communicate with you about our legal services.</li>
                  <li>Maintain and improve the security and functionality of this website.</li>
                  <li>Comply with applicable legal obligations.</li>
                </ul>
                <p className="mt-3">
                  We do not sell, rent, or share your personal information with third parties for marketing
                  purposes.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">4. Confidentiality of Communications</h2>
                <p>
                  Any information you submit through our contact form is treated as confidential. However,
                  please note that submitting a contact form does not establish an attorney-client
                  relationship. Please do not share sensitive or privileged information until an
                  attorney-client relationship has been formally established with the Firm.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">5. Data Retention</h2>
                <p>
                  We retain contact form submissions for as long as necessary to respond to your inquiry and
                  maintain records of our communications, consistent with applicable professional
                  responsibility rules.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">6. California Residents</h2>
                <p>
                  If you are a California resident, you may have rights under the California Consumer Privacy
                  Act (CCPA) regarding your personal information, including the right to know what
                  information we hold about you and to request its deletion. To exercise these rights,
                  please contact us at the information below.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">7. Third-Party Links</h2>
                <p>
                  Our website may contain links to third-party websites (such as embedded map services).
                  We are not responsible for the privacy practices of those sites and encourage you to review
                  their policies independently.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">8. Changes to This Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. Changes will be posted on this page
                  with an updated effective date. Your continued use of the website after any changes
                  constitutes your acceptance of the revised policy.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">9. Contact Us</h2>
                <p>
                  If you have questions about this Privacy Policy or how your information is handled, please
                  contact us:
                </p>
                <address className="not-italic mt-3 space-y-1 text-foreground/70">
                  <p><strong>Zilka-Kotab PC</strong></p>
                  <p>1155 North 1st Street, Suite 104</p>
                  <p>San Jose, CA 95112</p>
                  <p>Phone: <a href="tel:408-971-2573" className="text-primary hover:underline">(408) 971-2573</a></p>
                </address>
              </section>

            </div>
          </FadeIn>
        </section>
      </main>
    </>
  );
}
