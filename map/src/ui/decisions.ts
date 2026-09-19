/**
 * El registro de decisiones del operador (spec.md §5.4): al aceptar o descartar, la
 * acción cambia de estado y queda con la hora. Es exactamente lo que un coordinador
 * necesita después, así que se guarda aunque todavía no haya backend que lo reciba.
 */
export interface Decision {
  status: 'accepted' | 'rejected';
  at: string; // ISO
}

/** Una acción pertenece a un análisis, no al sistema: la clave lleva los dos ids. */
export const decisionKey = (targetId: string, actionId: string) => `${targetId}:${actionId}`;
