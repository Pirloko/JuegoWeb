/**
 * Copy de marca puntocachero: serio-premium + juguetón chileno.
 * Frases cortas, sin spam de emojis. Determinista para poder testearlo.
 */
import { seasonProgress } from './progression';

/** Meta cercana en una frase, para Inicio. */
export function seasonGoalPhrase(completed: number, total: number): string {
  const p = seasonProgress(completed, total);
  if (p.total === 0) {
    return 'La temporada se está armando, cachero. Vuelve pronto.';
  }
  if (p.nextMilestone == null) {
    return 'Temporada conquistada entera. Wena cachero.';
  }
  if (p.completed === 0) {
    return `Parte por el nivel 1, cachero: el primer hito son ${p.nextMilestone} conquistas.`;
  }
  if (p.remainingToMilestone === 1) {
    return `Queda 1 pa'l hito de ${p.nextMilestone}. Uno y cae, cachero.`;
  }
  return `Te faltan ${p.remainingToMilestone} pa'l hito de ${p.nextMilestone}, cachero.`;
}
