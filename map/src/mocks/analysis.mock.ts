import type { AIAnalysis } from './types';

/**
 * Respuesta de la IA para cada foco del escenario (spec.md §8). El de Collserola está
 * escrito y revisado a mano: es el texto que van a leer los jueces, y si la llamada al
 * modelo falla en directo, el hook cae aquí sin que se note.
 *
 * `action_id` referencia el catálogo. Cuando se conecte el motor, cada uno de estos ids
 * tiene que resolver contra la unión cerrada de `Action` (WAIT, DEPLOY_RESOURCE,
 * CREATE_FIREBREAK): la IA elige y ordena dentro del catálogo, no inventa acciones.
 */
const ANALYSES: AIAnalysis[] = [
  {
    target_id: 'fire-1',
    summary:
      'Fuego en interfaz urbano-forestal con viento de poniente de 27 km/h empujando ' +
      'la cabeza hacia el nordeste. El combustible está alto y la humedad relativa ha ' +
      'caído al 18%. Hay población a sotavento a menos de dos kilómetros.',
    priority_rationale:
      'Primero lo que no se puede mover y está en la trayectoria del viento; después ' +
      'la cabeza del frente; el corte de la vía va detrás porque hoy solo protege ' +
      'material.',
    actions: [
      {
        action_id: 'EVACUATE_SCHOOL',
        label: 'Evacuar el CEIP Sant Jordi',
        rank: 1,
        urgency: 'immediate',
        why: '420 personas a 1,8 km y a sotavento. Con 27 km/h el frente cubre esa distancia en unos 25 minutos; una evacuación escolar necesita más.',
        resources: ['Policia Local', 'Autocars'],
        eta_min: 25,
        status: 'proposed',
      },
      {
        action_id: 'DEPLOY_RESOURCE:helicopter',
        label: 'Helicóptero a la cabeza del frente',
        rank: 2,
        urgency: 'immediate',
        why: 'Atacar el flanco nordeste, que es por donde avanza. Base de Sabadell a 25 minutos de vuelo.',
        resources: ['Helicòpter bombarder'],
        eta_min: 25,
        status: 'proposed',
      },
      {
        action_id: 'CREATE_FIREBREAK',
        label: 'Cortar la BV-1415 y abrir cortafuegos',
        rank: 3,
        urgency: 'soon',
        why: 'La vía queda a 0,9 km en el flanco sur y sirve de línea de defensa. Cortarla evita tráfico dentro de la zona de trabajo.',
        resources: ['Mossos', 'Dotació terrestre'],
        eta_min: 40,
        status: 'proposed',
      },
    ],
    model: 'nebius/llama-3.3-70b',
    generated_at: '2026-09-19T14:33:10+02:00',
  },
  {
    target_id: 'fire-2',
    summary:
      'Bosque puro en pendiente del 21% y carga de combustible extrema. El viento es ' +
      'flojo pero la pendiente empuja hacia arriba por sí sola.',
    priority_rationale:
      'Sin población inmediata, la prioridad es la línea eléctrica y contener antes de ' +
      'que el fuego coja la vaguada.',
    actions: [
      {
        action_id: 'DEPLOY_RESOURCE:ground',
        label: 'Dotación terrestre al flanco este',
        rank: 1,
        urgency: 'immediate',
        why: 'La línea de 220 kV está a 2,2 km y a sotavento. Perderla deja sin suministro a tres municipios.',
        resources: ['2 dotacions GRAF'],
        eta_min: 35,
        status: 'proposed',
      },
      {
        action_id: 'CREATE_FIREBREAK',
        label: 'Cortafuegos en la pista forestal alta',
        rank: 2,
        urgency: 'soon',
        why: 'Es la única línea de defensa por encima del foco antes de la cresta.',
        eta_min: 60,
        status: 'proposed',
      },
    ],
    model: 'nebius/llama-3.3-70b',
    generated_at: '2026-09-19T13:06:40+02:00',
  },
  {
    target_id: 'fire-3',
    summary:
      'Matorral en el Garraf con viento de tramuntana de 19 km/h. Avanza hacia el sur, ' +
      'hacia la urbanización de Can Lloses.',
    priority_rationale:
      'La urbanización está a sotavento y en matorral el frente corre. Avisar antes de ' +
      'que haya que evacuar.',
    actions: [
      {
        action_id: 'DEPLOY_RESOURCE:ground',
        label: 'Preposicionar dotación en Can Lloses',
        rank: 1,
        urgency: 'immediate',
        why: '310 personas a 2,7 km y a sotavento. Llegar antes que el fuego cuesta menos que evacuar después.',
        eta_min: 20,
        status: 'proposed',
      },
      {
        action_id: 'DEPLOY_RESOURCE:air',
        label: 'Avión de vigilancia y ataque',
        rank: 2,
        urgency: 'soon',
        why: 'El matorral del Garraf arde rápido y plano: un ataque temprano lo cierra.',
        eta_min: 30,
        status: 'proposed',
      },
    ],
    model: 'nebius/llama-3.3-70b',
    generated_at: '2026-09-19T15:12:05+02:00',
  },
  {
    target_id: 'fire-4',
    summary:
      'Conato en zona de cultivo con carga moderada, pendiente casi nula y viento flojo. ' +
      'No hay población ni infraestructura crítica cerca.',
    priority_rationale:
      'Con este combustible y sin viento el fuego no gana terreno. Vigilar cuesta menos ' +
      'que desplazar medios que hacen falta en Collserola.',
    actions: [
      {
        action_id: 'WAIT',
        label: 'Mantener en vigilancia',
        rank: 1,
        urgency: 'monitor',
        why: 'Cultivo segado, 3° de pendiente y 9 km/h de viento. Los medios rinden más en los focos activos.',
        status: 'proposed',
      },
      {
        action_id: 'DEPLOY_RESOURCE:ground',
        label: 'Dotación de guardia desde el parque más próximo',
        rank: 2,
        urgency: 'soon',
        why: 'Una sola dotación cierra un conato de 1,6 ha si cambia el viento.',
        eta_min: 18,
        status: 'proposed',
      },
    ],
    model: 'nebius/llama-3.3-70b',
    generated_at: '2026-09-19T12:49:30+02:00',
  },
  {
    target_id: 'fire-5',
    summary:
      'Conato de 0,7 ha en rastrojo, con Sentmenat a 3,4 km y a barlovento. Detección ' +
      'manual, confianza baja: conviene confirmarla sobre el terreno.',
    priority_rationale:
      'Antes de mover nada grande, confirmar que existe y con qué tamaño.',
    actions: [
      {
        action_id: 'DEPLOY_RESOURCE:drone',
        label: 'Dron de reconocimiento',
        rank: 1,
        urgency: 'immediate',
        why: 'La detección es manual y la confianza del 58%. Diez minutos de dron evitan movilizar una dotación por un falso positivo.',
        eta_min: 10,
        status: 'proposed',
      },
      {
        action_id: 'WAIT',
        label: 'Mantener en vigilancia',
        rank: 2,
        urgency: 'monitor',
        why: 'El núcleo está a barlovento y a 3,4 km. Sin cambio de viento no hay amenaza a población.',
        status: 'proposed',
      },
    ],
    model: 'nebius/llama-3.3-70b',
    generated_at: '2026-09-19T15:41:12+02:00',
  },
];

const BY_TARGET = new Map(ANALYSES.map((a) => [a.target_id, a]));

/** Análisis de la IA para un objetivo, o null si todavía no hay ninguno mockeado. */
export function analysisFor(targetId: string | null): AIAnalysis | null {
  return targetId ? (BY_TARGET.get(targetId) ?? null) : null;
}
