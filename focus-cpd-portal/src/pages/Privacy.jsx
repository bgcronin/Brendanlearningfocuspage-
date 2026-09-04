import useDocumentHead from '../lib/useDocumentHead'

/**
 * Privacy policy for the Focus Vision CPD Portal.
 * Reviewed content should be confirmed with your legal adviser before launch —
 * this page reflects what the portal actually collects and does as built.
 */

const Section = ({ title, children }) => (
  <section className="mt-8">
    <h2 className="text-lg font-semibold text-navy">{title}</h2>
    <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
  </section>
)

export default function Privacy() {
  useDocumentHead({ title: 'Privacy policy', description: 'How the Focus Vision CPD Portal collects, uses and protects your personal information.' })
  return (
    <div className="mx-auto max-w-3xl">
      <div className="card p-8 sm:p-10">
        <h1 className="text-3xl font-semibold text-navy">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-400">Focus Vision CPD Portal · Last updated 5 July 2026</p>

        <p className="mt-6 text-sm leading-relaxed text-slate-600">
          This policy explains how Focus Vision Clinic (&quot;we&quot;, &quot;us&quot;) collects, uses, stores and
          discloses personal information through the Focus Vision CPD Portal (the &quot;Portal&quot;), in accordance
          with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).
        </p>

        <Section title="What we collect">
          <p>When you create an account we collect your full name, email address, practice name, and — optionally — your AHPRA registration number. Your password is stored only as a secure cryptographic hash; we never see or store it in plain text.</p>
          <p>As you use the Portal we record your course activity: quiz attempts and answers, scores, course completions, certificates issued to you, and any learning reflections you choose to write.</p>
          <p>We do not collect health information about you, and the Portal does not involve patient information of any kind.</p>
        </Section>

        <Section title="Why we collect it">
          <p>We use your information to operate your CPD account: delivering courses, grading quizzes, issuing and emailing CPD certificates in your name, maintaining your permanent CPD record, and verifying certificates. Your AHPRA number, if provided, appears in our completion records to assist with CPD auditing.</p>
          <p>We may email you about your account and your certificates. We do not sell your personal information, and the Portal does not display advertising.</p>
        </Section>

        <Section title="Certificate verification">
          <p>Anyone who has a certificate ID can use the public verification page to confirm that certificate is genuine. Verification displays the certificate holder&apos;s name, the course title, CPD hours (including whether they are therapeutic hours), the completion date, and whether the certificate has been revoked. It is not possible to browse or search certificates without knowing the specific certificate ID.</p>
        </Section>

        <Section title="Who can see your information">
          <p>Focus Vision staff who administer the Portal can view your profile details, course activity, scores, reflections and certificates. Other Portal users cannot see your information.</p>
          <p>We use trusted service providers to run the Portal: Supabase (database, authentication and file storage), Netlify (hosting), and Resend (email delivery). These providers process your information on our behalf and may store it on servers located outside Australia, including in the United States. We take reasonable steps to ensure they handle it consistently with the APPs.</p>
          <p>We do not otherwise disclose your personal information unless required or authorised by law.</p>
        </Section>

        <Section title="How long we keep it">
          <p>CPD records exist to be permanent: your completions, scores and certificates are retained indefinitely so that your CPD history remains verifiable — AHPRA requires practitioners to keep CPD evidence for at least five years. If you ask us to delete your account, we will remove your profile and login; we may retain completion and certificate records where needed to preserve the integrity of issued certificates, or de-identify them where deletion is appropriate.</p>
        </Section>

        <Section title="Security">
          <p>Your data is protected by authenticated access controls enforced at the database level (row-level security), encrypted connections (HTTPS), and hashed passwords. Certificates are stored in private storage accessible only to you and Portal administrators. No system is perfectly secure, but we take reasonable steps to protect your information from misuse, loss and unauthorised access.</p>
        </Section>

        <Section title="Cookies and tracking">
          <p>The Portal stores an authentication token in your browser so you stay signed in. We do not use advertising cookies or third-party tracking.</p>
        </Section>

        <Section title="Access, correction and complaints">
          <p>You can view and correct your name, practice name and AHPRA number at any time from the Profile page, and download your certificates from My CPD Record. For other access or correction requests, to change your email address, or to delete your account, contact us at <a href="mailto:cpd@focusvision.com.au" className="font-semibold text-teal hover:underline">cpd@focusvision.com.au</a> or write to Focus Vision Clinic, 87 Ipswich Road, Woolloongabba QLD.</p>
          <p>If you believe we have mishandled your personal information, please contact us first so we can try to resolve it. You may also complain to the Office of the Australian Information Commissioner (OAIC) at <a href="https://www.oaic.gov.au" target="_blank" rel="noreferrer" className="font-semibold text-teal hover:underline">oaic.gov.au</a>.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>We may update this policy from time to time. The current version will always be available on this page, with the date of the last update shown above.</p>
        </Section>
      </div>
    </div>
  )
}
