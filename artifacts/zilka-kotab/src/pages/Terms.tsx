import React from 'react';
import { SEO } from '@/components/SEO';
import { FadeIn } from '@/components/FadeIn';

export default function Terms() {
  return (
    <>
      <SEO
        title="Terms of Use & Disclaimer"
        description="Terms of Use and Legal Disclaimer for the Zilka-Kotab PC website."
        url="/terms"
      />

      <main className="flex-1 w-full pt-32 pb-24">
        <section className="container mx-auto px-4 max-w-3xl">
          <FadeIn>
            <h1 className="text-5xl font-display font-bold text-foreground mb-4">Terms of Use &amp; Disclaimer</h1>
            <p className="text-sm text-muted-foreground mb-12">Last updated: July 2025</p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="prose prose-slate max-w-none space-y-10 text-foreground/80 leading-relaxed">

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
                <p>
                  By accessing or using the Zilka-Kotab PC website (<strong>zilkakotab.com</strong>), you
                  agree to be bound by these Terms of Use. If you do not agree with any part of these terms,
                  please discontinue use of the site.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">2. No Attorney-Client Relationship</h2>
                <p>
                  The information provided on this website is for general informational purposes only and
                  does not constitute legal advice. Viewing this website, or contacting Zilka-Kotab PC
                  through it, does not create an attorney-client relationship. An attorney-client
                  relationship is established only through a written engagement agreement signed by both
                  parties.
                </p>
                <p className="mt-3">
                  Do not send confidential or time-sensitive information through this website until you have
                  established a formal attorney-client relationship with the Firm.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">3. No Legal Advice</h2>
                <p>
                  Nothing on this website should be construed as legal advice on any specific matter.
                  Intellectual property law is complex and fact-specific. You should not act or refrain from
                  acting based on information found on this site without first seeking professional legal
                  counsel appropriate to your particular situation.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">4. Jurisdictional Limitations</h2>
                <p>
                  Zilka-Kotab PC is a law firm registered in the State of California. The attorneys of
                  this Firm are licensed to practice before the United States Patent and Trademark Office
                  and in the jurisdictions where they are individually admitted. Nothing on this website
                  constitutes a representation that the Firm is authorized to practice law in any other
                  jurisdiction.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">5. Accuracy of Information</h2>
                <p>
                  We strive to keep the information on this website accurate and current; however, we make
                  no representations or warranties of any kind, express or implied, about the completeness,
                  accuracy, reliability, or suitability of the information for any purpose. Any reliance you
                  place on such information is strictly at your own risk.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">6. Intellectual Property</h2>
                <p>
                  All content on this website — including text, graphics, logos, and images — is the
                  property of Zilka-Kotab PC or its content suppliers and is protected by applicable
                  intellectual property laws. You may not reproduce, distribute, or create derivative works
                  from any content on this site without our express written permission.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">7. Limitation of Liability</h2>
                <p>
                  To the fullest extent permitted by law, Zilka-Kotab PC shall not be liable for any
                  indirect, incidental, special, or consequential damages arising out of or in connection
                  with your use of, or inability to use, this website or its content.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">8. Third-Party Links</h2>
                <p>
                  This website may contain links to third-party websites for convenience. Zilka-Kotab PC
                  does not endorse and is not responsible for the content, accuracy, or practices of any
                  third-party sites.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">9. Governing Law</h2>
                <p>
                  These Terms of Use are governed by the laws of the State of California, without regard to
                  its conflict of law provisions. Any disputes arising under these terms shall be subject to
                  the exclusive jurisdiction of the courts located in Santa Clara County, California.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">10. Changes to These Terms</h2>
                <p>
                  We reserve the right to modify these Terms of Use at any time. Changes will be effective
                  immediately upon posting to the website. Your continued use of the site after any changes
                  constitutes your acceptance of the updated terms.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-display font-semibold text-foreground mb-3">11. Contact</h2>
                <p>Questions regarding these terms may be directed to:</p>
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
