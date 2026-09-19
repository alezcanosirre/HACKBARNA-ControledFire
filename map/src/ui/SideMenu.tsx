import { CollapseIcon, ExpandIcon, FlameIcon, ForecastIcon, PlayIcon } from './icons';
import { goToPage, type Page } from './route';

interface Item {
  page: Page;
  label: string;
  hint: string;
  Icon: typeof FlameIcon;
}

const ITEMS: Item[] = [
  { page: 'actual', label: 'Fuegos activos', hint: '', Icon: FlameIcon },
  { page: 'pred', label: 'Predicción', hint: 'próximas 24 h', Icon: ForecastIcon },
];

/**
 * Menú lateral de UX.md §3. Flotante a la izquierda y casi toda la altura de la
 * ventana: se ve el mapa por arriba, por abajo y por los lados, y eso es lo que lo
 * hace flotar.
 *
 * Al seleccionar una celda no se apaga ni se contrae: se va (UX.md §0, regla 2).
 * Quien lo saca de pantalla es Shell, con `hidden`.
 */
export function SideMenu({ page, hidden, activeFires, collapsed, onToggle }: {
  page: Page;
  hidden: boolean;
  /** El contador en vivo. Es el dato que dice si la pantalla merece atención ahora. */
  activeFires: number;
  /** El ancho lo gobierna Shell: la leyenda tiene que apartarse del menú. */
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <nav
      aria-label="Páginas"
      aria-hidden={hidden}
      inert={hidden || undefined}
      className={`pointer-events-auto absolute top-4 bottom-4 left-4 z-20 flex flex-col rounded-md border border-night-700 bg-night-800/92 p-2 backdrop-blur-sm transition-[width,transform,opacity] ${
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
          aria-label={collapsed ? 'Expandir el menú' : 'Contraer el menú'}
          aria-expanded={!collapsed}
          className="flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors hover:bg-night-700/50 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
        >
          {collapsed ? <ExpandIcon /> : <CollapseIcon />}
        </button>
      </header>

      <ul className="mt-4 flex flex-col gap-2">
        {ITEMS.map(({ page: target, label, hint, Icon }) => {
          const active = page === target;
          // El contador solo tiene sentido en la página que lo cuenta.
          const subtitle = target === 'actual' ? `${activeFires} ahora mismo` : hint;
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
                    ? 'bg-night-700 text-text'
                    : 'text-muted hover:bg-night-700/50 hover:text-text'
                }`}
              >
                {/*
                  El estado activo no se marca solo con color: la barra de 2px es la
                  forma que exige DESIGN.md §6.
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
        SIMULATION es de otra naturaleza que los dos de arriba: no navega, ejecuta.
        Por eso va al fondo y separado por una línea.
        Queda NEUTRO y sin acción a propósito: el rojo que pediste está pendiente de
        decisión en UX.md §9, y hasta que se cierre no se pinta ni se conecta.
      */}
      <div className="mt-auto border-t border-night-700 pt-3">
        <button
          type="button"
          disabled
          title="Pendiente de decisión (UX.md §9)"
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
