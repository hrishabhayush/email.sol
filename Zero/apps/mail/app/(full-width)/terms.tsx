import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Github, Mail, ArrowLeft, Link2 } from 'lucide-react';
import { Navigation } from '@/components/navigation';
import { Button } from '@/components/ui/button';
import Footer from '@/components/home/footer';
import { createSectionId } from '@/lib/utils';

const LAST_UPDATED = 'March 12, 2026';

export default function TermsOfService() {
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
                  Terms of Service
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
    title: 'Acceptance of Terms',
    content: (
      <div className="space-y-4">
        <p>
          By accessing or using SolMail, you agree to be bound by these Terms of Service. If you do
          not agree to these terms, please do not use our service.
        </p>
        <p>
          SolMail is built on the open-source Zero email framework and provides a client-side email
          application with integrated Solana micropayments. These terms govern your use of the
          SolMail application and all related services.
        </p>
      </div>
    ),
  },
  {
    title: 'Description of Service',
    content: (
      <div className="space-y-4">
        <p>SolMail provides the following services:</p>
        <ul className="ml-4 list-disc space-y-2">
          <li>
            A client-side email interface that connects to your Gmail account via the Gmail API
          </li>
          <li>
            A micropayment system powered by the Solana blockchain, enabling pay-for-success cold
            email outreach
          </li>
          <li>AI-powered email drafting and reply analysis for micropayment refund eligibility</li>
          <li>Email management features including labeling, filtering, and organization</li>
        </ul>
        <p>
          SolMail is a client-only application. We do not store your emails on our servers. All email
          data is processed directly between your browser and Gmail.
        </p>
      </div>
    ),
  },
  {
    title: 'Account and Access',
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-lg font-medium">Google Account</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              You must authenticate with a valid Google account to use SolMail&apos;s email features
            </li>
            <li>
              You are responsible for maintaining the security of your Google account credentials
            </li>
            <li>You must not share your account access with unauthorized parties</li>
            <li>
              You may revoke SolMail&apos;s access to your Google account at any time through your
              Google Account settings
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Solana Wallet</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              Connecting a Solana wallet is optional but required for micropayment functionality
            </li>
            <li>
              You are solely responsible for the security of your wallet, including your private keys
              and seed phrase
            </li>
            <li>SolMail never has access to your wallet&apos;s private keys</li>
            <li>You may disconnect your wallet at any time</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: 'Micropayment System',
    content: (
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-lg font-medium">How It Works</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>
              Micropayments are sent upfront with cold emails as a signal of genuine intent
            </li>
            <li>
              Payments are held and refunded if the recipient does not provide a meaningful reply
            </li>
            <li>
              AI analysis is used to determine whether a reply qualifies as meaningful for refund
              purposes
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-lg font-medium">Transaction Terms</h3>
          <ul className="ml-4 list-disc space-y-2">
            <li>All transactions are processed on the Solana blockchain and are irreversible</li>
            <li>
              Transaction fees (Solana network fees) are your responsibility and are separate from
              micropayment amounts
            </li>
            <li>
              Refund eligibility is determined by our AI analysis system; decisions are provided in
              good faith but are not guaranteed to be perfect
            </li>
            <li>
              SolMail is not responsible for losses due to wallet misuse, incorrect addresses, or
              blockchain network issues
            </li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    title: 'Acceptable Use',
    content: (
      <div className="space-y-4">
        <p>You agree not to use SolMail to:</p>
        <ul className="ml-4 list-disc space-y-2">
          <li>Send spam, unsolicited bulk emails, or phishing attempts</li>
          <li>Harass, threaten, or abuse other users or email recipients</li>
          <li>Distribute malware, viruses, or other harmful content</li>
          <li>Violate any applicable laws or regulations</li>
          <li>Attempt to bypass or manipulate the micropayment or refund system</li>
          <li>
            Use automated tools or scripts to send emails in a manner that violates Gmail&apos;s
            terms of service
          </li>
          <li>Impersonate any person or entity</li>
          <li>Infringe on the intellectual property rights of others</li>
        </ul>
        <p>
          Violation of these terms may result in suspension or termination of your access to SolMail.
        </p>
      </div>
    ),
  },
  {
    title: 'Intellectual Property',
    content: (
      <div className="space-y-4">
        <p>
          SolMail is built on the open-source Zero email framework. The SolMail application and its
          original content, features, and functionality are owned by SolMail and are protected by
          applicable intellectual property laws.
        </p>
        <p>
          The open-source components of SolMail are licensed under their respective open-source
          licenses. Your use of these components is governed by the terms of those licenses.
        </p>
        <p>
          You retain full ownership of your email content and any data you transmit through SolMail.
        </p>
      </div>
    ),
  },
  {
    title: 'Third-Party Services',
    content: (
      <div className="space-y-4">
        <p>SolMail integrates with the following third-party services:</p>
        <ul className="ml-4 list-disc space-y-2">
          <li>
            <strong>Google Gmail API:</strong> Your use of Gmail through SolMail is subject to{' '}
            <a
              href="https://policies.google.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center"
            >
              Google&apos;s Terms of Service
            </a>
          </li>
          <li>
            <strong>Solana Blockchain:</strong> Micropayment transactions are subject to the Solana
            network&apos;s protocols and any applicable terms
          </li>
          <li>
            <strong>AI Services:</strong> Email drafting and reply analysis features may use
            third-party AI providers
          </li>
        </ul>
        <p>
          We are not responsible for the availability, accuracy, or policies of third-party services.
        </p>
      </div>
    ),
  },
  {
    title: 'Disclaimers and Limitation of Liability',
    content: (
      <div className="space-y-4">
        <p>
          SolMail is provided &quot;as is&quot; and &quot;as available&quot; without warranties of
          any kind, whether express or implied, including but not limited to implied warranties of
          merchantability, fitness for a particular purpose, or non-infringement.
        </p>
        <ul className="ml-4 list-disc space-y-2">
          <li>
            We do not guarantee uninterrupted or error-free operation of the service
          </li>
          <li>
            We are not liable for any loss of data, cryptocurrency, or funds resulting from your use
            of SolMail
          </li>
          <li>
            We are not responsible for the actions of email recipients or the outcome of
            micropayment transactions
          </li>
          <li>
            AI-generated content (drafts, reply analysis) is provided as a tool and should be
            reviewed before use; we are not liable for AI-generated content
          </li>
          <li>
            To the maximum extent permitted by law, SolMail shall not be liable for any indirect,
            incidental, special, consequential, or punitive damages
          </li>
        </ul>
      </div>
    ),
  },
  {
    title: 'Termination',
    content: (
      <div className="space-y-4">
        <p>
          You may stop using SolMail at any time by revoking access through your Google Account
          settings and disconnecting your Solana wallet.
        </p>
        <p>
          We reserve the right to suspend or terminate access to SolMail for any user who violates
          these Terms of Service, without prior notice.
        </p>
        <p>
          Upon termination, any pending micropayment transactions will be processed according to
          their existing terms. Blockchain transactions that have already been confirmed cannot be
          reversed.
        </p>
      </div>
    ),
  },
  {
    title: 'Contact',
    content: (
      <div className="space-y-3">
        <p>For questions about these Terms of Service:</p>
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
    title: 'Changes to These Terms',
    content: (
      <p>
        We may update these Terms of Service from time to time. We will notify users of any material
        changes through our application or website. Continued use of SolMail after changes are posted
        constitutes acceptance of the updated terms.
      </p>
    ),
  },
];
