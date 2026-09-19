import { useEffect, useState } from 'react';

import { analysisFor } from '../mocks/analysis.mock';
import { fireById } from '../mocks/fires.mock';
import { ActionsCard } from './ActionsCard';
import { type Decision, decisionKey } from './decisions';
import { FireInfoCard } from './FireInfoCard';
import { Legend } from './Legend';
import { PrioritiesCard } from './PrioritiesCard';
import { MENU_STORAGE_KEY, readCollapsed } from './menuStorage';
import { SideMenu } from './SideMenu';
import { ArrowLeftIcon } from './icons';
import { clearSelection, type Route } from './route';

/** DESIGN.md §5. Un solo token de movimiento para toda la interfaz. */
const DURATION_MS = 400;

/**
 * La capa flotante de UX.md §2. Todo lo que hay aquí está en `absolute` sobre el mapa,
 * y el contenedor lleva `pointer-events-none`: cada tarjeta se queda los clics que le
 * tocan y el resto de la pantalla sigue siendo mapa. Sin esto, la UI se come el picking
 * en las zonas vacías y parece un fallo del mapa cuando es de CSS.
 *
 *   z-30  flecha de volver
 *   z-20  menú lateral / cards de detalle
 *   z-10  leyenda
 *   z-0   mapa (fuera de este componente)
 */
export function Shell({ route, activeFires }: { route: Route; activeFires: number }) {
  const fire = fireById(route.selection);
  const open = fire !== null;

  /*
   * El registro de decisiones vive aquí y no dentro de la tarjeta: sobrevive a cerrar
   * y volver a abrir un foco, que es justo lo que hace un coordinador. Se pierde al
   * recargar; persistirlo es cosa del backend (spec §6.5, POST .../decision).
   */
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  /*
   * El ancho del menú lo necesita también la leyenda, que se aparta para no quedar
   * debajo. Por eso el estado vive aquí y no dentro de SideMenu.
   */
  const [collapsed, setCollapsed] = useState(readCollapsed);
  useEffect(() => {
    try {
      window.localStorage.setItem(MENU_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // Navegación privada o almacenamiento lleno: se pierde la preferencia y ya está.
    }
  }, [collapsed]);

  /*
   * El detalle se mantiene montado 400 ms después de deseleccionar para que la salida
   * se vea. Si se desmontara al instante, las tarjetas desaparecerían de golpe
   * mientras el menú entra despacio, y la transición quedaría a medias.
   */
  const [shown, setShown] = useState(fire);
  // Entrar es inmediato y se ajusta durante el render, no en un efecto: esperar a un
  // efecto costaría un fotograma con el panel vacío.
  if (fire && fire !== shown) setShown(fire);
  useEffect(() => {
    if (fire) return;
    const timer = window.setTimeout(() => setShown(null), DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [fire]);

  // Esc deselecciona: es el atajo del botón de volver (UX.md §5 y §11).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const analysis = shown ? analysisFor(shown.id) : null;

  return (
    <div className="pointer-events-none absolute inset-0 text-text">
      <SideMenu
        page={route.page}
        hidden={open}
        activeFires={activeFires}
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
      />

      {/* La leyenda se retira con el menú: mientras hay un incendio abierto, solo ese
          incendio (UX.md §0, regla 2). La columna izquierda ocupa su sitio. */}
      <Legend
        className={`absolute bottom-4 z-10 transition-[opacity,transform,left] ${
          collapsed ? 'left-24' : 'left-73'
        } ${
          open ? 'pointer-events-none -translate-x-8 opacity-0' : 'translate-x-0 opacity-100'
        }`}
      />

      {shown && (
        <>
          {/* Columna izquierda, 360px: volver arriba del todo y debajo la información. */}
          <div
            aria-hidden={!open}
            inert={!open || undefined}
            className={`absolute top-4 bottom-4 left-4 z-20 flex w-90 flex-col gap-4 overflow-y-auto transition-[opacity,transform] ${
              open ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'
            }`}
          >
            <div className="z-30 flex">
              <button
                type="button"
                onClick={clearSelection}
                aria-label="Volver a la vista general"
                className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-md border border-night-700 bg-night-800/92 text-muted backdrop-blur-sm transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
              >
                <ArrowLeftIcon />
              </button>
            </div>
            <FireInfoCard fire={shown} />
          </div>

          {/* Columna derecha, 360px: acciones arriba, prioridades debajo. */}
          <div
            aria-hidden={!open}
            inert={!open || undefined}
            className={`absolute top-4 right-4 bottom-4 z-20 flex w-90 flex-col gap-4 overflow-y-auto transition-[opacity,transform] ${
              open ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
            }`}
          >
            {analysis && (
              <>
                <ActionsCard
                  analysis={analysis}
                  decisions={decisions}
                  onDecide={(actionId, status) =>
                    setDecisions((prev) => ({
                      ...prev,
                      [decisionKey(analysis.target_id, actionId)]: {
                        status,
                        at: new Date().toISOString(),
                      },
                    }))
                  }
                />
                <PrioritiesCard fire={shown} analysis={analysis} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
