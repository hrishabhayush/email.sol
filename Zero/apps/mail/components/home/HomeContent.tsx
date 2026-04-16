import {
  ChevronDown,
  CurvedArrow,
  GitHub,
  Plus,
  Clock,
  PanelLeftOpen,
  Check,
  Filter,
  Search,
  User,
  Lightning,
  ExclamationTriangle,
  Bell,
  Tag,
  GroupPeople,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Figma,
  Docx,
  ImageFile,
  Expand,
} from '../icons/icons';
import { PixelatedBackground, PixelatedLeft, PixelatedRight } from '@/components/home/pixelated-bg';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import MockInbox from '@/components/home/MockInbox';
import { useSession, signIn } from '@/lib/auth-client';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Balancer } from 'react-wrap-balancer';
import { Navigation } from '../navigation';
import { motion } from 'motion/react';
import { Type } from 'lucide-react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import Footer from './footer';
import React from 'react';

const firstRowQueries: string[] = [
  'Show recent design feedback',
  'Reply to Nick',
  'Find invoice from Stripe',
];

const secondRowQueries: string[] = [
  'Schedule meeting with Sarah',
  'What did alex say about the design',
];

const tabs = [
  { label: 'Chat With Your Inbox', value: 'smart-categorization' },
  { label: 'Smart Labels', value: 'ai-features' },
  { label: 'Write Better Emails', value: 'feature-3' },
];

