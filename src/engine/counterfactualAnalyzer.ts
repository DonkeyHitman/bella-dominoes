import { CounterfactualResult, DominoTile, LegalMove, PipValue, TurnSnapshot } from '../types/game';
import { getPlayableMovesForHand } from './deck';

export function sumHandPips(hand: DominoTile[]) {
  return hand.reduce((acc, t) => acc + t.pipSum, 0);
}

export function isStrictlyLowestPipHolder(blockerId: string, finalHands: Record<string, DominoTile[]>) {
  const blockerPips = sumHandPips(finalHands[blockerId] || []);
  for (const [pid, hand] of Object.entries(finalHands)) {
    if (pid !== blockerId && sumHandPips(hand) <= blockerPips) return false;
  }
  return true;
}

function isBoardCompletelyBlocked(ends: { left: PipValue; right: PipValue }, hands: Record<string, DominoTile[]>) {
  for (const hand of Object.values(hands)) {
    if (getPlayableMovesForHand(hand, ends, false).moves.length > 0) return false;
  }
  return true;
}

export function analyzeCounterfactualBlock(
  snapshotP: TurnSnapshot,
  blockingPlayerId: string,
  finalHandsAfterBlock: Record<string, DominoTile[]>,
  _finalEnds: { left: PipValue; right: PipValue }
): CounterfactualResult {
  const precedingPlayerId = snapshotP.playerId;
  const isSuccessfulBlock = isStrictlyLowestPipHolder(blockingPlayerId, finalHandsAfterBlock);
  const { moves: pMoves } = getPlayableMovesForHand(snapshotP.handBeforeMove, snapshotP.boardEndsBeforeMove, false);

  const alternativeMoves = pMoves.filter(
    (m) => !(m.tile.id === snapshotP.movePlayed.tile.id && m.targetEnd === snapshotP.movePlayed.targetEnd)
  );

  let hadAlternativePreventingBlock = false;
  const bHandBeforeMove = snapshotP.allHandsAtTurn[blockingPlayerId] ?? snapshotP.nextPlayerHand;

  for (const altMove of alternativeMoves) {
    const altEnds = { left: altMove.resultingLeftPip, right: altMove.resultingRightPip };
    const simulatedHands = {
      ...snapshotP.allHandsAtTurn,
      [precedingPlayerId]: snapshotP.handBeforeMove.filter((t) => t.id !== altMove.tile.id),
    };

    const bResponses = getPlayableMovesForHand(bHandBeforeMove, altEnds, false).moves;
    let bCanStillBlock = false;
    for (const bMove of bResponses) {
      const endsAfterB = { left: bMove.resultingLeftPip, right: bMove.resultingRightPip };
      const handsAfterB = {
        ...simulatedHands,
        [blockingPlayerId]: bHandBeforeMove.filter((t) => t.id !== bMove.tile.id),
      };
      if (isBoardCompletelyBlocked(endsAfterB, handsAfterB)) {
        bCanStillBlock = true;
        break;
      }
    }

    if (!bCanStillBlock && !isBoardCompletelyBlocked(altEnds, simulatedHands)) {
      hadAlternativePreventingBlock = true;
      break;
    }
  }

  let tacticalClassification: CounterfactualResult['tacticalClassification'];
  if (isSuccessfulBlock) {
    tacticalClassification = hadAlternativePreventingBlock ? 'ASSISTED_BLOCK_PENALTY' : 'STANDARD_SUCCESSFUL_BLOCK';
  } else {
    tacticalClassification = alternativeMoves.length > 0 ? 'TRAP_BAIT_REWARD' : 'STANDARD_UNSUCCESSFUL_BLOCK';
  }

  return {
    precedingPlayerId,
    blockingPlayerId,
    isSuccessfulBlock,
    hadAlternativePlay: alternativeMoves.length > 0,
    hadAlternativePreventingBlock,
    alternativeMoves,
    tacticalClassification,
  };
}