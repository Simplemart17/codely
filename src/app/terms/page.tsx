import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LegalPage,
  LegalSection,
  LegalList,
  LEGAL_CONTACT_EMAIL,
} from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Service - Codely',
  description:
    'The terms and conditions that govern your use of the Codely collaborative coding education platform.',
};

const LAST_UPDATED = 'July 16, 2026';

export default function TermsOfServicePage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <p className="text-sm leading-relaxed text-muted-foreground">
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
        use of Codely (the &ldquo;Service&rdquo;). By creating an account or using
        the Service, you agree to be bound by these Terms. If you do not agree,
        do not use the Service.
      </p>

      <LegalSection id="eligibility" title="1. Eligibility">
        <p>
          You must be at least 13 years old (or the minimum age of digital
          consent in your jurisdiction) to use the Service. By using the Service,
          you represent that you meet this requirement and that any information
          you provide is accurate and current.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="2. Accounts and Authentication">
        <p>
          You can create an account using Google Sign-In or the other methods we
          offer. You are responsible for the activity that occurs under your
          account and for keeping your credentials and connected accounts secure.
          Notify us promptly of any unauthorized use. We may suspend or terminate
          accounts that violate these Terms.
        </p>
      </LegalSection>

      <LegalSection id="acceptable-use" title="3. Acceptable Use">
        <p>You agree not to:</p>
        <LegalList
          items={[
            'Use the Service for any unlawful, harmful, or fraudulent purpose.',
            'Upload or share content that infringes intellectual property or privacy rights, or that is malicious, abusive, or unlawful.',
            'Attempt to gain unauthorized access to the Service, other accounts, or our systems.',
            'Interfere with, disrupt, or place undue load on the Service or its infrastructure.',
            'Reverse engineer or misuse the Service except as permitted by law.',
          ]}
        />
      </LegalSection>

      <LegalSection id="user-content" title="4. Your Content">
        <p>
          You retain ownership of the code, sessions, and other content you
          create with the Service (&ldquo;User Content&rdquo;). You grant Codely a
          limited, non-exclusive license to host, store, process, and display
          your User Content solely to operate and improve the Service, including
          syncing it in real time to other participants in your sessions and, at
          your request, generating AI-assisted lesson notes. You are responsible
          for your User Content and confirm you have the rights necessary to
          share it.
        </p>
      </LegalSection>

      <LegalSection id="ai-features" title="5. AI-Assisted Features">
        <p>
          The Service may offer AI-generated content, such as lesson notes.
          AI output can be inaccurate or incomplete and is provided for
          convenience only. You are responsible for reviewing and verifying any
          AI-generated content before relying on it.
        </p>
      </LegalSection>

      <LegalSection id="intellectual-property" title="6. Our Intellectual Property">
        <p>
          The Service, including its software, design, and branding, is owned by
          Codely and protected by intellectual property laws. Except for the
          rights expressly granted to you, we reserve all rights in and to the
          Service. You may not use our name or logo without our permission.
        </p>
      </LegalSection>

      <LegalSection id="third-party" title="7. Third-Party Services">
        <p>
          The Service integrates with third-party providers, such as Google for
          authentication. Your use of those services is governed by their own
          terms and privacy policies, and we are not responsible for them.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="8. Termination">
        <p>
          You may stop using the Service and delete your account at any time. We
          may suspend or terminate your access if you violate these Terms or if
          we discontinue the Service. Upon termination, the rights granted to you
          under these Terms will end, though provisions that by their nature
          should survive will remain in effect.
        </p>
      </LegalSection>

      <LegalSection id="disclaimer" title="9. Disclaimer of Warranties">
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as
          available,&rdquo; without warranties of any kind, whether express or
          implied, including warranties of merchantability, fitness for a
          particular purpose, and non-infringement. We do not warrant that the
          Service will be uninterrupted, secure, or error-free.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="10. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, Codely will not be liable for
          any indirect, incidental, special, consequential, or punitive damages,
          or for any loss of data, profits, or goodwill, arising out of or
          related to your use of the Service.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" title="11. Governing Law">
        <p>
          These Terms are governed by the laws of the Province of Ontario and the
          federal laws of Canada applicable therein, without regard to conflict
          of law principles. You agree to the exclusive jurisdiction of the
          courts located in Ontario, Canada for any dispute arising out of or
          relating to these Terms or the Service.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="12. Changes to These Terms">
        <p>
          We may update these Terms from time to time. When we do, we will revise
          the &ldquo;Last updated&rdquo; date above and, for material changes,
          provide additional notice where appropriate. Your continued use of the
          Service after changes take effect constitutes acceptance of the updated
          Terms.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="13. Contact Us">
        <p>
          If you have questions about these Terms, contact us at{' '}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
        <p>
          See also our{' '}
          <Link
            href="/privacy"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
