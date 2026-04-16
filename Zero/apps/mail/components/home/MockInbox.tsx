import React from 'react';

const emails = [
  {
    id: 1,
    sender: 'James Miller',
    initials: 'JM',
    color: 'bg-emerald-600',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face',
    subject: 'Introduction - Series A Discussion',
    preview: "Hi, I'm reaching out regarding a potential Series A investment opportunity...",
    time: '2:45 PM',
    unread: true,
    selected: true,
    count: 2,
  },
  {
    id: 2,
    sender: 'Sarah Chen',
    initials: 'SC',
    color: 'bg-violet-600',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=64&h=64&fit=crop&crop=face',
    subject: 'Q2 Marketing Strategy Deck',
    preview: "Here's the updated deck with the new projections we discussed...",
    time: '1:30 PM',
    unread: true,
    label: { text: 'Important', color: 'bg-[#F59E0D]' },
  },
  {
    id: 3,
    sender: 'Stripe',
    initials: 'S',
    color: 'bg-indigo-600',
    logo: 'https://images.stripeassets.com/fzn2n1nzq965/HTTOloNPhisV9P4hlMPNA/cacf1bb88b9fc492dfad34378d844280/Stripe_icon_-_square.svg',
    subject: 'Your March invoice is ready',
    preview: 'Your invoice for $2,450.00 is now available to view and download...',
    time: '12:15 PM',
    unread: false,
  },
  {
    id: 4,
    sender: 'Alex Thompson',
    initials: 'AT',
    color: 'bg-sky-600',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&crop=face',
    subject: 'Re: Partnership Proposal',
    preview: "Thanks for sending this over. I've reviewed the terms and I think we can...",
    time: '11:42 AM',
    unread: true,
    count: 3,
  },
  {
    id: 5,
    sender: 'GitHub',
    initials: 'GH',
    color: 'bg-gray-700',
    logo: 'https://github.githubassets.com/favicons/favicon-dark.svg',
    subject: 'Security alert: new sign-in from Chrome',
    preview: 'A new sign-in to your account was detected from Chrome on macOS...',
    time: '10:30 AM',
    unread: false,
  },
  {
    id: 6,
    sender: 'David Park',
    initials: 'DP',
    color: 'bg-teal-600',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=64&h=64&fit=crop&crop=face',
    subject: 'Coffee chat next week?',
    preview: "Hey! Would love to catch up over coffee. Are you free Tuesday or...",
    time: '9:15 AM',
    unread: true,
    label: { text: 'Personal', color: 'bg-[#39AE4A]' },
  },
  {
    id: 7,
    sender: 'Lisa Wang',
    initials: 'LW',
    color: 'bg-pink-600',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=64&h=64&fit=crop&crop=face',
    subject: 'Updated brand guidelines v2',
    preview: "Attached are the final brand guidelines. Let me know if you need any...",
    time: 'Yesterday',
    unread: false,
    hasAttachment: true,
  },
  {
    id: 8,
    sender: 'Notion',
    initials: 'N',
    color: 'bg-neutral-600',
    logo: 'https://www.notion.so/front-static/favicon.ico',
    subject: 'Weekly digest: 5 updates in your workspace',
    preview: 'Your team made 5 updates this week. Here is a summary of the changes...',
    time: 'Yesterday',
    unread: false,
    label: { text: 'Updates', color: 'bg-[#8B5CF6]' },
  },
  {
    id: 9,
    sender: 'Figma',
    initials: 'F',
    color: 'bg-orange-500',
    logo: 'https://static.figma.com/app/icon/1/favicon.png',
    subject: 'You were mentioned in Design System',
    preview: 'Rachel Kim mentioned you in a comment on the Design System file...',
    time: 'Yesterday',
    unread: false,
  },
  {
    id: 10,
    sender: 'Rachel Kim',
    initials: 'RK',
    color: 'bg-rose-600',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=64&h=64&fit=crop&crop=face',
    subject: 'Re: Q1 Performance Review',
    preview: "Thanks for the feedback. I've updated the goals section as discussed...",
    time: 'Mon',
    unread: false,
  },
];

