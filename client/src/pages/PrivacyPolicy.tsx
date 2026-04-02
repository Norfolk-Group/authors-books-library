/**
 * PrivacyPolicy.tsx
 *
 * Public-facing privacy policy page for the NCG Library application.
 * Accessible at /privacy — no authentication required.
 * Linked from the main page footer and the Dropbox OAuth consent screen.
 */

import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const LAST_UPDATED = "April 2, 2026";
const CONTACT_EMAIL = "privacy@cidale.com";
const APP_NAME = "NCG Library";
const COMPANY_NAME = "Cidale Consulting Group";
const COMPANY_WEBSITE = "https://cidale.com";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/">
            <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Library
            </button>
          </Link>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm font-medium">{APP_NAME} — Privacy Policy</span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        {/* Title block */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <Section title="1. Introduction">
          <p>
            {APP_NAME} is a private digital library application operated by{" "}
            <strong>{COMPANY_NAME}</strong> ("{COMPANY_NAME}", "we", "our", or "us"). This Privacy
            Policy explains what information we collect, how we use it, and the choices you have
            regarding your personal data when you use the {APP_NAME} application (the "Service").
          </p>
          <p>
            By accessing or using the Service, you agree to the collection and use of information
            described in this policy. If you do not agree, please discontinue use of the Service.
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <SubSection title="2.1 Account Information">
            <p>
              When you authenticate with the Service via Manus OAuth, we receive your name, email
              address, and a unique user identifier from the OAuth provider. This information is
              stored in our database solely to identify your session and personalise your experience.
            </p>
          </SubSection>
          <SubSection title="2.2 Usage Data">
            <p>
              We collect anonymised usage analytics (page views, session duration, feature
              interactions) through a self-hosted analytics service. This data does not contain
              personally identifiable information and is used exclusively to improve the Service.
            </p>
          </SubSection>
          <SubSection title="2.3 Third-Party Integrations">
            <p>
              The Service integrates with the following third-party services on your behalf. Each
              integration is optional and requires your explicit authorisation:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>
                <strong>Dropbox</strong> — used to sync library content files to your Dropbox
                account. We store an OAuth 2 refresh token in our database to maintain the
                connection. We do not read, modify, or delete files in your Dropbox account beyond
                the folders you explicitly configure for sync.
              </li>
              <li>
                <strong>Google Drive</strong> — used to read author and book content folders that
                you have shared with the Service. We do not store Google Drive credentials; access
                is mediated through the Google Drive API using service account credentials.
              </li>
            </ul>
          </SubSection>
          <SubSection title="2.4 Content Data">
            <p>
              Author profiles, book metadata, and enrichment data (biographies, cover images, links)
              generated or fetched by the Service are stored in our database. This content is derived
              from publicly available sources (Wikipedia, Google Books, Perplexity) and is used
              solely to power the library experience.
            </p>
          </SubSection>
        </Section>

        <Section title="3. How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Authenticate you and maintain your session.</li>
            <li>Personalise your library experience (saved preferences, theme settings, favourites).</li>
            <li>Sync library content to your connected cloud storage accounts (Dropbox, Google Drive).</li>
            <li>Generate AI-powered author summaries and book insights using your stored content.</li>
            <li>Improve the Service through anonymised usage analytics.</li>
            <li>Communicate with you about important Service updates (if you have opted in).</li>
          </ul>
          <p>
            We do not sell, rent, or share your personal information with third parties for
            marketing purposes.
          </p>
        </Section>

        <Section title="4. Data Storage and Security">
          <p>
            Your data is stored in a managed MySQL database hosted on TiDB Cloud. File assets
            (author photos, book covers, RAG documents) are stored in an S3-compatible object store.
            Both services employ encryption at rest and in transit (TLS 1.2+).
          </p>
          <p>
            Access to the database and storage is restricted to authorised application servers and
            administrators. We implement industry-standard security practices including JWT-signed
            session cookies, parameterised SQL queries, and regular dependency audits.
          </p>
          <p>
            Despite these measures, no method of electronic transmission or storage is 100% secure.
            We cannot guarantee absolute security and encourage you to use strong, unique passwords
            for your connected accounts.
          </p>
        </Section>

        <Section title="5. Data Retention">
          <p>
            We retain your account information and preferences for as long as your account is active.
            If you request deletion of your account, we will remove your personal data within 30 days,
            except where retention is required by law or legitimate business interest.
          </p>
          <p>
            Anonymised analytics data may be retained indefinitely as it cannot be linked back to
            any individual.
          </p>
        </Section>

        <Section title="6. Third-Party Services">
          <p>
            The Service uses the following third-party APIs and services. Each is governed by its
            own privacy policy:
          </p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-semibold">Service</th>
                <th className="text-left py-2 font-semibold">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["Dropbox", "Cloud file sync"],
                ["Google Drive / Google Books API", "Content source & book metadata"],
                ["Wikipedia / Wikidata", "Author biographies & metadata"],
                ["Perplexity AI", "Author research & enrichment"],
                ["Anthropic Claude", "AI-generated author summaries (Digital Me)"],
                ["Google Gemini", "Image analysis & avatar generation"],
                ["Replicate (Flux)", "AI portrait generation"],
                ["Apify", "Web scraping for book covers & author photos"],
                ["Manus OAuth", "User authentication"],
              ].map(([service, purpose]) => (
                <tr key={service}>
                  <td className="py-2 pr-4 font-medium">{service}</td>
                  <td className="py-2 text-muted-foreground">{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="7. Your Rights">
          <p>
            Depending on your jurisdiction, you may have the following rights regarding your personal
            data:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>Access</strong> — request a copy of the personal data we hold about you.</li>
            <li><strong>Correction</strong> — request correction of inaccurate or incomplete data.</li>
            <li><strong>Deletion</strong> — request deletion of your personal data ("right to be forgotten").</li>
            <li><strong>Portability</strong> — request your data in a machine-readable format.</li>
            <li><strong>Objection</strong> — object to certain types of processing (e.g., analytics).</li>
          </ul>
          <p>
            To exercise any of these rights, please contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>
            . We will respond within 30 days.
          </p>
        </Section>

        <Section title="8. Cookies">
          <p>
            The Service uses a single session cookie (<code className="text-xs bg-muted px-1 py-0.5 rounded">ncg_session</code>)
            to maintain your authenticated session. This cookie is HTTP-only, Secure, and
            SameSite=Lax. It does not track you across other websites.
          </p>
          <p>
            We do not use advertising cookies, tracking pixels, or third-party analytics cookies.
          </p>
        </Section>

        <Section title="9. Children's Privacy">
          <p>
            The Service is not directed to children under the age of 13. We do not knowingly collect
            personal information from children. If you believe a child has provided us with personal
            information, please contact us and we will delete it promptly.
          </p>
        </Section>

        <Section title="10. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. When we do, we will update the
            "Last updated" date at the top of this page. Continued use of the Service after changes
            are posted constitutes your acceptance of the revised policy.
          </p>
        </Section>

        <Section title="11. Contact Us">
          <p>
            If you have questions, concerns, or requests regarding this Privacy Policy, please
            contact us:
          </p>
          <address className="not-italic text-sm space-y-1">
            <div><strong>{COMPANY_NAME}</strong></div>
            <div>
              Email:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>
            </div>
            <div>
              Website:{" "}
              <a href={COMPANY_WEBSITE} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                {COMPANY_WEBSITE}
              </a>
            </div>
          </address>
        </Section>

        {/* Footer */}
        <footer className="pt-8 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
          <span>© {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.</span>
          <Link href="/">
            <span className="hover:text-foreground transition-colors cursor-pointer">← Back to {APP_NAME}</span>
          </Link>
        </footer>
      </main>
    </div>
  );
}

// ── Helper components ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight border-b border-border pb-2">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-medium">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
