import { useAISidebar } from './ui/ai-sidebar';

// AI Toggle Button Component (display only, not clickable)
const AIToggleButton = () => {
  const { open: isSidebarOpen } = useAISidebar();

  return (
    !isSidebarOpen && (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="dark:bg-sidebar pointer-events-none flex h-12 w-12 items-center justify-center rounded-lg border">
          <img
            src="/solmail-logo-dark.png"
            alt="Solmail"
            width={22}
            height={22}
            className="block dark:hidden"
          />
          <img
            src="/solmail-logo.png"
            alt="Solmail"
            width={22}
            height={22}
            className="hidden dark:block"
          />
        </div>
      </div>
    )
  );
};

export default AIToggleButton;