/* Exact icons from the real app */
function IconInbox() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M4.78373 3C3.85012 3 3.01349 3.57656 2.68113 4.44901L1.1474 8.47505C1.04995 8.73086 1 9.0023 1 9.27604V10.75C1 11.9926 2.00736 13 3.25 13H12.75C13.9926 13 15 11.9926 15 10.75V9.27604C15 9.0023 14.95 8.73086 14.8526 8.47505L13.3189 4.44901C12.9865 3.57656 12.1499 3 11.2163 3H4.78373ZM4.08286 4.983C4.19365 4.69219 4.47252 4.5 4.78373 4.5H11.2163C11.5275 4.5 11.8063 4.69219 11.9171 4.983L13.4474 9H11.0352C10.7008 9 10.3886 9.1671 10.2031 9.4453L9.79687 10.0547C9.6114 10.3329 9.29917 10.5 8.96482 10.5H7.03518C6.70083 10.5 6.3886 10.3329 6.20313 10.0547L5.79687 9.4453C5.6114 9.1671 5.29917 9 4.96482 9H2.55258L4.08286 4.983Z" fill="#898989" fillOpacity="0.5" />
    </svg>
  );
}
function IconFolder() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.5 21C21.1569 21 22.5 19.6569 22.5 18V13.5C22.5 11.8431 21.1569 10.5 19.5 10.5H4.5C2.84315 10.5 1.5 11.8431 1.5 13.5V18C1.5 19.6569 2.84315 21 4.5 21H19.5Z" fill="#898989" fillOpacity="0.5" />
      <path d="M1.5 10.1458V6C1.5 4.34315 2.84315 3 4.5 3H9.87868C10.4754 3 11.0477 3.23705 11.4697 3.65901L13.591 5.78033C13.7316 5.92098 13.9224 6 14.1213 6H19.5C21.1569 6 22.5 7.34315 22.5 9V10.1458C21.7039 9.43328 20.6525 9 19.5 9H4.5C3.34747 9 2.29613 9.43328 1.5 10.1458Z" fill="#898989" fillOpacity="0.5" />
    </svg>
  );
}
function IconSent() {
  return (
    <svg width="16" height="16" viewBox="-2 -1 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.10526 0.288438C0.853622 0.252772 0.601043 0.346971 0.434213 0.538704C0.267382 0.730436 0.209003 0.993612 0.279111 1.2379L1.69276 6.16378C1.87733 6.80688 2.4655 7.25 3.13456 7.25H9.25002C9.66423 7.25 10 7.58579 10 8C10 8.41421 9.66423 8.75 9.25002 8.75H3.13457C2.4655 8.75 1.87733 9.19312 1.69277 9.83622L0.279111 14.7621C0.209003 15.0064 0.267382 15.2696 0.434213 15.4613C0.601043 15.6531 0.853622 15.7473 1.10526 15.7116C6.94303 14.8842 12.221 12.3187 16.3983 8.55737C16.5563 8.41514 16.6465 8.21257 16.6465 8.00001C16.6465 7.78746 16.5563 7.58489 16.3983 7.44266C12.221 3.68129 6.94303 1.11585 1.10526 0.288438Z" fill="#898989" fillOpacity="0.5" />
    </svg>
  );
}
function IconArchive() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 2C2.44772 2 2 2.44772 2 3V4C2 4.55228 2.44772 5 3 5H13C13.5523 5 14 4.55228 14 4V3C14 2.44772 13.5523 2 13 2H3Z" fill="#898989" fillOpacity="0.5" />
      <path fillRule="evenodd" clipRule="evenodd" d="M3 6H13V12C13 13.1046 12.1046 14 11 14H5C3.89543 14 3 13.1046 3 12V6ZM6 8.75C6 8.33579 6.33579 8 6.75 8H9.25C9.66421 8 10 8.33579 10 8.75C10 9.16421 9.66421 9.5 9.25 9.5H6.75C6.33579 9.5 6 9.16421 6 8.75Z" fill="#898989" fillOpacity="0.5" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M0 7C0 3.13401 3.13401 0 7 0C10.866 0 14 3.13401 14 7C14 10.866 10.866 14 7 14C3.13401 14 0 10.866 0 7ZM7.75 2.75C7.75 2.33579 7.41421 2 7 2C6.58579 2 6.25 2.33579 6.25 2.75V7C6.25 7.41421 6.58579 7.75 7 7.75H10.25C10.6642 7.75 11 7.41421 11 7C11 6.58579 10.6642 6.25 10.25 6.25H7.75V2.75Z" fill="#898989" fillOpacity="0.5" />
    </svg>
  );
}
function IconSpam() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M7 13.5C10.5899 13.5 13.5 10.5899 13.5 7C13.5 3.41015 10.5899 0.5 7 0.5C3.41015 0.5 0.5 3.41015 0.5 7C0.5 10.5899 3.41015 13.5 7 13.5ZM7 3.28571C7.38463 3.28571 7.69643 3.59752 7.69643 3.98214V6.76786C7.69643 7.15248 7.38463 7.46429 7 7.46429C6.61537 7.46429 6.30357 7.15248 6.30357 6.76786V3.98214C6.30357 3.59752 6.61537 3.28571 7 3.28571ZM7 10.7143C7.51284 10.7143 7.92857 10.2986 7.92857 9.78571C7.92857 9.27288 7.51284 8.85714 7 8.85714C6.48716 8.85714 6.07143 9.27288 6.07143 9.78571C6.07143 10.2986 6.48716 10.7143 7 10.7143Z" fill="#898989" fillOpacity="0.5" />
    </svg>
  );
}
function IconBin() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M5 3.25V4H2.75C2.33579 4 2 4.33579 2 4.75C2 5.16421 2.33579 5.5 2.75 5.5H3.05L3.86493 13.6493C3.94161 14.4161 4.58685 15 5.35748 15H10.6425C11.4131 15 12.0584 14.4161 12.1351 13.6493L12.95 5.5H13.25C13.6642 5.5 14 5.16421 14 4.75C14 4.33579 13.6642 4 13.25 4H11V3.25C11 2.00736 9.99264 1 8.75 1H7.25C6.00736 1 5 2.00736 5 3.25ZM7.25 2.5C6.83579 2.5 6.5 2.83579 6.5 3.25V4H9.5V3.25C9.5 2.83579 9.16421 2.5 8.75 2.5H7.25ZM6.05044 6.00094C6.46413 5.98025 6.81627 6.29885 6.83696 6.71255L7.11195 12.2125C7.13264 12.6262 6.81404 12.9784 6.40034 12.9991C5.98665 13.0197 5.63451 12.7011 5.61383 12.2875L5.33883 6.78745C5.31814 6.37376 5.63674 6.02162 6.05044 6.00094ZM9.95034 6.00094C10.364 6.02162 10.6826 6.37376 10.662 6.78745L10.387 12.2875C10.3663 12.7011 10.0141 13.0197 9.60044 12.9991C9.18674 12.9784 8.86814 12.6262 8.88883 12.2125L9.16383 6.71255C9.18451 6.29885 9.53665 5.98025 9.95034 6.00094Z" fill="#898989" fillOpacity="0.5" />
    </svg>
  );
}

