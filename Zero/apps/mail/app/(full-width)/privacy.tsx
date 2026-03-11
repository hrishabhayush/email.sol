import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Github, Mail, ArrowLeft, Link2 } from 'lucide-react';
import { Navigation } from '@/components/navigation';
import { Button } from '@/components/ui/button';
import Footer from '@/components/home/footer';
import { createSectionId } from '@/lib/utils';


const LAST_UPDATED = 'March 11, 2026';

export default function PrivacyPolicy() {
  const { copiedValue: copiedSection, copyToClipboard } = useCopyToClipboard();

  const handleCopyLink = (sectionId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${sectionId}`;
    copyToClipboard(url, sectionId);
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-auto bg-white dark:bg-[#111111]">
      <Navigation />
      <div className="relative z-10 flex grow flex-col">
        <div className="absolute right-4 top-6 md:left-8 md:right-auto md:top-8">
          <a href="/">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-gray-600 hover:text-gray-900 dark:text-white dark:hover:text-white/80"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </a>
        </div>

        <div className="container mx-auto max-w-4xl px-4 py-16">
          <Card className="overflow-hidden rounded-xl border-none bg-gray-50/80 dark:bg-transparent">
            <CardHeader className="space-y-4 px-8 py-8">
              <div className="space-y-2 text-center">
                <CardTitle className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl dark:text-white">
                  Privacy Policy
                </CardTitle>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-sm text-gray-500 dark:text-white/60">
                    Last updated: {LAST_UPDATED}
                  </p>
                </div>
              </div>
            </CardHeader>

            <div className="space-y-8 p-8">
              {sections.map((section) => {
                const sectionId = createSectionId(section.title);
                return (
                  <div key={section.title} id={sectionId} className="p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
                        {section.title}
                      </h2>
                      <button
                        onClick={() => handleCopyLink(sectionId)}
                        className="text-gray-400 transition-all hover:text-gray-700 dark:text-white/60 dark:hover:text-white/80"
                        aria-label={`Copy link to ${section.title} section`}
                      >
                        <Link2
                          className={`h-4 w-4 ${copiedSection === sectionId ? 'text-green-500 dark:text-green-400' : ''}`}
                        />
                      </button>
                    </div>
                    <div className="prose prose-sm prose-a:text-blue-600 hover:prose-a:text-blue-800 dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 max-w-none text-gray-600 dark:text-white/80">
                      {section.content}
                    </div>
                  </div>
                );
              })}

              <div className="mt-12 flex flex-wrap items-center justify-center gap-4"></div>
            </div>
          </Card>
        </div>

        <Footer />
      </div>
    </div>
  );
}

const sections = [
  {
    title: 'Our Commitment to Privacy',
    content: (
      <div className="space-y-4">
        <p>
          At SolMail, we believe that privacy is a fundamental right. Built on the open-source Zero
          email framework, SolMail is designed with privacy at its core, and we&apos;re committed to
          being transparent about how we handle your data.
        </p>
        <p className="font-semibold">
          Important: SolMail is a client-only email application. We DO NOT store your emails on our
          servers. All email data is processed directly between your browser and Gmail.
        </p>
        <p>Our verified privacy commitments:</p>
        <ul className="ml-4 list-disc space-y-2">
          <li>
            Zero Email Storage: We never store your emails - they remain in your Gmail account
          </li>
          <li>Client-Side Processing: All email processing happens in your browser</li>
          <li>Open Source: Our codebase is public and can be audited</li>
          <li>Minimal Data: We only request essential Gmail API permissions</li>
          <li>User Control: You can revoke our access to your Gmail at any time</li>
          <li>
            Wallet Privacy: Your Solana wallet address is only used for processing micropayments and
            is never shared with third parties
          </li>
        </ul>
      </div>
    ),
  },
  {
    title: 'Google Account Integration',
    content: (
      <>
        <p className="mb-4">When you use SolMail with your Google Account:</p>
        <ul className="ml-4 list-disc space-y-2">
          <li>We request access to your Gmail data only after receiving your explicit consent</li>
          <li>We access only the necessary Gmail API scopes required for email functionality</li>
          <li>We use secure OAuth 2.0 authentication provided by Google</li>
          <li>
            You can revoke our access to your Google account at any time through your Google Account
            settings
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Micropayments and Solana Wallet Data',
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-lg font-medium">How Micropayments Work</h3>
          <p className="mb-3">
            SolMail uses a pay-for-success model where micropayments are sent upfront with cold
            emails and refunded if replies aren&apos;t meaningful. Here&apos;s how we handle your
            financial data:
          </p>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              We store your connected Solana wallet address to facilitate micropayment transactions
            </li>
            <li>We never have access to your wallet&apos;s private keys or seed phrase</li>
            <li>
              Transaction records are stored on the Solana blockchain and are publicly visible by
              nature of the blockchain
            </li>
            <li>
              We maintain a record of micropayment transactions (amounts, sender, recipient, status)
              for refund processing
            </li>
            <li>
              AI-based reply analysis to determine refund eligibility does not store or log email
              content permanently
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">What We Do NOT Do With Your Wallet</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>We never initiate transactions without your explicit approval</li>
            <li>We never share your wallet address with advertisers or data brokers</li>
            <li>We never access tokens or assets beyond what is needed for SolMail micropayments</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: 'Data Collection and Usage',
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-lg font-medium">Google Services Data Handling</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>Email data is processed in accordance with Google API Services User Data Policy</li>
            <li>
              We only process and display email data - we don&apos;t store copies of your emails
            </li>
            <li>
              All data transmission between our service and Google is encrypted using
              industry-standard TLS 1.3 protocols
            </li>
            <li>
              We maintain limited temporary caches only as necessary for application functionality,
              with a maximum retention period of 24 hours
            </li>
            <li>Cached data is encrypted at rest using AES-256 encryption</li>
            <li>
              We collect basic usage analytics (page views, feature usage) to improve the service,
              but this data is anonymized
            </li>
            <li>Error logs are retained for 30 days to help diagnose and fix issues</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">AI Processing</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              SolMail uses AI to analyze email replies for the micropayment refund system
            </li>
            <li>
              AI processing is performed in real-time and email content is not stored after analysis
            </li>
            <li>AI-generated drafts are created client-side and not logged on our servers</li>
            <li>We do not use your email content to train AI models</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Data Processing Locations</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>All data processing occurs in secure data centers in the United States</li>
            <li>We comply with international data transfer regulations</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: 'Data Protection and Security',
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-lg font-medium">Security Measures</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              End-to-end encryption for all email communications using industry-standard protocols
            </li>
            <li>
              Secure OAuth 2.0 authentication for Google services with strict scope limitations
            </li>
            <li>Open-source codebase for transparency and community security review</li>
            <li>Compliance with Google API Services User Data Policy and security requirements</li>
            <li>Automated security patches and dependency updates</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Blockchain Security</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              All micropayment transactions are secured by the Solana blockchain
            </li>
            <li>Wallet connections use industry-standard protocols (Wallet Adapter)</li>
            <li>Transaction signing always requires explicit user approval</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: 'Google User Data Handling',
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-lg font-medium">Data Access and Usage</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              We access the following Google user data through the Gmail API:
              <ul className="ml-4 mt-2 list-disc space-y-1">
                <li>Email content and attachments</li>
                <li>Email metadata (subject, dates, recipients)</li>
                <li>Labels and folder structure</li>
                <li>Basic profile information</li>
              </ul>
            </li>
            <li>
              This data is used exclusively for providing email functionality within SolMail
            </li>
            <li>No Google user data is used for advertising, marketing, or profiling purposes</li>
            <li>Access to user data is strictly limited to essential personnel</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Data Sharing and Transfer</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              Google user data is never shared with third parties except as required for core
              service functionality
            </li>
            <li>
              When necessary, we only work with service providers who comply with Google API
              Services User Data Policy
            </li>
            <li>All service providers are bound by strict confidentiality agreements</li>
            <li>Users are notified of any material changes to our data sharing practices</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Data Retention and Deletion</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>Email data is processed in real-time and not permanently stored</li>
            <li>Temporary caches are automatically cleared after 24 hours</li>
            <li>Users can request immediate deletion of their cached data</li>
            <li>
              Account deletion process:
              <ul className="ml-4 mt-2 list-disc space-y-1">
                <li>All user data is immediately marked for deletion</li>
                <li>Cached data is purged within 24 hours</li>
                <li>Micropayment transaction history is retained on-chain (immutable)</li>
                <li>Off-chain transaction metadata is deleted within 30 days</li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: 'Limited Use Disclosure',
    content: (
      <div>
        Our use and transfer to any other app of information received from Google APIs will adhere
        to the{' '}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
          <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
        , including the Limited Use requirements.
      </div>
    ),
  },
  {
    title: 'Your Rights and Controls',
    content: (
      <ul className="ml-4 list-disc space-y-2">
        <li>Right to revoke access to your Google account at any time</li>
        <li>Right to disconnect your Solana wallet at any time</li>
        <li>Right to request deletion of any cached data</li>
        <li>Right to export your data</li>
        <li>Right to lodge complaints about data handling</li>
      </ul>
    ),
  },
  {
    title: 'Contact',
    content: (
      <div className="space-y-3">
        <p>For privacy-related questions or concerns:</p>
        <div className="flex flex-col space-y-2">
          <a
            href="mailto:solmailxyz@gmail.com"
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <Mail className="mr-2 h-4 w-4" />
            solmailxyz@gmail.com
          </a>
          <a
            href="https://github.com/hrishabhayush/email.sol"
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <Github className="mr-2 h-4 w-4" />
            Open an issue on GitHub
          </a>
        </div>
      </div>
    ),
  },
  {
    title: 'Updates to This Policy',
    content: (
      <p>
        We may update this privacy policy from time to time. We will notify users of any material
        changes through our application or website.
      </p>
    ),
  },
];
