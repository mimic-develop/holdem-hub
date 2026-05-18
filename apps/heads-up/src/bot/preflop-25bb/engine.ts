import type { Card } from '../../engine/card';
import type { BotDecision, GameState } from '../../types/game';
import type { AiPersonaId } from '../../types/ai';

import baselineData from './data/preflopBaseline25bbHU.json';
import personaData from './data/preflopPersonaModifiers.json';

import { adaptHistory } from './historyAdapter';
import { getPreflopNodeId } from './nodeSelector';
import { resolveSpecPersona } from './personaResolver';
import { classifyHand } from './handClassifier';
import {
  applyPersonaModifier,
  applyHandClassCorrection,
  normalizeFrequencies,
  sampleWeightedAction,
} from './frequencyMath';
import { convertSpecAction } from './actionConverter';
import { applyPersonaStateModifier } from './personaStateModifiers';
import type { PersonaState } from './personaState';
import type { ActionFrequencies, NodeId, SpecAction, SpecPersonaKey } from './types';

interface BaselineNode {
  actions: Partial<Record<SpecAction, number>>;
}
interface PersonaModifierBlock {
  globalModifiers: Partial<Record<SpecAction, number>>;
  nodeSpecificModifiers?: Partial<Record<NodeId, Partial<Record<SpecAction, number>>>>;
}

// Narrow the imported JSON to typed shapes once at module init.
const NODES = (baselineData as { nodes: Record<NodeId, BaselineNode> }).nodes;
const PERSONAS = (personaData as { personas: Record<SpecPersonaKey, PersonaModifierBlock> }).personas;

/**
 * Decide a preflop action using the 25bb HU aggregate baseline.
 *
 * Returns a BotDecision (action + amount in chips) when:
 *   1) state is preflop with ~25bb effective stack, AND
 *   2) the current action history matches one of the 12 named nodes, AND
 *   3) the sampled spec action is legal in the current state.
 *
 * Returns null in any other case — the caller (HeuristicBot.decide) must fall
 * back to the legacy preflop pipeline.
 */
export function decide25bbPreflop(
  state: GameState,
  botId: string,
  persona: AiPersonaId,
  rng: () => number,
  personaState?: PersonaState,
): { action: BotDecision['action']; amount: number } | null {
  const bot = state.players.find((p) => p.id === botId);
  if (!bot || !bot.holeCards || bot.holeCards.length !== 2) return null;

  const adapted = adaptHistory(state);
  if (!adapted) return null;

  const nodeId = getPreflopNodeId(adapted.positionToAct, adapted.actionHistory);
  if (!nodeId) return null;

  const node = NODES[nodeId];
  if (!node) return null;
  const baseline = node.actions as ActionFrequencies;

  const specPersona = resolveSpecPersona(persona);
  const personaBlock = PERSONAS[specPersona];
  if (!personaBlock) return null;
  const nodeMod = personaBlock.nodeSpecificModifiers?.[nodeId];

  const afterPersona = applyPersonaModifier(baseline, personaBlock.globalModifiers, nodeMod);
  // Bayesian-inspired persona-state layer (lightweight mood loop). When no
  // state is provided we skip — pure baseline + persona behavior is preserved.
  const afterState = personaState
    ? applyPersonaStateModifier(afterPersona, personaState)
    : afterPersona;
  const hole: [Card, Card] = [bot.holeCards[0], bot.holeCards[1]];
  const handClass = classifyHand(hole[0], hole[1]);
  // hand-class correction runs LAST among modifiers — premium `preventActions`
  // is applied here and zeroes out fold regardless of how the state modifier
  // tried to push it.
  const corrected = applyHandClassCorrection(afterState, handClass, specPersona);
  const normalized = normalizeFrequencies(corrected);

  const picked = sampleWeightedAction(normalized, rng);
  const converted = convertSpecAction(picked, state, botId);
  if (!converted) return null;

  return { action: converted.action, amount: converted.amount };
}
