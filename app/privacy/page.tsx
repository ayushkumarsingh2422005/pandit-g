import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Pandit G",
  description:
    "Privacy Policy for Pandit G WhatsApp astrology consultation service. Learn how we collect, use, and protect your information.",
};

const LAST_UPDATED = "March 15, 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-gray-950 px-6 py-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white">
            Pandit <span className="text-coral">G</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-400 transition-colors hover:text-white"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-gray mt-10 max-w-none space-y-8 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">1. Introduction</h2>
            <p className="mt-3 leading-relaxed">
              Pandit G (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) provides Vedic
              astrology consultation services through our website and WhatsApp Business
              platform. This Privacy Policy explains how we collect, use, store, and
              protect your personal information when you use our services, including
              messaging us on WhatsApp.
            </p>
            <p className="mt-3 leading-relaxed">
              By using our website or contacting us on WhatsApp, you agree to the
              collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              2. Information We Collect
            </h2>
            <p className="mt-3 leading-relaxed">
              We may collect the following types of information:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>Contact information:</strong> Your WhatsApp phone number, display
                name, and any contact details you voluntarily share during consultation.
              </li>
              <li>
                <strong>Messages and consultation data:</strong> Text messages, birth
                details (date, time, place), kundli-related information, questions about
                marriage, career, health, or other personal matters you share for
                astrological guidance.
              </li>
              <li>
                <strong>Payment information:</strong> Payment status, transaction
                references, and amounts processed through WhatsApp Payments or other
                approved payment methods. We do not store full card or bank credentials;
                payments are processed by third-party payment providers (e.g. Razorpay,
                PayU) in accordance with their privacy policies.
              </li>
              <li>
                <strong>Technical data:</strong> Message timestamps, delivery/read
                status, and webhook metadata received from the WhatsApp Business Platform
                operated by Meta.
              </li>
              <li>
                <strong>Website usage:</strong> Basic analytics such as pages visited,
                browser type, and device information when you browse our website.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              3. How We Use Your Information
            </h2>
            <p className="mt-3 leading-relaxed">We use your information to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Provide personalized Vedic astrology consultation and guidance</li>
              <li>Respond to your messages on WhatsApp</li>
              <li>Process consultation fees and payment confirmations</li>
              <li>Manage consultation sessions and billing (₹151 per 3 minutes)</li>
              <li>Improve our services and customer support</li>
              <li>Comply with legal obligations and prevent fraud or misuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              4. WhatsApp and Meta Platforms
            </h2>
            <p className="mt-3 leading-relaxed">
              Our service uses the{" "}
              <strong>WhatsApp Business Platform (Cloud API)</strong> provided by Meta
              Platforms, Inc. When you message us on WhatsApp:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                Your messages are transmitted through WhatsApp&apos;s infrastructure
                subject to{" "}
                <a
                  href="https://www.whatsapp.com/legal/privacy-policy-whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-coral hover:underline"
                >
                  WhatsApp&apos;s Privacy Policy
                </a>
              </li>
              <li>
                Meta may process certain data as described in{" "}
                <a
                  href="https://www.facebook.com/privacy/policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-coral hover:underline"
                >
                  Meta&apos;s Privacy Policy
                </a>
              </li>
              <li>
                We receive message content and metadata via webhooks solely to operate
                our consultation service
              </li>
            </ul>
            <p className="mt-3 leading-relaxed">
              We are not affiliated with Meta or WhatsApp beyond our use of their
              business messaging API.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              5. How We Share Your Information
            </h2>
            <p className="mt-3 leading-relaxed">
              We do not sell your personal information. We may share data only with:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>
                <strong>Service providers:</strong> Hosting (e.g. Vercel), payment
                gateways, and technology partners necessary to operate our service
              </li>
              <li>
                <strong>Meta / WhatsApp:</strong> As required to send and receive
                messages through the WhatsApp Business Platform
              </li>
              <li>
                <strong>Legal requirements:</strong> When required by law, court order,
                or to protect our rights and safety
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">6. Data Retention</h2>
            <p className="mt-3 leading-relaxed">
              We retain your consultation messages and related data only as long as
              necessary to provide our services, fulfill legal obligations, resolve
              disputes, and enforce our agreements. You may request deletion of your
              data by contacting us (see Section 10).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">7. Data Security</h2>
            <p className="mt-3 leading-relaxed">
              We implement reasonable technical and organizational measures to protect
              your information, including secure HTTPS connections and access controls.
              However, no method of transmission over the internet is 100% secure, and
              we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">8. Your Rights</h2>
            <p className="mt-3 leading-relaxed">
              Depending on applicable law, you may have the right to:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your data</li>
              <li>Withdraw consent where processing is consent-based</li>
              <li>Opt out of non-essential communications</li>
            </ul>
            <p className="mt-3 leading-relaxed">
              To exercise these rights, contact us using the details below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              9. Children&apos;s Privacy
            </h2>
            <p className="mt-3 leading-relaxed">
              Our services are not intended for individuals under 18 years of age. We do
              not knowingly collect personal information from children. If you believe a
              child has provided us with personal data, please contact us so we can
              delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              10. Contact Us
            </h2>
            <p className="mt-3 leading-relaxed">
              For privacy-related questions, data requests, or concerns, contact:
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <strong>Service:</strong> Pandit G
              </li>
              <li>
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:panditg@astro.com"
                  className="text-coral hover:underline"
                >
                  panditg@astro.com
                </a>
              </li>
              <li>
                <strong>WhatsApp:</strong> Message us on our official WhatsApp Business
                number used for consultations
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">
              11. Changes to This Policy
            </h2>
            <p className="mt-3 leading-relaxed">
              We may update this Privacy Policy from time to time. Changes will be
              posted on this page with an updated &quot;Last updated&quot; date. Continued
              use of our services after changes constitutes acceptance of the updated
              policy.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-gray-100 pt-8 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Pandit G. All rights reserved.</p>
          <p className="mt-2">
            Website developed by{" "}
            <a
              href="https://digicraft.one"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-coral"
            >
              DigiCraft
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