const sidebarFolders = [
  { name: 'Inbox', count: 42, icon: IconInbox, active: true },
  { name: 'Drafts', count: 31, icon: IconFolder },
  { name: 'Sent', count: 33, icon: IconSent },
];

const sidebarManagement = [
  { name: 'Archive', count: 0, icon: IconArchive },
  { name: 'Snoozed', count: null, icon: IconClock },
  { name: 'Spam', count: 0, icon: IconSpam },
  { name: 'Trash', count: 0, icon: IconBin },
];

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#71717A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function StarIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? '#FBBF24' : 'none'} stroke={filled ? '#FBBF24' : '#9D9D9D'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="#9B9B9B" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M10.5 7.75C10.5 6.23122 9.26878 5 7.75 5H2.56066L4.78033 7.21967C5.07322 7.51256 5.07322 7.98744 4.78033 8.28033C4.48744 8.57322 4.01256 8.57322 3.71967 8.28033L0.21967 4.78033C-0.0732234 4.48744 -0.0732233 4.01256 0.21967 3.71967L3.71967 0.21967C4.01256 -0.0732233 4.48744 -0.0732233 4.78033 0.21967C5.07322 0.512563 5.07322 0.987437 4.78033 1.28033L2.56066 3.5L7.75 3.5C10.0972 3.5 12 5.40279 12 7.75C12 10.0972 10.0972 12 7.75 12H6.75C6.33579 12 6 11.6642 6 11.25C6 10.8358 6.33579 10.5 6.75 10.5H7.75C9.26878 10.5 10.5 9.26878 10.5 7.75Z" />
    </svg>
  );
}

function ReplyAllIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="#9B9B9B" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M14 9.75C14 8.23122 12.7688 7 11.25 7H7.56066L9.78033 9.21967C10.0732 9.51256 10.0732 9.98744 9.78033 10.2803C9.48744 10.5732 9.01256 10.5732 8.71967 10.2803L5.21967 6.78033C4.92678 6.48744 4.92678 6.01256 5.21967 5.71967L8.71967 2.21967C9.01256 1.92678 9.48744 1.92678 9.78033 2.21967C10.0732 2.51256 10.0732 2.98744 9.78033 3.28033L7.56066 5.5H11.25C13.5972 5.5 15.5 7.40279 15.5 9.75C15.5 12.0972 13.5972 14 11.25 14H10.25C9.83579 14 9.5 13.6642 9.5 13.25C9.5 12.8358 9.83579 12.5 10.25 12.5H11.25C12.7688 12.5 14 11.2688 14 9.75Z" />
      <path fillRule="evenodd" clipRule="evenodd" d="M1.21967 6.78033C0.926777 6.48744 0.926777 6.01256 1.21967 5.71967L4.71967 2.21967C5.01256 1.92678 5.48744 1.92678 5.78033 2.21967C6.07322 2.51256 6.07322 2.98744 5.78033 3.28033L3.06066 6L5.78033 8.71967C6.07322 9.01256 6.07322 9.48744 5.78033 9.78033C5.48744 10.0732 5.01256 10.0732 4.71967 9.78033L1.21967 6.78033Z" />
    </svg>
  );
}

function ForwardIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="#9B9B9B" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M0 6C-1.81059e-08 5.58579 0.335786 5.25 0.75 5.25L9.43934 5.25L6.21967 2.03033C5.92678 1.73744 5.92678 1.26256 6.21967 0.96967C6.51256 0.676777 6.98744 0.676777 7.28033 0.96967L11.7803 5.46967C12.0732 5.76256 12.0732 6.23744 11.7803 6.53033L7.28033 11.0303C6.98744 11.3232 6.51256 11.3232 6.21967 11.0303C5.92678 10.7374 5.92678 10.2626 6.21967 9.96967L9.43934 6.75L0.75 6.75C0.335786 6.75 1.81059e-08 6.41421 0 6Z" />
    </svg>
  );
}

function PencilComposeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.4875 0.512563C10.804 -0.170854 9.696 -0.170854 9.01258 0.512563L4.75098 4.77417C4.49563 5.02951 4.29308 5.33265 4.15488 5.66628L3.30712 7.71282C3.19103 7.99307 3.25519 8.31566 3.46968 8.53017C3.68417 8.74467 4.00676 8.80885 4.28702 8.69277L6.33382 7.84501C6.66748 7.70681 6.97066 7.50423 7.22604 7.24886L11.4875 2.98744C12.1709 2.30402 12.1709 1.19598 11.4875 0.512563Z" />
      <path d="M2.75 1.5C2.05964 1.5 1.5 2.05964 1.5 2.75V9.25C1.5 9.94036 2.05964 10.5 2.75 10.5H9.25C9.94036 10.5 10.5 9.94036 10.5 9.25V7C10.5 6.58579 10.8358 6.25 11.25 6.25C11.6642 6.25 12 6.58579 12 7V9.25C12 10.7688 10.7688 12 9.25 12H2.75C1.23122 12 0 10.7688 0 9.25V2.75C0 1.23122 1.23122 4.84288e-08 2.75 4.84288e-08H5C5.41421 4.84288e-08 5.75 0.335786 5.75 0.75C5.75 1.16421 5.41421 1.5 5 1.5H2.75Z" />
    </svg>
  );
}

