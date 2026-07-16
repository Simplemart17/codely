import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LegalPage,
  LegalSection,
  LegalList,
  LEGAL_CONTACT_EMAIL,
} from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy - Codely',
  description:
    'How Codely collects, uses, and protects your personal information, including data received through Google Sign-In.',
};

const LAST_UPDATED = 'July 16, 2026';

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p className="text-sm leading-relaxed text-muted-foreground">
        This Privacy Policy explains how Codely (&ldquo;Codely&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) collects, uses,
        and safeguards your information when you use our collaborative coding
        education platform (the &ldquo;Service&rdquo;). By using the Service, you
        agree to the practices described in this policy.
      </p>

      <LegalSection id="information-we-collect" title="1. Information We Collect">
        <p>We collect the following categories of information:</p>
        <LegalList
          items={[
            <>
              <strong className="text-foreground">
                Account information from Google Sign-In.
              </strong>{' '}
              When you choose to sign in with Google, we receive your name, email
              address, profile picture, and Google account identifier, as
              permitted by the scopes you approve on Google&rsquo;s consent
              screen. We use this to create and secure your account.
            </>,
            <>
              <strong className="text-foreground">Profile information.</strong>{' '}
              Details you provide directly, such as your display name and your
              role (instructor or learner).
            </>,
            <>
              <strong className="text-foreground">Content you create.</strong>{' '}
              Code, coding sessions, snapshots, and related materials you author
              or collaborate on within the Service.
            </>,
            <>
              <strong className="text-foreground">Usage data.</strong>{' '}
              Technical information such as log data, device and browser type,
              and aggregate analytics about how the Service is used.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection id="how-we-use" title="2. How We Use Your Information">
        <p>We use the information we collect to:</p>
        <LegalList
          items={[
            'Authenticate you and create, maintain, and secure your account.',
            'Provide, operate, and improve the collaborative coding features of the Service.',
            'Display your name and profile picture to other participants in sessions you join.',
            'Generate AI-assisted lesson notes from session content, where you request that feature.',
            'Communicate with you about the Service, including security and support notices.',
            'Detect, prevent, and address fraud, abuse, and technical issues.',
          ]}
        />
      </LegalSection>

      <LegalSection
        id="google-user-data"
        title="3. Google User Data and Limited Use"
      >
        <p>
          Codely&rsquo;s use and transfer of information received from Google
          APIs adheres to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Google API Services User Data Policy
          </a>
          , including its Limited Use requirements. Specifically:
        </p>
        <LegalList
          items={[
            'We only request the minimum Google account scopes needed to sign you in and set up your profile.',
            'We use Google user data solely to provide and improve the features described in this policy.',
            'We do not sell Google user data, and we do not transfer it to third parties except as needed to provide the Service, comply with the law, or as part of a merger or acquisition.',
            'We do not use Google user data for advertising, and we do not allow humans to read it except with your consent, for security or legal reasons, or where the data has been aggregated and anonymized.',
          ]}
        />
      </LegalSection>

      <LegalSection id="how-we-share" title="4. How We Share Information">
        <p>
          We do not sell your personal information. We share it only with service
          providers who process data on our behalf so that we can operate the
          Service, including:
        </p>
        <LegalList
          items={[
            <>
              <strong className="text-foreground">Authentication</strong> —
              our identity provider manages sign-in and account credentials.
            </>,
            <>
              <strong className="text-foreground">Database and hosting</strong>{' '}
              — infrastructure providers store your account data and content and
              serve the application.
            </>,
            <>
              <strong className="text-foreground">AI processing</strong> —
              where you use AI lesson notes, the relevant session content is sent
              to our AI provider to generate the notes.
            </>,
            <>
              <strong className="text-foreground">Other participants</strong> —
              your display name, profile picture, and the content you contribute
              are visible to others in the same session.
            </>,
          ]}
        />
        <p>
          We may also disclose information if required by law or to protect the
          rights, safety, and security of Codely, our users, or the public.
        </p>
      </LegalSection>

      <LegalSection id="data-retention" title="5. Data Retention">
        <p>
          We retain your personal information for as long as your account is
          active or as needed to provide the Service. When you delete your
          account, we delete or anonymize your personal information within a
          reasonable period, except where we are required to retain it for legal,
          security, or accounting purposes.
        </p>
      </LegalSection>

      <LegalSection id="your-rights" title="6. Your Rights and Choices">
        <p>
          Depending on your location, you may have the right to access, correct,
          export, or delete your personal information, and to withdraw consent.
          You can update your profile in the app, revoke Google access at any
          time from your{' '}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Google Account permissions
          </a>
          , or contact us to exercise these rights.
        </p>
      </LegalSection>

      <LegalSection id="security" title="7. Data Security">
        <p>
          We use industry-standard technical and organizational measures,
          including encryption in transit and access controls, to protect your
          information. No method of transmission or storage is completely secure,
          however, and we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="8. Cookies">
        <p>
          We use cookies and similar technologies that are necessary to keep you
          signed in and to operate the Service, along with privacy-respecting
          analytics to understand aggregate usage. You can control cookies
          through your browser settings, though disabling essential cookies may
          affect functionality.
        </p>
      </LegalSection>

      <LegalSection id="children" title="9. Children&rsquo;s Privacy">
        <p>
          The Service is not directed to children under 13 (or the minimum age
          required in your jurisdiction), and we do not knowingly collect their
          personal information. If you believe a child has provided us with
          personal information, please contact us so we can remove it.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="10. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we will
          revise the &ldquo;Last updated&rdquo; date above and, for material
          changes, provide additional notice where appropriate. Your continued
          use of the Service after changes take effect constitutes acceptance of
          the updated policy.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="11. Contact Us">
        <p>
          If you have questions about this Privacy Policy or how we handle your
          information, contact us at{' '}
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
            href="/terms"
            className="text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
