import { CollapseIcon, ExpandIcon, FlameIcon, ForecastIcon, PlayIcon } from './icons';
import { goToPage, type Page } from './route';

interface Item {
  page: Page;
  label: string;
  hint: string;
  Icon: typeof FlameIcon;
}

const ITEMS: Item[] = [
  { page: 'actual', label: 'Active fires', hint: '', Icon: FlameIcon },
  { page: 'pred', label: 'Forecast', hint: 'next 24 h', Icon: ForecastIcon },
];

/**
 * The side menu of UX.md §3. Floating on the left and nearly the full height of the
 * window: the map shows above it, below it and on both sides, and that is what makes
 * it read as floating.
 *
 * Selecting a cell does not dim it or collapse it: it leaves (UX.md §0, rule 2). Shell
 * is what takes it off screen, through `hidden`.
 */
export function SideMenu({ page, hidden, activeFires, collapsed, onToggle }: {
  page: Page;
  hidden: boolean;
  /** The live counter. It is the figure that says whether this screen needs attention now. */
  activeFires: number;
  /** Shell owns the width: the legend has to step aside from the menu. */
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <nav
      aria-label="Pages"
      aria-hidden={hidden}
      inert={hidden || undefined}
      className={`pointer-events-auto absolute top-4 bottom-4 left-4 z-20 flex flex-col rounded-md border border-line bg-surface/92 p-2 backdrop-blur-sm transition-[width,transform,opacity] ${
        collapsed ? 'w-16' : 'w-65'
      } ${hidden ? '-translate-x-[calc(100%+1rem)] opacity-0' : 'translate-x-0 opacity-100'}`}
    >
      <header className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <span className="pl-2 text-label font-medium text-text">ControlledFire</span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          aria-expanded={!collapsed}
          className="flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-2/60 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
        >
          {collapsed ? <ExpandIcon /> : <CollapseIcon />}
        </button>
      </header>

      <ul className="mt-4 flex flex-col gap-2">
        {ITEMS.map(({ page: target, label, hint, Icon }) => {
          const active = page === target;
          // The counter only means something on the page that counts them.
          const subtitle = target === 'actual' ? `${activeFires} right now` : hint;
          return (
            <li key={target}>
              <button
                type="button"
                onClick={() => goToPage(target)}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? label : undefined}
                className={`relative flex w-full items-center gap-3 rounded-sm py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text ${
                  collapsed ? 'justify-center px-2' : 'px-4'
                } ${
                  active
                    ? 'bg-surface-2 text-text'
                    : 'text-muted hover:bg-surface-2/60 hover:text-text'
                }`}
              >
                {/*
                  The active state is never marked by colour alone: the 2px bar is the
                  shape DESIGN.md §6 requires.
                */}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-2 bottom-2 left-0 w-0.5 rounded-sm bg-text"
                  />
                )}
                <Icon />
                {!collapsed && (
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-label font-medium">{label}</span>
                    <span
                      className={`block truncate text-meta ${active ? 'text-dim' : 'text-muted'}`}
                    >
                      {subtitle}
                    </span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/*
        SIMULATION is a different kind of thing from the two above: it does not
        navigate, it runs. Hence the bottom of the menu, separated by a rule.
        It is deliberately NEUTRAL and inert: the red you asked for is still pending a
        decision in UX.md §9, and until that closes it is neither painted nor wired.
      */}
      <div className="mt-auto border-t border-line pt-3">
        <button
          type="button"
          disabled
          title="Pending decision (UX.md §9)"
          className={`flex w-full cursor-not-allowed items-center gap-3 rounded-sm py-3 text-muted opacity-60 ${
            collapsed ? 'justify-center px-2' : 'px-4'
          }`}
        >
          <PlayIcon />
          {!collapsed && <span className="text-label font-medium">Simulation</span>}
        </button>
      </div>
    </nav>
  );
}