export default function MockInbox() {
  return (
    <div className="pointer-events-none select-none overflow-hidden rounded-2xl border border-[#2B2B2B] bg-[#141414] font-sans shadow-2xl" style={{ fontFamily: 'var(--font-geist-sans, "Geist Variable", "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif)' }}>
      <div className="flex h-[680px]">
        {/* Sidebar */}
        <div className="flex h-full w-[180px] shrink-0 flex-col border-r border-[#2B2B2B] bg-[#1A1A1A]">
          {/* Logo row */}
          <div className="flex items-center justify-between px-4 pt-4 pb-1">
            <div className="flex items-center gap-2">
              <img src="/solmail-logo-dark.png" alt="SolMail" className="h-8 w-8 rounded-lg" />
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#313131]">
                <span className="text-lg text-[#898989]">+</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-lg tracking-widest text-[#898989]">...</span>
            </div>
          </div>

          {/* Name & email */}
          <div className="px-4 pt-2 pb-1">
            <div className="text-xs font-semibold text-white">SolMail</div>
            <div className="text-[10px] text-[#8C8C8C]">solmailxyz@gmail.com</div>
          </div>

          {/* New Email Button */}
          <div className="px-3 pt-3 pb-3">
            <div className="flex h-7 w-full items-center justify-center gap-2 rounded-lg bg-[#006FFE] text-xs font-medium leading-none text-white">
              <PencilComposeIcon />
              <span>New email</span>
            </div>
          </div>

          {/* Core folders */}
          <div className="px-3">
            <div className="mb-1.5 text-[11px] text-[#898989]">Core</div>
            {sidebarFolders.map((folder) => (
              <div
                key={folder.name}
                className={`mb-0.5 flex items-center justify-between rounded-md px-2 py-1 text-[11px] ${
                  folder.active ? 'bg-white/5 text-white' : 'text-[#898989]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <folder.icon />
                  <span>{folder.name}</span>
                </div>
                {folder.count !== null && (
                  <span className="text-[10px] text-[#898989]">{folder.count}</span>
                )}
              </div>
            ))}
          </div>

          {/* Management folders */}
          <div className="mt-3 px-3">
            <div className="mb-1.5 text-[11px] text-[#898989]">Management</div>
            {sidebarManagement.map((folder) => (
              <div
                key={folder.name}
                className="mb-0.5 flex items-center justify-between rounded-md px-2 py-1 text-[11px] text-[#898989]"
              >
                <div className="flex items-center gap-2.5">
                  <folder.icon />
                  <span>{folder.name}</span>
                </div>
                {folder.count !== null && (
                  <span className="text-[10px] text-[#898989]">{folder.count}</span>
                )}
              </div>
            ))}
          </div>

          {/* Labels */}
          <div className="mt-3 px-3">
            <div className="flex items-center justify-between text-[11px] text-[#898989]">
              <span>Labels</span>
              <span className="text-sm leading-none">+</span>
            </div>
          </div>

          <div className="mt-auto border-t border-[#2B2B2B] px-3 py-3">
            <div className="flex items-center gap-2.5 px-2 text-[11px] text-[#898989]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#8F8F8F" stroke="#8F8F8F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
              </svg>
              <span>Connect Wallet</span>
            </div>
          </div>
        </div>

        {/* Email List */}
        <div className="flex w-[300px] shrink-0 flex-col border-r border-[#2B2B2B] bg-[#1A1A1A]">
          {/* Search Bar */}
          <div className="flex items-center gap-2 border-b border-[#2B2B2B] px-3 py-2.5">
            {/* PanelLeftOpen */}
            <svg width="14" height="12" viewBox="0 0 14 12" fill="#898989" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M4.8 12C3.11984 12 2.27976 12 1.63803 11.673C1.07354 11.3854 0.614601 10.9265 0.32698 10.362C0 9.72024 0 8.88016 0 7.2V4.8C0 3.11984 0 2.27976 0.32698 1.63803C0.614601 1.07354 1.07354 0.614601 1.63803 0.32698C2.27976 0 3.11984 0 4.8 0H9.2C10.8802 0 11.7202 0 12.362 0.32698C12.9265 0.614601 13.3854 1.07354 13.673 1.63803C14 2.27976 14 3.11984 14 4.8V7.2C14 8.88016 14 9.72024 13.673 10.362C13.3854 10.9265 12.9265 11.3854 12.362 11.673C11.7202 12 10.8802 12 9.2 12H4.8ZM10.1 1.5C10.9401 1.5 11.3601 1.5 11.681 1.66349C11.9632 1.8073 12.1927 2.03677 12.3365 2.31901C12.5 2.63988 12.5 3.05992 12.5 3.9V8.1C12.5 8.94008 12.5 9.36012 12.3365 9.68099C12.1927 9.96323 11.9632 10.1927 11.681 10.3365C11.3601 10.5 10.9401 10.5 10.1 10.5H9.9C9.05992 10.5 8.63988 10.5 8.31901 10.3365C8.03677 10.1927 7.8073 9.96323 7.66349 9.68099C7.5 9.36012 7.5 8.94008 7.5 8.1V3.9C7.5 3.05992 7.5 2.63988 7.66349 2.31901C7.8073 2.03677 8.03677 1.8073 8.31901 1.66349C8.63988 1.5 9.05992 1.5 9.9 1.5H10.1ZM1.96094 2.82422C1.96094 2.47904 2.24076 2.19922 2.58594 2.19922H4.08594C4.43112 2.19922 4.71094 2.47904 4.71094 2.82422C4.71094 3.1694 4.43112 3.44922 4.08594 3.44922H2.58594C2.24076 3.44922 1.96094 3.1694 1.96094 2.82422ZM2.58594 4.19531C2.24076 4.19531 1.96094 4.47513 1.96094 4.82031C1.96094 5.16549 2.24076 5.44531 2.58594 5.44531H4.08594C4.43112 5.44531 4.71094 5.16549 4.71094 4.82031C4.71094 4.47513 4.43112 4.19531 4.08594 4.19531H2.58594Z" />
            </svg>
            <SearchIcon />
            <span className="text-xs text-[#71717A]">Search</span>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-md border border-[#2B2B2B] px-2 py-1 text-xs text-[#898989]">
                <span>Categories</span>
                {/* ChevronDown */}
                <svg width="8" height="6" viewBox="0 0 8 6" fill="#898989" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M0.21967 0.84467C0.512563 0.551777 0.987437 0.551777 1.28033 0.84467L4 3.56434L6.71967 0.844671C7.01256 0.551778 7.48744 0.551778 7.78033 0.844671C8.07322 1.13756 8.07322 1.61244 7.78033 1.90533L4.53033 5.15533C4.23744 5.44822 3.76256 5.44822 3.46967 5.15533L0.21967 1.90533C-0.0732233 1.61244 -0.0732233 1.13756 0.21967 0.84467Z" />
                </svg>
              </div>
              {/* RefreshCcw */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#898989" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#898989]">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
            </div>
          </div>

          {/* Email items */}
          <div className="flex-1 overflow-hidden">
            {emails.map((email) => (
              <div
                key={email.id}
                className={`flex cursor-default gap-3 border-b border-[#2B2B2B]/50 px-3 py-2.5 ${
                  email.selected ? 'bg-white/5' : ''
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  {email.avatar || email.logo ? (
                    <img
                      src={email.avatar || email.logo}
                      alt={email.sender}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium text-white ${email.color}`}
                    >
                      {email.initials}
                    </div>
                  )}
                  {email.unread && (
                    <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#006FFE]" />
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`truncate text-xs ${email.unread ? 'font-semibold text-white' : 'font-medium text-[#B0B0B0]'}`}
                      >
                        {email.sender}
                      </span>
                      {email.count && email.count > 1 && (
                        <span className="text-xs text-[#898989]">[{email.count}]</span>
                      )}
                      {email.label && (
                        <span
                          className={`rounded px-1 py-0.5 text-[10px] font-medium text-white ${email.label.color}`}
                        >
                          {email.label.text}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-[#8C8C8C]">{email.time}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-[#8C8C8C]">{email.subject}</div>
                  <div className="mt-0.5 truncate text-[10px] text-[#5C5C5C]">{email.preview}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thread Detail View */}
        <div className="flex flex-1 flex-col bg-[#1A1A1A]">
          {/* Thread Header */}
          <div className="flex items-center justify-between border-b border-[#2B2B2B] px-4 py-2.5">
            <div className="flex items-center gap-3">
              {/* Close */}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="#898989"><path d="M1.70711 0.292893C1.31658 -0.0976311 0.683418 -0.0976311 0.292893 0.292893C-0.0976311 0.683418 -0.0976311 1.31658 0.292893 1.70711L3.58579 5L0.292893 8.29289C-0.0976311 8.68342 -0.0976311 9.31658 0.292893 9.70711C0.683418 10.0976 1.31658 10.0976 1.70711 9.70711L5 6.41421L8.29289 9.70711C8.68342 10.0976 9.31658 10.0976 9.70711 9.70711C10.0976 9.31658 10.0976 8.68342 9.70711 8.29289L6.41421 5L9.70711 1.70711C10.0976 1.31658 10.0976 0.683418 9.70711 0.292893C9.31658 -0.0976311 8.68342 -0.0976311 8.29289 0.292893L5 3.58579L1.70711 0.292893Z" /></svg>
              <div className="h-4 w-px bg-[#2B2B2B]" />
              {/* ChevronLeft */}
              <svg width="5" height="8" viewBox="-2.5 -2 12 12" fill="#898989"><path fillRule="evenodd" clipRule="evenodd" d="M4.78033 0.21967C5.07322 0.512563 5.07322 0.987437 4.78033 1.28033L2.06066 4L4.78033 6.71967C5.07322 7.01256 5.07322 7.48744 4.78033 7.78033C4.48744 8.07322 4.01256 8.07322 3.71967 7.78033L0.46967 4.53033C0.176777 4.23744 0.176777 3.76256 0.46967 3.46967L3.71967 0.21967C4.01256 -0.0732233 4.48744 -0.0732233 4.78033 0.21967Z" /></svg>
              {/* ChevronRight */}
              <svg width="5" height="8" viewBox="-4 -2 12 12" fill="#898989"><path fillRule="evenodd" clipRule="evenodd" d="M0.21967 0.21967C0.512563 -0.0732233 0.987437 -0.0732233 1.28033 0.21967L4.53033 3.46967C4.82322 3.76256 4.82322 4.23744 4.53033 4.53033L1.28033 7.78033C0.987437 8.07322 0.512563 8.07322 0.21967 7.78033C-0.0732233 7.48744 -0.0732233 7.01256 0.21967 6.71967L2.93934 4L0.21967 1.28033C-0.0732232 0.987437 -0.0732232 0.512563 0.21967 0.21967Z" /></svg>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Reply All button */}
              <div className="inline-flex h-7 items-center gap-1 rounded-lg border-none bg-[#313131] px-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="#9B9B9B"><path fillRule="evenodd" clipRule="evenodd" d="M10.5 7.75C10.5 6.23122 9.26878 5 7.75 5H2.56066L4.78033 7.21967C5.07322 7.51256 5.07322 7.98744 4.78033 8.28033C4.48744 8.57322 4.01256 8.57322 3.71967 8.28033L0.21967 4.78033C-0.0732234 4.48744 -0.0732233 4.01256 0.21967 3.71967L3.71967 0.21967C4.01256 -0.0732233 4.48744 -0.0732233 4.78033 0.21967C5.07322 0.512563 5.07322 0.987437 4.78033 1.28033L2.56066 3.5L7.75 3.5C10.0972 3.5 12 5.40279 12 7.75C12 10.0972 10.0972 12 7.75 12H6.75C6.33579 12 6 11.6642 6 11.25C6 10.8358 6.33579 10.5 6.75 10.5H7.75C9.26878 10.5 10.5 9.26878 10.5 7.75Z" /></svg>
                <span className="whitespace-nowrap pl-0.5 pr-1 text-sm leading-none text-white">Reply all</span>
              </div>
              {/* Copy/Notes */}
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#313131]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#898989" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              </div>
              {/* Star */}
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#313131]">
                <svg width="20" height="20" viewBox="0 0 28 28" fill="transparent" stroke="#9D9D9D" strokeWidth="1.5"><path fillRule="evenodd" clipRule="evenodd" d="M10.7881 3.21068C11.2365 2.13274 12.7635 2.13273 13.2119 3.21068L15.2938 8.2164L20.6979 8.64964C21.8617 8.74293 22.3336 10.1952 21.4469 10.9547L17.3296 14.4817L18.5875 19.7551C18.8584 20.8908 17.623 21.7883 16.6267 21.1798L12 18.3538L7.37334 21.1798C6.37703 21.7883 5.14163 20.8908 5.41252 19.7551L6.67043 14.4817L2.55309 10.9547C1.66645 10.1952 2.13832 8.74293 3.30206 8.64964L8.70615 8.2164L10.7881 3.21068Z" /></svg>
              </div>
              {/* Archive */}
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#313131]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="#898989"><path d="M3 2C2.44772 2 2 2.44772 2 3V4C2 4.55228 2.44772 5 3 5H13C13.5523 5 14 4.55228 14 4V3C14 2.44772 13.5523 2 13 2H3Z" /><path fillRule="evenodd" clipRule="evenodd" d="M3 6H13V12C13 13.1046 12.1046 14 11 14H5C3.89543 14 3 13.1046 3 12V6ZM6 8.75C6 8.33579 6.33579 8 6.75 8H9.25C9.66421 8 10 8.33579 10 8.75C10 9.16421 9.66421 9.5 9.25 9.5H6.75C6.33579 9.5 6 9.16421 6 8.75Z" /></svg>
              </div>
              {/* Trash */}
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#6E2532] bg-[#411D23]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="#F43F5E"><path fillRule="evenodd" clipRule="evenodd" d="M5 3.25V4H2.75C2.33579 4 2 4.33579 2 4.75C2 5.16421 2.33579 5.5 2.75 5.5H3.05L3.86493 13.6493C3.94161 14.4161 4.58685 15 5.35748 15H10.6425C11.4131 15 12.0584 14.4161 12.1351 13.6493L12.95 5.5H13.25C13.6642 5.5 14 5.16421 14 4.75C14 4.33579 13.6642 4 13.25 4H11V3.25C11 2.00736 9.99264 1 8.75 1H7.25C6.00736 1 5 2.00736 5 3.25ZM7.25 2.5C6.83579 2.5 6.5 2.83579 6.5 3.25V4H9.5V3.25C9.5 2.83579 9.16421 2.5 8.75 2.5H7.25ZM6.05044 6.00094C6.46413 5.98025 6.81627 6.29885 6.83696 6.71255L7.11195 12.2125C7.13264 12.6262 6.81404 12.9784 6.40034 12.9991C5.98665 13.0197 5.63451 12.7011 5.61383 12.2875L5.33883 6.78745C5.31814 6.37376 5.63674 6.02162 6.05044 6.00094ZM9.95034 6.00094C10.364 6.02162 10.6826 6.37376 10.662 6.78745L10.387 12.2875C10.3663 12.7011 10.0141 13.0197 9.60044 12.9991C9.18674 12.9784 8.86814 12.6262 8.88883 12.2125L9.16383 6.71255C9.18451 6.29885 9.53665 5.98025 9.95034 6.00094Z" /></svg>
              </div>
              {/* Three dots */}
              <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#313131]">
                <svg width="12" height="4" viewBox="0 0 12 4" fill="#898989"><path d="M0 2C0 1.17157 0.671573 0.5 1.5 0.5C2.32843 0.5 3 1.17157 3 2C3 2.82843 2.32843 3.5 1.5 3.5C0.671573 3.5 0 2.82843 0 2Z" /><path d="M4.5 2C4.5 1.17157 5.17157 0.5 6 0.5C6.82843 0.5 7.5 1.17157 7.5 2C7.5 2.82843 6.82843 3.5 6 3.5C5.17157 3.5 4.5 2.82843 4.5 2Z" /><path d="M10.5 0.5C9.67157 0.5 9 1.17157 9 2C9 2.82843 9.67157 3.5 10.5 3.5C11.3284 3.5 12 2.82843 12 2C12 1.17157 11.3284 0.5 10.5 0.5Z" /></svg>
              </div>
            </div>
          </div>

          {/* Thread Content */}
          <div className="flex-1 overflow-hidden px-4 py-4">
            <h2 className="text-base font-semibold text-white">
              Introduction - Series A Discussion{' '}
              <span className="text-[#898989]">[2]</span>
            </h2>

            {/* Sender chips */}
            <div className="mt-2 flex items-center gap-1">
              <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face" alt="James Miller" className="h-5 w-5 rounded-full object-cover" />
              <span className="text-xs text-[#898989]">James Miller</span>
            </div>

            {/* First message */}
            <div className="mt-5 border-t border-[#2B2B2B] pt-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face" alt="James Miller" className="h-8 w-8 rounded-full object-cover" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">James Miller</span>
                      <span className="text-xs text-[#898989]">Details</span>
                    </div>
                    <span className="text-xs text-[#898989]">To: You</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#8C8C8C]">Dec 04</span>
                  <span className="text-xs text-[#8C8C8C]">11:47 PM</span>
                  <div className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#313131]">
                    <svg width="12" height="4" viewBox="0 0 12 4" fill="#898989"><path d="M0 2C0 1.17157 0.671573 0.5 1.5 0.5C2.32843 0.5 3 1.17157 3 2C3 2.82843 2.32843 3.5 1.5 3.5C0.671573 3.5 0 2.82843 0 2Z" /><path d="M4.5 2C4.5 1.17157 5.17157 0.5 6 0.5C6.82843 0.5 7.5 1.17157 7.5 2C7.5 2.82843 6.82843 3.5 6 3.5C5.17157 3.5 4.5 2.82843 4.5 2Z" /><path d="M10.5 0.5C9.67157 0.5 9 1.17157 9 2C9 2.82843 9.67157 3.5 10.5 3.5C11.3284 3.5 12 2.82843 12 2C12 1.17157 11.3284 0.5 10.5 0.5Z" /></svg>
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#D0D0D0]">
                <p>Hi there,</p>
                <p>
                  I'm James Miller, a Partner at Meridian Ventures. We've been following SolMail's
                  progress and are impressed by the traction you've gained in the incentivized email space.
                </p>
                <p>
                  Would you be open to a 30-minute call next week to discuss your Series A plans? We
                  typically invest $2-5M at this stage.
                </p>
                <p>
                  Best regards,
                  <br />
                  James Miller
                  <br />
                  <span className="text-[#898989]">Partner, Meridian Ventures</span>
                </p>
              </div>

              <div className="mt-3 text-xs text-[#006FFE]">Sent via Solmail</div>
            </div>

            {/* Reply actions */}
            <div className="mt-6 flex items-center gap-2">
              <div className="flex h-8 items-center gap-1.5 rounded-lg border border-[#2B2B2B] px-3 text-sm text-[#B0B0B0]">
                <ReplyIcon />
                <span>Reply</span>
              </div>
              <div className="flex h-8 items-center gap-1.5 rounded-lg border border-[#2B2B2B] px-3 text-sm text-[#B0B0B0]">
                <ReplyAllIcon />
                <span>Reply All</span>
              </div>
              <div className="flex h-8 items-center gap-1.5 rounded-lg border border-[#2B2B2B] px-3 text-sm text-[#B0B0B0]">
                <ForwardIcon />
                <span>Forward</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
