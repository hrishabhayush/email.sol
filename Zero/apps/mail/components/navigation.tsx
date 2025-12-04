import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuContent,
  ListItem,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { GitHub, Star } from './icons/icons';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { signIn, useSession } from '@/lib/auth-client';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useState, useEffect, useRef, startTransition } from 'react';
import { Menu, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const aboutLinks = [
  {
    title: 'About',
    href: '/about',
    description: 'Learn more about SolMail and our mission.',
  },
  {
    title: 'Contributors',
    href: '/contributors',
    description: 'See the contributors to SolMail.',
  },
];

interface GitHubApiResponse {
  stargazers_count: number;
}

export function Navigation() {
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0); // Default fallback value
  const [contactUsOpen, setContactUsOpen] = useState(false);
  const [contactUsClicked, setContactUsClicked] = useState(false);
  const contactUsRef = useRef<HTMLDivElement>(null);
  const [mobileContactUsOpen, setMobileContactUsOpen] = useState(false);
  const [mobileContactUsClicked, setMobileContactUsClicked] = useState(false);
  const mobileContactUsRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const navigate = useNavigate();

  const { data: githubData } = useQuery({
    queryKey: ['githubStars'],
    queryFn: async () => {
      const response = await fetch('https://api.github.com/repos/hrishabhayush/email.sol', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch GitHub stars');
      }
      return response.json() as Promise<GitHubApiResponse>;
    },
  });

  useEffect(() => {
    if (githubData) {
      setStars(githubData.stargazers_count || 0);
    }
  }, [githubData]);

  // Handle click outside to close Contact Us dropdown when clicked open
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contactUsRef.current && !contactUsRef.current.contains(event.target as Node)) {
        if (contactUsClicked) {
          setContactUsOpen(false);
          setContactUsClicked(false);
        }
      }
      if (mobileContactUsRef.current && !mobileContactUsRef.current.contains(event.target as Node)) {
        if (mobileContactUsClicked) {
          setMobileContactUsOpen(false);
          setMobileContactUsClicked(false);
        }
      }
    };

    if (contactUsClicked || mobileContactUsClicked) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [contactUsClicked, mobileContactUsClicked]);

  return (
    <>
      {/* Desktop Navigation - Hidden on mobile */}
      <header className="fixed left-[50%] z-[100] hidden w-full max-w-4xl translate-x-[-50%] items-center justify-center px-4 pt-6 lg:flex">
        <nav className="border-input/50 flex w-full max-w-4xl items-center justify-between gap-2 rounded-xl border-t bg-[#1E1E1E] p-3 px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="relative bottom-1 cursor-pointer">
              <img src="/solmail-logo-dark.png" alt="Solmail" width={22} height={22} className="dark:hidden" />
              <img src="/solmail-logo.png" alt="Solmail" width={22} height={22} className="hidden dark:block" />
            </Link>
            <NavigationMenu>
              <NavigationMenuList className="gap-1">
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="cursor-pointer bg-transparent text-white">
                    Company
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[300px] gap-3 p-4 md:w-[300px] md:grid-cols-1 lg:w-[400px]">
                      {aboutLinks.map((link) => (
                        <ListItem key={link.title} title={link.title} href={link.href}>
                          {link.description}
                        </ListItem>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <div
                    ref={contactUsRef}
                    className="relative"
                    onMouseEnter={() => setContactUsOpen(true)}
                    onMouseLeave={() => {
                      if (!contactUsClicked) {
                        setContactUsOpen(false);
                      }
                    }}
                  >
                    <button
                      onClick={() => {
                        setContactUsClicked(!contactUsClicked);
                        setContactUsOpen(!contactUsOpen);
                      }}
                      className={cn(
                        navigationMenuTriggerStyle(),
                        'group cursor-pointer bg-transparent text-white',
                        (contactUsOpen || contactUsClicked) && 'bg-accent/50',
                      )}
                    >
                      Contact Us{' '}
                      <ChevronDown
                        className={cn(
                          'relative top-px ml-1 h-3 w-3 transition duration-300',
                          (contactUsOpen || contactUsClicked) && 'rotate-180',
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    {(contactUsOpen || contactUsClicked) && (
                      <div className="absolute left-0 top-full z-50 flex justify-center">
                        <div className="origin-top-center bg-popover text-popover-foreground relative mt-1.5 w-[250px] overflow-hidden rounded-md border shadow animate-in zoom-in-90">
                          <ul className="grid gap-2 p-4">
                            <li>
                              <a
                                href="https://x.com/solmail_xyz"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="cursor-pointer block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                <div className="text-sm font-medium leading-none">X: @solmail_xyz</div>
                              </a>
                            </li>
                            <li>
                              <a
                                href="mailto:solmailxyz@gmail.com"
                                className="cursor-pointer block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                <div className="text-sm font-medium leading-none">Email: solmailxyz@gmail.com</div>
                              </a>
                            </li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
          <div className="flex gap-2">
            <a
              href="https://github.com/hrishabhayush/email.sol"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'group inline-flex h-8 items-center gap-2 rounded-lg bg-black px-2 text-sm text-white transition-colors hover:bg-black/90',
              )}
            >
              <div className="flex items-center text-white">
                <GitHub className="mr-1 size-4 fill-white" />
                <span className="ml-1 lg:hidden">Star</span>
                <span className="ml-1 hidden lg:inline">GitHub</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Star className="relative top-px size-4 fill-gray-400 transition-all duration-300 group-hover:fill-yellow-400 group-hover:drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
                <AnimatedNumber value={stars} className="font-medium text-white" />
              </div>
            </a>
            {session?.user?.id ? (
              <Link
                to="/mail/inbox"
                className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90"
              >
                Get Started
              </Link>
            ) : (
              <button
                onClick={() => {
                  toast.promise(
                    signIn.social({
                      provider: 'google',
                      callbackURL: `${window.location.origin}/mail`,
                    }),
                    {
                      error: 'Login redirect failed',
                    },
                  );
                }}
                className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-white/90 no-underline"
              >
                Get Started
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* Mobile Navigation Sheet */}
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="fixed left-4 top-6 z-50 cursor-pointer">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[400px] dark:bg-[#111111]">
            <SheetHeader className="flex flex-row items-center justify-between">
              <SheetTitle>
                <Link 
                  to="/"
                  className="cursor-pointer"
                  onClick={() => setOpen(false)}
                >
                  <img
                    src="/solmail-logo.png"
                    alt="Solmail"
                    className="hidden object-contain dark:block"
                    width={22}
                    height={22}
                  />
                  <img
                    src="/solmail-logo-dark.png"
                    alt="0.email Logo"
                    className="object-contain dark:hidden"
                    width={22}
                    height={22}
                  />
                </Link>
              </SheetTitle>
            </SheetHeader>
            <div className="mt-8 flex flex-col space-y-3">
              <div className="flex flex-col space-y-3">
                <a
                  href="/"
                  onClick={() => {
                    setOpen(false);
                  }}
                  className="mt-2 block font-medium"
                >
                  Home
                </a>
                {aboutLinks.map((link) => (
                  <a key={link.title} href={link.href} className="block font-medium">
                    {link.title}
                  </a>
                ))}
              </div>
              <div
                ref={mobileContactUsRef}
                className="flex flex-col space-y-2"
                onMouseEnter={() => setMobileContactUsOpen(true)}
                onMouseLeave={() => {
                  if (!mobileContactUsClicked) {
                    setMobileContactUsOpen(false);
                  }
                }}
              >
                <button
                  onClick={() => {
                    setMobileContactUsClicked(!mobileContactUsClicked);
                    setMobileContactUsOpen(!mobileContactUsOpen);
                  }}
                  className="flex items-center gap-2 font-medium text-left"
                >
                  <span>Contact Us</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition duration-300',
                      (mobileContactUsOpen || mobileContactUsClicked) && 'rotate-180',
                    )}
                    aria-hidden="true"
                  />
                </button>
                {(mobileContactUsOpen || mobileContactUsClicked) && (
                  <div className="ml-4 flex flex-col space-y-2">
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href="https://x.com/solmail_xyz"
                      className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      X: @solmail_xyz
                    </a>
                    <a
                      href="mailto:solmailxyz@gmail.com"
                      className="cursor-pointer text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Email: solmailxyz@gmail.com
                    </a>
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
