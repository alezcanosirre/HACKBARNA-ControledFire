import { Surface } from './Surface';

/**
 * Leyenda de UX.md §4, abajo a la izquierda junto al menú: los cinco estados de celda
 * de spec.md §4.7.
 *
 * Los cálidos de aquí son los mismos que pinta el mapa, y es el único sitio de la
 * interfaz donde aparecen: la leyenda no es decoración, es la clave del dato.
 *
 * Nota: el mapa hoy solo pinta NORMAL y BURNING (src/map/colors.ts). Los otros tres
 * estados están en el spec y se enseñan porque la leyenda es del spec, no de lo que
 * haya implementado hoy la capa.
 */
const STATES = [
  { label: 'Sin estado', fill: 'bg-transparent', line: 'border-cell-grid/30' },
  { label: 'Vigilada', fill: 'bg-cell-watch/22', line: 'border-cell-watch-line/45' },
  { label: 'En riesgo', fill: 'bg-cell-risk/47', line: 'border-cell-risk-line/67' },
  { label: 'Activa', fill: 'bg-cell-active/80', line: 'border-cell-active-line/92' },
  { label: 'Controlada', fill: 'bg-cell-contained/35', line: 'border-cell-contained-line/51' },
];

export function Legend({ className = '' }: { className?: string }) {
  return (
    <Surface as="aside" className={className}>
      <ul className="flex flex-col gap-2">
        {STATES.map(({ label, fill, line }) => (
          <li key={label} className="flex items-center gap-3">
            <span aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 border ${fill} ${line}`} />
            <span className="text-meta text-dim">{label}</span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
