import { useEffect } from 'react';
import { LogOut, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* Shared mobile chrome for both plans.
 *
 * The phone layout used to expose a hard-coded handful of pages in the bottom
 * bar and hide the rest behind a left drawer that had no safe-area padding and
 * no scroll clearance, so on a notched phone in standalone mode the lower nav
 * entries sat under the home indicator and were unreachable. Everything lives
 * in a bottom sheet now: it is thumb-reachable, scrolls, and always pads itself
 * clear of the home indicator however many entries a plan has. */

export interface NavEntry {
  /** App page key — typed as string here so both plans' page unions fit. */
  page: string;
  label: string;
  /** Shorter caption for the cramped bottom bar; falls back to `label`. */
  short?: string;
  icon: React.ElementType;
}

const PANEL = 'linear-gradient(180deg,#5b21b6,#2e1065)';

/** Freezes background scroll while an overlay owns the screen. */
function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [active]);
}

/** Closes an overlay on Escape (hardware keyboards, desktop dev). */
function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onClose]);
}

// ── Sidebar / sheet row ───────────────────────────────────────────────────────

export function NavItem({ page, label, icon: Icon, active, badge, onClick }: {
  page: string; label: string; icon: React.ElementType; active: boolean;
  badge?: number; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={cn(
      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left',
      active ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white/80',
    )}>
      <div className="relative shrink-0">
        <Icon className="w-4 h-4" />
        {page === 'live-game' && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
      </div>
      <span className="flex-1 truncate">{label}</span>
      {badge ? (
        <span className="min-w-[18px] h-4 bg-amber-400 text-slate-900 text-[9px] font-black rounded-full flex items-center justify-center px-1">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </button>
  );
}

// ── Bottom tab bar ────────────────────────────────────────────────────────────

export function BottomNav({
  items, currentPage, onSelect, badges = {}, onMore, moreOpen, moreIcon: MoreIcon, moreLabel = 'More',
  moreActive = false,
}: {
  items: NavEntry[];
  currentPage: string;
  onSelect: (page: string) => void;
  badges?: Record<string, number>;
  /** Opens the full-menu sheet. Rendered as a final tab when provided. */
  onMore?: () => void;
  moreOpen?: boolean;
  moreIcon?: React.ElementType;
  moreLabel?: string;
  /** Highlight the More tab when the open page lives only inside the sheet. */
  moreActive?: boolean;
}) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-white/10 pb-safe px-safe"
      style={{ background: PANEL }}
    >
      {items.map(n => {
        const active = currentPage === n.page;
        const badge = badges[n.page] ?? 0;
        return (
          <button
            key={n.page}
            onClick={() => onSelect(n.page)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] text-[10px] font-semibold relative transition-colors',
              active ? 'text-white' : 'text-white/40',
            )}
          >
            <div className="relative">
              <n.icon className="w-5 h-5" />
              {n.page === 'live-game' && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
              {badge > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[14px] h-3.5 bg-amber-400 text-slate-900 text-[8px] font-black rounded-full flex items-center justify-center px-0.5">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </div>
            <span className="max-w-full truncate px-0.5">{n.short ?? n.label}</span>
            {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />}
          </button>
        );
      })}

      {onMore && MoreIcon && (
        <button
          onClick={onMore}
          aria-expanded={moreOpen}
          aria-label="More pages"
          className={cn(
            'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] text-[10px] font-semibold relative transition-colors',
            moreOpen || moreActive ? 'text-white' : 'text-white/40',
          )}
        >
          <MoreIcon className="w-5 h-5" />
          <span className="max-w-full truncate px-0.5">{moreLabel}</span>
          {moreActive && !moreOpen && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />}
        </button>
      )}
    </nav>
  );
}

// ── Full-menu bottom sheet ────────────────────────────────────────────────────

export function MoreSheet({
  open, onClose, title, subtitle, items, currentPage, onSelect, badges = {}, planLabel, onLogout,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: NavEntry[];
  currentPage: string;
  onSelect: (page: string) => void;
  badges?: Record<string, number>;
  planLabel?: string;
  onLogout?: () => void;
}) {
  useScrollLock(open);
  useEscape(open, onClose);

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={`${title} menu`}>
      <button className="absolute inset-0 bg-black/60 cursor-default" aria-label="Close menu" onClick={onClose} />

      <div
        className="relative w-full flex flex-col rounded-t-3xl shadow-2xl max-h-[88dvh] overflow-hidden"
        style={{ background: PANEL, animation: 'sheet-up .24s cubic-bezier(.32,.72,0,1)' }}
      >
        {/* Grab handle + heading */}
        <div className="shrink-0 px-4 pt-2.5 pb-3 border-b border-white/10">
          <div className="w-10 h-1 rounded-full bg-white/25 mx-auto mb-3" />
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white leading-tight truncate">{title}</p>
              {subtitle && <p className="text-[11px] text-white/40 truncate">{subtitle}</p>}
            </div>
            <button onClick={onClose} aria-label="Close menu" className="shrink-0 w-9 h-9 rounded-full bg-white/10 text-white/70 flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Every page, as thumb-sized tiles. Scrolls when a plan has many. */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3">
          <div className="grid grid-cols-2 gap-2">
            {items.map(n => {
              const active = currentPage === n.page;
              const badge = badges[n.page] ?? 0;
              return (
                <button
                  key={n.page}
                  onClick={() => { onSelect(n.page); onClose(); }}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center gap-2.5 p-3 rounded-2xl text-left transition-colors min-h-[56px]',
                    active ? 'bg-white/20 text-white' : 'bg-white/[0.07] text-white/70 active:bg-white/15',
                  )}
                >
                  <div className="relative shrink-0">
                    <n.icon className="w-5 h-5" />
                    {n.page === 'live-game' && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                  </div>
                  <span className="text-xs font-semibold leading-tight flex-1 min-w-0 break-words">{n.label}</span>
                  {badge > 0 && (
                    <span className="shrink-0 min-w-[18px] h-[18px] bg-amber-400 text-slate-900 text-[9px] font-black rounded-full flex items-center justify-center px-1">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer sits above the home indicator, so it is always tappable. */}
        <div className="shrink-0 px-4 py-3 border-t border-white/10 flex items-center gap-3 pb-safe">
          {planLabel && <p className="text-[10px] text-white/30 flex-1 truncate">{planLabel}</p>}
          {onLogout && (
            <button
              onClick={() => { onClose(); onLogout(); }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 text-white/70 text-xs font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
