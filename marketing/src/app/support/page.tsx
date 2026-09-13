import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { SupportContactForm } from "@/components/support/SupportContactForm";

export const metadata: Metadata = {
  title: "Support | smelter",
  description: "Customer support, technical assistance, and developer contact for smelter.",
};

export default function SupportPage() {
  return (
    <LegalPage title="Support">
      <p>
        smelter is a workplace service used by authorized restaurant teams.
        The fastest path to help depends on what you need.
      </p>

      {/* Interactive Contact Support Form & Direct Email */}
      <SupportContactForm />

      <LegalSection title="Account and access">
        <p>
          Invites, PINs, passwords, locations, and module access are managed by
          your organization. If you cannot sign in, lost your invite link,
          or need your access changed, contact your manager. They can reset
          credentials and reissue invites directly from the app.
        </p>
      </LegalSection>

      <LegalSection title="App problems">
        <p>
          If something is not working, first make sure you are on the
          latest version of the app from the App Store, then close and reopen
          it. Most sync issues resolve once the device is back on a stable
          internet connection.
        </p>
      </LegalSection>

      <LegalSection title="Contact the developer">
        <p>
          For technical issues that persist, bug reports, or anything a manager
          cannot resolve, reach the developer team using the form above or by
          emailing{" "}
          <a
            href="mailto:support@smelterpos.com"
            className="font-bold text-ink underline hover:text-accent transition-colors"
          >
            support@smelterpos.com
          </a>
          . Please include your restaurant name, the screen you were on, and what
          you expected to happen so our engineering team can diagnose and fix the
          issue promptly.
        </p>
      </LegalSection>

      <LegalSection title="Data privacy and account deletion">
        <p>
          In accordance with Apple App Store guidelines, users have the right to
          request access to, correction of, or deletion of their personal data.
          To submit a data deletion or account removal request, email{" "}
          <a
            href="mailto:support@smelterpos.com?subject=Data%20Deletion%20Request"
            className="font-bold text-ink underline hover:text-accent transition-colors"
          >
            support@smelterpos.com
          </a>{" "}
          with the subject line &ldquo;Data Deletion Request&rdquo;. We will confirm
          and process your request in accordance with applicable laws.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
