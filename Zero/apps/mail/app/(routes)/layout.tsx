import { HotkeyProviderWrapper } from '@/components/providers/hotkey-provider-wrapper';
import { CommandPaletteProvider } from '@/components/context/command-palette-context';
import { PrivyProvider, PrivyDebugPanel } from '../../providers/privy-provider';

import { Outlet } from 'react-router';

export default function Layout() {
  return (
    <PrivyProvider>
      <CommandPaletteProvider>
        <HotkeyProviderWrapper>
          <div className="relative flex max-h-screen w-full overflow-hidden">
            <Outlet />
            <PrivyDebugPanel />
          </div>
        </HotkeyProviderWrapper>
      </CommandPaletteProvider>
    </PrivyProvider>
  );
}
