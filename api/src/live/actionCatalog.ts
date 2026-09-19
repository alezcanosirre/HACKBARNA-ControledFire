/**
 * Catálogo cerrado de acciones que Nebius puede recomendar para un incendio ACTUAL.
 * Nebius elige y prioriza DENTRO de este catálogo — nunca inventa una acción nueva, y
 * su `title` nunca se usa: el backend siempre resuelve el título desde aquí (ver
 * actionRecommendation.ts). Igual que el catálogo cerrado `Action` del motor de
 * simulación (api/src/types/action.ts) defiende que "la IA propone, el motor decide" —
 * este es el mismo argumento aplicado al modo ACTUAL.
 *
 * Versionado (`ACTION_CATALOG_VERSION`): si el catálogo cambia de forma que invalide
 * una recomendación ya generada (se quita/renombra una acción), sube la versión — el
 * campo `catalogVersion` de la respuesta es lo que permite a quien la lea (o a una
 * caché) saber contra qué versión del catálogo se generó.
 */
export const ACTION_CATALOG_VERSION = "1";

export interface CatalogAction {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Cuándo tiene sentido proponerla — va al prompt, no a la respuesta. */
  readonly whenToPropose: string;
  /** Límite explícito de lo que esta acción NO autoriza — va al prompt. */
  readonly limitation?: string;
}

export const ACTION_CATALOG: readonly CatalogAction[] = [
  {
    id: "A01",
    title: "Verificar el aviso",
    description:
      "Contrastar coordenadas, fecha y hora con la central de emergencias y observaciones " +
      "independientes; comprobar si el incidente ya está identificado.",
    whenToPropose: "Detección sin confirmación operativa.",
  },
  {
    id: "A02",
    title: "Realizar reconocimiento y evaluar seguridad",
    description:
      "Mediante los medios que determine el mando, confirmar extensión, combustible, " +
      "comportamiento del fuego, accesos y condiciones de seguridad del personal.",
    whenToPropose: "Falta información de campo para planificar la intervención.",
  },
  {
    id: "A03",
    title: "Evaluar exposición de personas e infraestructuras",
    description:
      "Comprobar qué personas, viviendas, carreteras o instalaciones podrían estar " +
      "afectadas y trasladar al mando las necesidades de protección.",
    whenToPropose: "Exposición confirmada o desconocida.",
    limitation:
      "No ordenar evacuación ni confinamiento; esas decisiones corresponden a la autoridad competente.",
  },
  {
    id: "A04",
    title: "Establecer el plan de intervención y los recursos",
    description:
      "El mando define objetivos, estrategia de contención/extinción y medios necesarios " +
      "considerando reconocimiento, meteorología verificada, terreno y seguridad.",
    whenToPropose: "Existe información suficiente para planificar la intervención.",
    limitation:
      "La IA no debe inventar recursos disponibles ni prescribir tácticas, despliegues " +
      "o cantidades de medios con información insuficiente.",
  },
  {
    id: "A05",
    title: "Mantener seguimiento y reevaluar el plan",
    description:
      "Comparar observaciones sucesivas y partes de campo, comunicar cambios y revisar " +
      "las decisiones. Tras la extinción confirmada, mantener la vigilancia que determine " +
      "el mando.",
    whenToPropose: "Durante la intervención o el seguimiento de un incidente confirmado.",
    limitation: "La ausencia de detecciones satelitales no demuestra extinción.",
  },
];

const BY_ID = new Map(ACTION_CATALOG.map((a) => [a.id, a]));

export function catalogActionById(id: string): CatalogAction | undefined {
  return BY_ID.get(id);
}

export function isCatalogActionId(id: string): boolean {
  return BY_ID.has(id);
}
