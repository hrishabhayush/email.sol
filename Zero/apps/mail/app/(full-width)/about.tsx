import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Github, Mail } from 'lucide-react';
import { Navigation } from '@/components/navigation';
import Footer from '@/components/home/footer';
import { Twitter } from '@/components/icons/icons';
import React from 'react';

export default function AboutPage() {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-auto bg-white dark:bg-[#111111]">
      <Navigation />
      <div className="relative z-10 flex grow flex-col">

        <div className="container mx-auto max-w-4xl px-4 py-16">
          <Card className="overflow-hidden rounded-xl border-none bg-gray-50/80 dark:bg-transparent">
            <CardHeader className="space-y-4 px-8 py-8">
              <div className="space-y-2 text-center">
                <CardTitle className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl dark:text-white">
                  About Us
                </CardTitle>
              </div>
            </CardHeader>

            <div className="space-y-8 p-8">
              {sections.map((section) => (
                <div key={section.title} className="p-6">
                  <h2 className="mb-4 text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
                    {section.title}
                  </h2>
                  <div className="prose prose-sm prose-a:text-blue-600 hover:prose-a:text-blue-800 dark:prose-a:text-blue-400 dark:hover:prose-a:text-blue-300 max-w-none text-gray-600 dark:text-white/80">
                    {section.content}
                  </div>
                </div>
              ))}
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
    title: 'What is SolMail?',
    content: (
      <div className="space-y-4">
        <p>
          SolMail is a cold email outreach platform that uses micropayments to incentivize meaningful
          responses and facilitate better correspondence. It addresses the common problem where
          unsolicited messages, such as mass job applications or sponsorship outreach, are ignored
          because responding offers no immediate benefit to the recipient.
        </p>
        <p>
          The platform functions by allowing senders to attach a monetary incentive to their emails,
          which creates a competitive advantage over other senders. These funds are held in an escrow
          smart contract rather than being transferred immediately. When a recipient replies, an AI
          agent utilizes privacy-preserving multi-party computation to evaluate the quality of the
          response. If the response is deemed meaningful, the funds are released to the recipient as
          payment; if the response is not meaningful, the sender is refunded.
        </p>
        <p>
          SolMail is built on the principles of transparency and community collaboration, with an
          entirely open source codebase. This architecture ensures the platform remains trustworthy
          and accessible, allowing anyone to review the code for security, contribute new features,
          or self-host their own instance of the service.
        </p>
      </div>
    ),
  },
  {
    title: 'Contact',
    content: (
      <div className="space-y-3">
        <p>Get in contact with us:</p>
        <div className="flex flex-col space-y-2">
          <a
            href="https://x.com/solmail_xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-blue-400 hover:text-blue-300"
          >
            <Twitter className="mr-2 h-4 w-4 fill-blue-400 dark:fill-blue-400" />
            @solmail_xyz
          </a>
          <a
            href="mailto:solmailxyz@gmail.com"
            className="inline-flex items-center text-blue-400 hover:text-blue-300"
          >
            <Mail className="mr-2 h-4 w-4" />
            solmailxyz@gmail.com
          </a>
          <a
            href="https://github.com/Mail-0/Zero"
            className="inline-flex items-center text-blue-400 hover:text-blue-300"
          >
            <Github className="mr-2 h-4 w-4" />
            Open an issue on GitHub
          </a>
        </div>
      </div>
    ),
  },
];
