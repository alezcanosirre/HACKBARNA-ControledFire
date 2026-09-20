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
    title: "Verify the alert",
    description:
      "Cross-check coordinates, date and time against the emergency control room and " +
      "independent observations; check whether the incident is already identified.",
    whenToPropose: "A detection with no operational confirmation.",
  },
  {
    id: "A02",
    title: "Reconnoitre and assess safety",
    description:
      "Using whatever means the commander decides, confirm extent, fuel, fire behaviour, " +
      "access routes and the safety conditions for personnel.",
    whenToPropose: "Field information is missing to plan the intervention.",
  },
  {
    id: "A03",
    title: "Assess exposure of people and infrastructure",
    description:
      "Establish which people, homes, roads or facilities could be affected and pass the " +
      "protection needs to the commander.",
    whenToPropose: "Exposure is confirmed or unknown.",
    limitation:
      "Do not order evacuation or shelter-in-place; those decisions belong to the competent authority.",
  },
  {
    id: "A04",
    title: "Set the intervention plan and resources",
    description:
      "The commander sets objectives, a containment or suppression strategy and the means " +
      "required, weighing reconnaissance, verified weather, terrain and safety.",
    whenToPropose: "There is enough information to plan the intervention.",
    limitation:
      "The AI must not invent available resources, nor prescribe tactics, deployments or " +
      "quantities of means on insufficient information.",
  },
  {
    id: "A05",
    title: "Keep monitoring and re-assess the plan",
    description:
      "Compare successive observations and field reports, communicate changes and revisit " +
      "the decisions. Once extinction is confirmed, keep whatever watch the commander sets.",
    whenToPropose: "During the intervention, or while monitoring a confirmed incident.",
    limitation: "The absence of satellite detections does not prove extinction.",
  },
];

const BY_ID = new Map(ACTION_CATALOG.map((a) => [a.id, a]));

export function catalogActionById(id: string): CatalogAction | undefined {
  return BY_ID.get(id);
}

export function isCatalogActionId(id: string): boolean {
  return BY_ID.has(id);
}
