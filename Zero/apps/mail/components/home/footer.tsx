export default function Footer() {
  return (
    <div className="bg-panelDark z-10 mt-16 flex w-screen flex-col items-center justify-center rounded-none lg:mx-2 lg:w-auto lg:rounded-xl">
      <div className="z-1 relative flex w-full flex-col items-center self-stretch px-0 lg:mx-auto lg:max-w-[2900px] lg:px-4">
        <div className="w-full px-4 lg:w-[900px] lg:px-0">
          <div className="mb-6 mt-6 h-px w-full bg-white/20" />
          <div className="mb-8 flex w-full flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="text-xs font-medium leading-tight text-white opacity-60 sm:text-sm">
              © 2025 SolMail, All Rights Reserved
            </div>
            <div className="flex items-center gap-0">
              <a
                href="/about"
                className="px-3 text-xs font-medium leading-tight text-white opacity-60 transition-opacity hover:opacity-80 sm:text-sm"
              >
                About
              </a>
              <span className="h-3 w-px bg-white/40" />
              <a
                href="/terms"
                className="px-3 text-xs font-medium leading-tight text-white opacity-60 transition-opacity hover:opacity-80 sm:text-sm"
              >
                Terms &amp; Conditions
              </a>
              <span className="h-3 w-px bg-white/40" />
              <a
                href="/privacy"
                className="px-3 text-xs font-medium leading-tight text-white opacity-60 transition-opacity hover:opacity-80 sm:text-sm"
              >
                Privacy Policy
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