export default function HomeContent() {
  const navigate = useNavigate();
  const { data: session } = useSession();

  // Redirect logged-in users to inbox (non-blocking - happens after render)
  useEffect(() => {
    if (session?.user?.id) {
      navigate('/mail/inbox');
    }
  }, [session, navigate]);

  return (
    <main className="relative flex h-full flex-1 flex-col overflow-x-hidden bg-[#0F0F0F] px-2">
      <PixelatedBackground
        className="z-1 pointer-events-none absolute left-1/2 top-[-40px] h-auto w-screen min-w-[1920px] -translate-x-1/2 object-cover"
        style={{
          mixBlendMode: 'screen',
          maskImage: 'linear-gradient(to bottom, black, transparent)',
        }}
      />

      <Navigation />

      <section className="z-10 mt-32 flex flex-col items-center px-4">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center text-4xl font-medium md:text-6xl"
        >
          <Balancer className="mb-3 max-w-[1130px]">
            The Incentivized Inbox for Richer Replies
          </Balancer>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mx-auto mb-4 max-w-2xl text-center text-base font-medium text-[#B7B7B7] md:text-lg"
        >
          SolMail is an AI-powered email platform with micropayments on emails which incentivize meaningful responses. Pay only for successful conversations.
        </motion.p>
        {/* Get Started button only visible for mobile screens */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mb-6 lg:hidden"
        >
          {session?.user?.id ? (
            <Link
              to="/mail/inbox"
              className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-white px-6 text-sm font-medium text-black transition-colors hover:bg-white/90"
            >
              Get Started
            </Link>
          ) : (
            <button
              className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-white px-6 text-sm font-medium text-black no-underline transition-colors hover:bg-white/90"
              onClick={() => {
                toast.promise(
                  signIn.social({
                    provider: 'google',
                    callbackURL: `${window.location.origin}/mail`,
                  }),
                  { error: 'Login redirect failed' },
                );
              }}
            >
              Get Started
            </button>
          )}
        </motion.div>
      </section>

      <section className="relative mt-10 hidden flex-col justify-center md:flex">
        <div className="bg-border absolute left-1/2 top-0 h-px w-full -translate-x-1/2 md:container xl:max-w-7xl" />
        <Tabs
          defaultValue="smart-categorization"
          className="flex w-full flex-col items-center gap-0"
        >
          <div
            className="relative bottom-2 flex w-full justify-center md:border-t"
            style={{ clipPath: 'inset(0 0 0 0)', height: '110%' }}
          >
            <div className="container relative -top-1.5 md:border-x xl:max-w-7xl">
              <PixelatedLeft
                className="absolute left-0 top-0 -z-10 hidden h-full w-auto -translate-x-full opacity-50 md:block"
                style={{ mixBlendMode: 'screen' }}
              />
              <PixelatedRight
                className="absolute right-0 top-0 -z-10 hidden h-full w-auto translate-x-full opacity-50 md:block"
                style={{ mixBlendMode: 'screen' }}
              />
              {tabs.map((tab) => (
                <TabsContent key={tab.value} value={tab.value}>
                  <MockInbox />
                </TabsContent>
              ))}
            </div>
          </div>
        </Tabs>
      </section>

      <div className="flex items-center justify-center px-4 md:hidden">
        <div className="mt-10 w-full overflow-x-auto rounded-xl border">
          <MockInbox />
        </div>
      </div>

      <div className="relative -top-3.5 hidden h-px w-full bg-[#313135] md:block" />

      <div className="relative mt-52">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center"
        >
          <h1 className="text-lg font-light text-white/40 md:text-xl">
            Designed for users who want to incentivize better cold email correspondence
          </h1>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-2 flex flex-col items-center justify-center md:mt-8"
        >
          <h1 className="text-center text-4xl font-medium text-white md:text-6xl">
            Responses evalauated by AI
          </h1>
          <h1 className="mb-3 text-center text-4xl font-medium text-white/40 md:text-6xl">
            Solana-powered micropayments
          </h1>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative bottom-3 mx-12 flex items-center justify-center bg-[#0F0F0F] md:mx-0"
        >
          <div className="bg-panelDark mx-auto mt-10 inline-flex max-w-[600px] flex-col items-center justify-center overflow-hidden rounded-2xl shadow-md">
            <div className="inline-flex h-12 items-center justify-start gap-2 self-stretch border-b-[0.50px] p-4">
              <div className="text-sm font-medium text-[#8C8C8C]">To:</div>
              <div className="flex flex-1 items-center justify-start gap-1">
                <div className="outline-tokens-badge-default/10 flex items-center justify-start gap-1.5 rounded-full border border-[#2B2B2B] py-1 pl-1 pr-1.5">
                  <img
                    height={20}
                    width={20}
                    className="h-5 w-5 rounded-full"
                    src="https://github.com/hrishabhayush.png"
                    alt="Hrishabh Ayush"
                  />
                  <div className="flex items-center justify-start">
                    <div className="flex items-center justify-center gap-2.5 pr-0.5">
                      <div className="text-base-gray-950 justify-start text-sm leading-none">
                        Hrishabh Ayush
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex h-full cursor-default items-center gap-2 text-sm font-medium text-[#8C8C8C]">
                  <span>Cc</span>
                </div>
                <div className="flex h-full cursor-default items-center gap-2 text-sm font-medium text-[#8C8C8C]">
                  <span>Bcc</span>
                </div>
                <div className="flex h-full cursor-default items-center gap-2 text-sm font-medium text-[#8C8C8C]">
                  <X className="h-3.5 w-3.5 fill-[#9A9A9A]" />
                </div>
              </div>
            </div>
            <div className="inline-flex h-12 items-center justify-start gap-2.5 self-stretch p-4">
              <div className="text-sm font-medium text-[#8C8C8C]">Subject:</div>
              <div className="inline-flex flex-1 flex-col items-start justify-start gap-3">
                <div className="inline-flex items-center justify-start gap-1 self-stretch">
                  <div className="text-base-gray-950 flex-1 justify-start text-sm font-normal leading-none">
                    Goldman Sachs Summer Analyst Program
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-start justify-start gap-12 self-stretch rounded-2xl bg-[#202020] px-4 py-3">
              <div className="flex flex-col items-start justify-start gap-3 self-stretch">
                <div className="justify-start self-stretch text-sm font-normal leading-normal text-white">
                  Good afternoon Mr. Ayush,
                </div>
                <div className="justify-start self-stretch text-sm font-normal leading-normal text-white">
                  I'm a student interested in the Goldman Sachs Summer Analyst program and would
                  appreciate a brief coffee chat if you're available.
                </div>
                <div className="justify-start self-stretch text-sm font-normal leading-normal text-white">
                  If you're available, I'd be grateful for any insights you can share about the
                  program or the recruiting process.
                </div>
                <div className="justify-start self-stretch text-sm font-normal leading-normal text-white">
                  Thank you for your consideration.
                </div>
              </div>
              <div className="inline-flex items-center justify-between self-stretch">
                <div className="flex items-center justify-start gap-3">
                  <div className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-white px-2 text-sm font-medium text-black">
                    <div className="flex items-center justify-center">
                      <div className="text-center text-sm leading-none text-black">Send</div>
                    </div>
                  </div>
                  <div className="bg-secondary text-secondary-foreground inline-flex h-8 w-8 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium">
                    <Plus className="h-3 w-3 fill-white" />
                  </div>
                  <div className="bg-background flex h-auto w-auto items-center justify-center rounded border border-[#2B2B2B] p-1.5">
                    <Type className="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="relative mt-52 flex items-center justify-center">
        <div className="w-full! mx-auto grid max-w-[1250px] grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col"
          >
            <div className="flex items-center justify-center">
              <img
                src="/login.png"
                alt="Login"
                className="h-auto max-w-full rounded-2xl object-contain md:h-96"
                loading="eager"
              />
            </div>
            <div className="mt-4 gap-4">
              <h1 className="mb-2 text-xl font-medium leading-loose text-white">
                Connect Your Inbox
              </h1>
              <p className="max-w-sm text-sm font-light text-[#979797]">
                Choose your provider to connect your email address, maintaining your existing inbox.
              </p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-center">
              <img
                src="/evaluate.PNG"
                alt="Evaluate"
                className="w-full max-w-full rounded-2xl md:h-96 md:w-auto"
                loading="eager"
              />
            </div>
            <div>
              <h1 className="mb-2 mt-4 text-lg font-medium leading-loose text-white">
                AI-Verified Quality
              </h1>
              <p className="max-w-sm text-sm font-light text-[#979797]">
                Never pay for low-effort replies. Our SendAI agents analyze incoming responses,
                ensuring you only release funds for thoughtful, meaningful correspondence.
              </p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-center">
              <img
                src="/wallet.png"
                alt="Wallet"
                className="h-auto max-w-full rounded-2xl object-contain md:h-96"
                loading="eager"
              />
            </div>
            <div className="mt-4">
              <h1 className="mb-2 text-lg font-medium leading-loose text-white">
                Seamless Smart Wallet
              </h1>
              <p className="max-w-sm text-sm font-light text-[#979797]">
                Experience friction-free outreach. Pre-load your vault to eliminate repetitive
                wallet confirmations, making secure payments as intuitive as clicking "Send".
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="relative flex items-center justify-center">
        <Footer />
      </div>
    </main>
  );
}
