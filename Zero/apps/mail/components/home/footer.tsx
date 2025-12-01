import { Twitter } from '../icons/icons';

const socialLinks = [
  {
    name: 'Twitter',
    href: 'https://x.com/mail0dotcom',
    icon: Twitter,
  },
];

export default function Footer() {
  return (
    <div className="bg-panelDark m-2 hidden flex-col items-center justify-center rounded-xl md:flex z-10">
      <div className="relative z-1 mx-auto mb-8 mt-5 flex max-w-[2900px] w-full flex-row items-center justify-between self-stretch px-4">
      <div className="flex w-full items-start justify-between lg:w-[900px]">
        <div className="mt-3 flex flex-col items-start justify-start gap-6 self-stretch">
          <div className="text-xs font-medium leading-tight text-white opacity-80 sm:text-sm">
            © 2025 sol0mail
          </div>
        </div>

        <div className="inline-flex items-center justify-center gap-4">
          <a href="/">
            <img src="/white-icon.svg" alt="logo" width={20} height={20} />
          </a>
          {socialLinks.map((social) => (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2.5 rounded-[999px] bg-white/10 p-2 backdrop-blur-[20px] transition-colors hover:bg-white/20"
            >
              <div className="relative h-3.5 w-3.5 overflow-hidden">
                <social.icon className="absolute h-3.5 w-3.5 fill-white" />
              </div>
            </a>
          ))}
        </div>
        </div>
      </div>
    </div>
  );
}
