import {
  LayoutDashboard, Ticket, Users, UserCircle,
  Radio, History, ClipboardList, Dice5, Globe, LogOut,
} from 'lucide-react';
import type { AppPage } from '@/types';
import { cn } from '@/lib/utils';

interface SidebarProps {
  currentPage: AppPage;
  onPageChange: (page: AppPage) => void;
  pendingCount?: number;
  onLogout?: () => void;
}

const TOP_NAV: { page: AppPage; label: string; icon: React.ElementType }[] = [
  { page: 'dashboard',   label: 'Dashboard',     icon: LayoutDashboard },
  { page: 'sheets',      label: 'Sheet Factory', icon: Ticket },
  { page: 'agents',      label: 'Agents',        icon: Users },
  { page: 'players',     label: 'Players',       icon: UserCircle },
];

const BOTTOM_NAV: { page: AppPage; label: string; icon: React.ElementType }[] = [
  { page: 'pending-payments', label: 'Payments',  icon: ClipboardList },
  { page: 'live-game',        label: 'Live Game', icon: Radio },
  { page: 'history',          label: 'History',   icon: History },
  { page: 'settings',         label: 'Market',    icon: Globe },
];

export const ALL_NAV = [...TOP_NAV, ...BOTTOM_NAV];

export function Sidebar({ currentPage, onPageChange, pendingCount = 0, onLogout }: SidebarProps) {
  const renderItem = (item: typeof TOP_NAV[0]) => {
    const isActive = currentPage === item.page;
    const badge = item.page === 'pending-payments' && pendingCount > 0 ? pendingCount : null;

    return (
      <button
        key={item.page}
        onClick={() => onPageChange(item.page)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all',
          isActive ? 'bg-black/25 text-white shadow-inner' : 'text-white/60 hover:bg-black/15 hover:text-white'
        )}
      >
        <div className="relative shrink-0">
          <item.icon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-white/50')} />
          {item.page === 'live-game' && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          )}
        </div>
        <span className="flex-1 text-left">{item.label}</span>
        {badge && (
          <span className="min-w-[20px] h-5 bg-white text-[10px] font-black rounded-full flex items-center justify-center px-1"
            style={{ color: '#0284c7' }}>
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside
      className="hidden md:flex w-52 flex-col shrink-0 border-r border-black/10"
      style={{ backgroundColor: '#0284c7' }}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-black/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.22)' }}>
            <Dice5 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-black text-white tracking-tight">TukpaMaster</p>
            <p className="text-[10px] text-white/50 font-medium uppercase tracking-widest">Operator</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
        {TOP_NAV.map(renderItem)}
        <div className="my-2 mx-1 h-px bg-black/15" />
        {BOTTOM_NAV.map(renderItem)}
      </nav>

      {onLogout && (
        <div className="p-2.5 border-t border-black/10 shrink-0">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white/40 hover:bg-black/15 hover:text-white/80 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="flex-1 text-left">Logout</span>
          </button>
        </div>
      )}
    </aside>
  );
}

/* Mobile bottom nav bar for Plan B */
export function MobileBottomNav({
  currentPage, onPageChange, pendingCount = 0,
}: {
  currentPage: AppPage;
  onPageChange: (page: AppPage) => void;
  pendingCount?: number;
}) {
  const PRIMARY: { page: AppPage; label: string; icon: React.ElementType }[] = [
    { page: 'dashboard',         label: 'Home',     icon: LayoutDashboard },
    { page: 'live-game',         label: 'Live',     icon: Radio },
    { page: 'pending-payments',  label: 'Orders',   icon: ClipboardList },
    { page: 'settings',          label: 'Market',   icon: Globe },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-black/15"
      style={{ backgroundColor: '#0284c7', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {PRIMARY.map(item => {
        const isActive = currentPage === item.page;
        const badge = item.page === 'pending-payments' && pendingCount > 0 ? pendingCount : null;
        return (
          <button
            key={item.page}
            onClick={() => onPageChange(item.page)}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold relative transition-colors',
              isActive ? 'text-white' : 'text-white/45 hover:text-white/80'
            )}
          >
            <div className="relative">
              <item.icon className="w-5 h-5" />
              {item.page === 'live-game' && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              )}
              {badge ? (
                <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 bg-amber-400 text-slate-900 text-[9px] font-black rounded-full flex items-center justify-center px-0.5">
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
