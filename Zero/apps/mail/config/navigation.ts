import {
  Archive,
  Bin,
  ExclamationCircle,
  Folder,
  Inbox,
  Plane2,
  Clock,
} from '@/components/icons/icons';
import { m } from '@/paraglide/messages';

export interface NavItem {
  id?: string;
  title: string;
  url: string;
  icon: React.ComponentType<any>;
  badge?: number;
  disabled?: boolean;
  target?: string;
  shortcut?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface NavConfig {
  path: string;
  sections: NavSection[];
}

// ! items title has to be a message key (check messages/en.json)
export const navigationConfig: Record<string, NavConfig> = {
  mail: {
    path: '/mail',
    sections: [
      {
        title: 'Core',
        items: [
          {
            id: 'inbox',
            title: m['navigation.sidebar.inbox'](),
            url: '/mail/inbox',
            icon: Inbox,
            shortcut: 'g + i',
          },
          {
            id: 'drafts',
            title: m['navigation.sidebar.drafts'](),
            url: '/mail/draft',
            icon: Folder,
            shortcut: 'g + d',
          },
          {
            id: 'sent',
            title: m['navigation.sidebar.sent'](),
            url: '/mail/sent',
            icon: Plane2,
            shortcut: 'g + t',
          },
        ],
      },
      {
        title: 'Management',
        items: [
          {
            id: 'archive',
            title: m['navigation.sidebar.archive'](),
            url: '/mail/archive',
            icon: Archive,
            shortcut: 'g + a',
          },
          {
            id: 'snoozed',
            title: m['navigation.sidebar.snoozed'](),
            url: '/mail/snoozed',
            icon: Clock,
            shortcut: 'g + z',
          },
          {
            id: 'spam',
            title: m['navigation.sidebar.spam'](),
            url: '/mail/spam',
            icon: ExclamationCircle,
          },
          {
            id: 'trash',
            title: m['navigation.sidebar.bin'](),
            url: '/mail/bin',
            icon: Bin,
          },
        ],
      },
      // {
      //   title: "Categories",
      //   items: [
      //     {
      //       title: "Social",
      //       url: "/mail/inbox?category=social",
      //       icon: UsersIcon,
      //       badge: 972,
      //     },
      //     {
      //       title: "Updates",
      //       url: "/mail/inbox?category=updates",
      //       icon: BellIcon,
      //       badge: 342,
      //     },
      //     {
      //       title: "Forums",
      //       url: "/mail/inbox?category=forums",
      //       icon: MessageCircleIcon,
      //       badge: 128,
      //     },
      //     {
      //       title: "Shopping",
      //       url: "/mail/inbox?category=shopping",
      //       icon: CartIcon,
      //       badge: 8,
      //     },
      //   ],
      // },
    ],
  },
};

export const bottomNavItems: Array<{ title: string; items: NavItem[] }> = [];
