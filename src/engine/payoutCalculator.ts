import { CounterfactualResult, DominoTile, PayoutResult } from '../types/game';
import { sumHandPips } from './counterfactualAnalyzer';

export function calculateNormalFinishPayout(finalHands: Record<string, DominoTile[]>): PayoutResult {
  const pipTotals: Record<string, number> = {};
  for (const [pid, hand] of Object.entries(finalHands)) {
    pipTotals[pid] = sumHandPips(hand);
  }

  // Identify winner (player with 0 tiles remaining)
  const playerIds = Object.keys(finalHands);
  const winnerId = playerIds.find((pid) => finalHands[pid].length === 0) || playerIds[0];
  const loserIds = playerIds.filter((pid) => pid !== winnerId);

  // Sort losers by pip count descending: index 0 has the highest pip total
  const sortedLosers = [...loserIds].sort((a, b) => pipTotals[b] - pipTotals[a]);
  const pA = sortedLosers[0]; // highest pips
  const pB = sortedLosers[1]; // middle pips
  const pC = sortedLosers[2]; // lowest pips among losers

  const pipA = pipTotals[pA];
  const pipB = pipTotals[pB];
  const pipC = pipTotals[pC];

  const creditChanges: Record<string, number> = {
    [winnerId]: 0,
    [pA]: 0,
    [pB]: 0,
    [pC]: 0,
  };

  let detailText = "";

  if (pipA === pipB && pipB === pipC) {
    // Scenario 4: All 3 losers tied
    creditChanges[winnerId] = 6;
    creditChanges[pA] = -2;
    creditChanges[pB] = -2;
    creditChanges[pC] = -2;
    detailText = `All 3 opponents tied at ${pipA} pips (-2 each). Winner receives +6.`;
  } else if (pipA === pipB && pipB > pipC) {
    // Scenario 2: Two tied for highest
    creditChanges[winnerId] = 4;
    creditChanges[pA] = -2;
    creditChanges[pB] = -2;
    creditChanges[pC] = 0;
    detailText = `Two players tied for highest at ${pipA} pips (-2 each). Winner receives +4.`;
  } else if (pipA > pipB && pipB === pipC) {
    // Scenario 3: Two tied for lowest
    creditChanges[winnerId] = 2;
    creditChanges[pA] = -2;
    creditChanges[pB] = 0;
    creditChanges[pC] = 0;
    detailText = `Highest loser has ${pipA} pips (-2). Remaining two tied at ${pipB} (0 each). Winner receives +2.`;
  } else {
    // Scenario 1: Three distinct pip counts
    creditChanges[winnerId] = 2;
    creditChanges[pA] = -2;
    creditChanges[pB] = -1;
    creditChanges[pC] = 1;
    detailText = `Distinct counts (${pipA} / ${pipB} / ${pipC}). Winner +2, 2nd place +1, 3rd place -1, 4th place -2.`;
  }

  return {
    mode: 'NORMAL_FINISH',
    winnerId,
    creditChanges,
    pipTotals,
    summaryText: `Normal Finish — ${detailText}`,
  };
}

export function calculateBlockedGamePayout(
  finalHands: Record<string, DominoTile[]>,
  blockingPlayerId: string,
  counterfactual: CounterfactualResult
): PayoutResult {
  const pipTotals: Record<string, number> = {};
  const playerIds = Object.keys(finalHands);
  const creditChanges: Record<string, number> = {};
  for (const pid of playerIds) {
    pipTotals[pid] = sumHandPips(finalHands[pid] || []);
    creditChanges[pid] = 0;
  }

  const { precedingPlayerId, isSuccessfulBlock, tacticalClassification } = counterfactual;
  const lowest = [...playerIds].sort((a, b) => pipTotals[a] - pipTotals[b])[0];
  const winnerId = isSuccessfulBlock ? blockingPlayerId : (tacticalClassification === 'TRAP_BAIT_REWARD' ? precedingPlayerId : lowest);

  switch (tacticalClassification) {
    case 'STANDARD_SUCCESSFUL_BLOCK':
      creditChanges[blockingPlayerId] = 9;
      playerIds.filter((p) => p !== blockingPlayerId).forEach((p) => { creditChanges[p] = -3; });
      return { mode: 'BLOCKED_GAME', winnerId, creditChanges, pipTotals, counterfactual, summaryText: `Block won by ${blockingPlayerId} (+9 credits).` };
    case 'ASSISTED_BLOCK_PENALTY':
      creditChanges[blockingPlayerId] = 9;
      creditChanges[precedingPlayerId] = -9;
      return { mode: 'BLOCKED_GAME', winnerId, creditChanges, pipTotals, counterfactual, summaryText: `Assisted Block Penalty on ${precedingPlayerId} (-9 credits).` };
    case 'STANDARD_UNSUCCESSFUL_BLOCK':
      creditChanges[blockingPlayerId] = -9;
      playerIds.filter((p) => p !== blockingPlayerId).forEach((p) => { creditChanges[p] = 3; });
      return { mode: 'BLOCKED_GAME', winnerId, creditChanges, pipTotals, counterfactual, summaryText: `Failed block by ${blockingPlayerId} (-9 credits).` };
    case 'TRAP_BAIT_REWARD':
      creditChanges[blockingPlayerId] = -9;
      creditChanges[precedingPlayerId] = 9;
      return { mode: 'BLOCKED_GAME', winnerId, creditChanges, pipTotals, counterfactual, summaryText: `Trap set by ${precedingPlayerId}! (+9 credits).` };
  }
}