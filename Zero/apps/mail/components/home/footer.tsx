import { Twitter } from '../icons/icons';

const socialLinks = [
  {
    name: 'Twitter',
    href: 'https://x.com/CUBlockchain',
    icon: Twitter,
  },
];

export default function Footer() {
  return (
    <div className="bg-panelDark -mx-2 mt-16 flex w-screen flex-col items-center justify-center rounded-none lg:mx-2 lg:w-auto lg:rounded-xl z-10">
      <div className="relative z-1 mb-8 mt-5 flex w-full flex-row items-center justify-between self-stretch px-4 lg:mx-auto lg:max-w-[2900px]">
      <div className="flex w-full items-start justify-between lg:w-[900px]">
        <div className="mt-3 flex flex-col items-start justify-start gap-6 self-stretch">
          <div className="text-xs font-medium leading-tight text-white opacity-80 sm:text-sm">
            © 2025 SolMail
          </div>
        </div>

        <div className="inline-flex items-center justify-center gap-4">
          <a href="/">
            <img src="/solmail-logo.png" alt="logo" width={20} height={20} />
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
