import {
  LayoutDashboard, Ticket, Users, UserCircle,
  Radio, History, ClipboardList, Dice5, Globe,
  UserCircle2, ShoppingBag,
} from 'lucide-react';
import type { AppPage } from '@/types';
import { cn } from '@/lib/utils';

interface SidebarProps {
  currentPage: AppPage;
  onPageChange: (page: AppPage) => void;
  pendingCount?: number;
  operatorName?: string;
}

const NAV_ITEMS: { page: AppPage; label: string; icon: React.ElementType }[] = [
  { page: 'dashboard',         label: 'Dashboard',     icon: LayoutDashboard },
  { page: 'sheets',            label: 'Sheet Factory', icon: Ticket          },
  { page: 'agents',            label: 'Agents',        icon: Users           },
  { page: 'players',           label: 'Players',       icon: UserCircle      },
  { page: 'pending-payments',  label: 'Orders',        icon: ClipboardList   },
  { page: 'live-game',         label: 'Live Game',     icon: Radio           },
  { page: 'history',           label: 'History',       icon: History         },
  { page: 'settings',          label: 'My Games',      icon: Globe           },
  { page: 'profile',           label: 'Profile',       icon: UserCircle2     },
];

export function Sidebar({ currentPage, onPageChange, pendingCount = 0, operatorName }: SidebarProps) {
  return (
    <aside
      className="hidden md:flex w-48 flex-col shrink-0 border-r border-black/10"
      style={{ backgroundColor: '#0284c7' }}
    >
      {/* Logo */}
      <div className="px-4 py-4 border-b border-black/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.22)' }}>
            <Dice5 className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-white tracking-tight leading-none">TukpaMaster</p>
            {operatorName && <p className="text-[9px] text-white/40 truncate mt-0.5">{operatorName}</p>}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const isActive = currentPage === item.page;
          const badge = item.page === 'pending-payments' && pendingCount > 0 ? pendingCount : null;
          return (
            <button
              key={item.page}
              onClick={() => onPageChange(item.page)}
              className={cn(
                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all',
                isActive ? 'bg-black/25 text-white shadow-inner' : 'text-white/55 hover:bg-black/15 hover:text-white'
              )}
            >
              <div className="relative shrink-0">
                <item.icon className={cn('w-3.5 h-3.5', isActive ? 'text-white' : 'text-white/50')} />
                {item.page === 'live-game' && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                )}
              </div>
              <span className="flex-1 text-left">{item.label}</span>
              {badge && (
                <span className="min-w-[18px] h-4 bg-white text-[9px] font-black rounded-full flex items-center justify-center px-1"
                  style={{ color: '#0284c7' }}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

/* Mobile bottom nav — 5 primary pages */
export function MobileBottomNav({
  currentPage, onPageChange, pendingCount = 0,
}: {
  currentPage: AppPage;
  onPageChange: (page: AppPage) => void;
  pendingCount?: number;
}) {
  const ITEMS: { page: AppPage; label: string; icon: React.ElementType }[] = [
    { page: 'dashboard',        label: 'Home',    icon: LayoutDashboard },
    { page: 'live-game',        label: 'Live',    icon: Radio           },
    { page: 'pending-payments', label: 'Orders',  icon: ShoppingBag     },
    { page: 'settings',         label: 'Games',   icon: Globe           },
    { page: 'profile',          label: 'Profile', icon: UserCircle2     },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-black/15"
      style={{ backgroundColor: '#0284c7', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {ITEMS.map(item => {
        const isActive = currentPage === item.page;
        const badge = item.page === 'pending-payments' && pendingCount > 0 ? pendingCount : null;
        return (
          <button
            key={item.page}
            onClick={() => onPageChange(item.page)}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 text-[9px] font-semibold transition-colors relative',
              isActive ? 'text-white' : 'text-white/45'
            )}
          >
            <div className="relative">
              <item.icon className="w-5 h-5" />
              {item.page === 'live-game' && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              )}
              {badge ? (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 bg-amber-400 text-slate-900 text-[8px] font-black rounded-full flex items-center justify-center px-0.5">
                  {badge > 9 ? '9+' : badge}
                </span>
              ) : null}
            </div>
            <span>{item.label}</span>
            {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-white rounded-full" />}
          </button>
        );
      })}
    </nav>
  );
}
