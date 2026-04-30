import {
  LayoutDashboard, Ticket, Users, UserCircle,
  Radio, History,
  ClipboardList, Dice5, Settings2,
} from 'lucide-react';
import type { AppPage } from '@/types';
import { cn } from '@/lib/utils';

interface SidebarProps {
  currentPage: AppPage;
  onPageChange: (page: AppPage) => void;
  pendingCount?: number;
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
  { page: 'settings',         label: 'Settings',  icon: Settings2 },
];

export function Sidebar({ currentPage, onPageChange, pendingCount = 0 }: SidebarProps) {
  const renderItem = (item: typeof TOP_NAV[0]) => {
    const isActive = currentPage === item.page;
    const badge = item.page === 'pending-payments' && pendingCount > 0 ? pendingCount : null;

    return (
      <button
        key={item.page}
        onClick={() => onPageChange(item.page)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all',
          isActive
            ? 'bg-black/25 text-white shadow-inner'
            : 'text-white/60 hover:bg-black/15 hover:text-white'
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
      className="w-52 flex flex-col shrink-0 border-r border-black/10"
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
    </aside>
  );
}
