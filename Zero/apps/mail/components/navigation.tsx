import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuContent,
  ListItem,
} from '@/components/ui/navigation-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { GitHub, Star } from './icons/icons';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { signIn, useSession } from '@/lib/auth-client';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const aboutLinks = [
  {
    title: 'About',
    href: '/about',
    description: 'Learn more about SolMail and our mission.',
  },
  {
    title: 'Terms of Service',
    href: '/terms',
    description: 'Review our terms of service and usage guidelines.',
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

  return (
    <>
      {/* Desktop Navigation - Hidden on mobile */}
      <header className="fixed left-[50%] z-50 hidden w-full max-w-4xl translate-x-[-50%] items-center justify-center px-4 pt-6 lg:flex">
        <nav className="border-input/50 flex w-full max-w-4xl items-center justify-between gap-2 rounded-xl border-t bg-[#1E1E1E] p-3 px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="relative bottom-1 cursor-pointer">
              <img src="/solmail-logo.png" alt="Zero Email" width={22} height={22} />
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
            <Button
              className="h-8 cursor-pointer bg-white text-black hover:bg-white hover:text-black"
              onClick={() => {
                if (session) {
                  navigate('/mail/inbox');
                } else {
                  toast.promise(
                    signIn.social({
                      provider: 'google',
                      callbackURL: `${window.location.origin}/mail`,
                    }),
                    {
                      error: 'Login redirect failed',
                    },
                  );
                }
              }}
            >
              Get Started
            </Button>
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
                <Link to="/" onClick={() => setOpen(false)}>
                  <img
                    src="/solmail-logo.png"
                    alt="Zero Email"
                    className="hidden object-contain dark:block"
                    width={22}
                    height={22}
                  />
                  <img
                    src="/solmail-logo.png"
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
                <Link to="/" className="mt-2" onClick={() => setOpen(false)}>
                  Home
                </Link>
                {aboutLinks.map((link) => (
                  <a key={link.title} href={link.href} className="block font-medium">
                    {link.title}
                  </a>
                ))}
              </div>
              <a
                target="_blank"
                rel="noreferrer"
                href="https://cal.com/team/0"
                className="font-medium"
              >
                Contact Us
              </a>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
