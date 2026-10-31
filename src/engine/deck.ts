import { DominoTile, LegalMove, PipValue } from '../types/game';

export function generateDoubleSixDeck(): DominoTile[] {
  const deck: DominoTile[] = [];
  for (let low = 0 as PipValue; low <= 6; low = (low + 1) as PipValue) {
    for (let high = low as PipValue; high <= 6; high = (high + 1) as PipValue) {
      deck.push({
        id: `${low}-${high}`,
        left: low,
        right: high,
        isDouble: low === high,
        pipSum: low + high,
      });
    }
  }
  return deck;
}

export function fisherYatesShuffle(deck: DominoTile[]): DominoTile[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function hasFourOrMoreDoubles(hand: DominoTile[]): boolean {
  let count = 0;
  for (const t of hand) {
    if (t.isDouble) count++;
  }
  return count >= 4;
}

export function dealValidFourPlayerHands(
  playerIds: string[],
  shuffler: (deck: DominoTile[]) => DominoTile[] = fisherYatesShuffle
) {
  if (playerIds.length !== 4) throw new Error('bella-dominoes requires 4 players.');
  const baseDeck = generateDoubleSixDeck();
  let redealCount = 0;
  const announcements: string[] = [];

  while (true) {
    const shuffled = shuffler(baseDeck);
    const hands: Record<string, DominoTile[]> = {};
    let invalid = false;

    for (let i = 0; i < 4; i++) {
      const hand = shuffled.slice(i * 7, (i + 1) * 7);
      hands[playerIds[i]] = hand;
      if (hasFourOrMoreDoubles(hand)) invalid = true;
    }

    if (!invalid) return { hands, redealCount, announcements };
    redealCount++;
    announcements.push('4+ Doubles Dealt — Reshuffling!');
  }
}

export function determineStartingPlayer(
  roundNumber: number,
  hands: Record<string, DominoTile[]>,
  previousWinnerId: string | null
) {
  if (roundNumber === 1 || !previousWinnerId || !hands[previousWinnerId]) {
    for (const [pid, hand] of Object.entries(hands)) {
      if (hand.some((t) => t.id === '6-6')) {
        return { starterId: pid, mustPlaySixSix: true };
      }
    }
    return { starterId: Object.keys(hands)[0], mustPlaySixSix: false };
  }
  return { starterId: previousWinnerId, mustPlaySixSix: false };
}

export function getPlayableMovesForHand(
  hand: DominoTile[],
  boardEnds: { left: PipValue; right: PipValue } | null,
  mustPlaySixSix: boolean
) {
  const moves: LegalMove[] = [];
  const playableTileIds = new Set<string>();
  const ambiguousTileIds = new Set<string>();

  if (!boardEnds) {
    for (const tile of hand) {
      if (mustPlaySixSix && tile.id !== '6-6') continue;
      moves.push({
        tile,
        targetEnd: 'root',
        resultingLeftPip: tile.left,
        resultingRightPip: tile.right,
      });
      playableTileIds.add(tile.id);
    }
    return { moves, playableTileIds, ambiguousTileIds };
  }

  for (const tile of hand) {
    const matchesLeft = tile.left === boardEnds.left || tile.right === boardEnds.left;
    const matchesRight = tile.left === boardEnds.right || tile.right === boardEnds.right;

    if (matchesLeft) {
      const nextLeftPip = tile.left === boardEnds.left ? tile.right : tile.left;
      moves.push({
        tile,
        targetEnd: 'left',
        resultingLeftPip: nextLeftPip,
        resultingRightPip: boardEnds.right,
      });
      playableTileIds.add(tile.id);
    }

    if (matchesRight) {
      const nextRightPip = tile.left === boardEnds.right ? tile.right : tile.left;
      moves.push({
        tile,
        targetEnd: 'right',
        resultingLeftPip: boardEnds.left,
        resultingRightPip: nextRightPip,
      });
      playableTileIds.add(tile.id);
    }

    if (matchesLeft && matchesRight && boardEnds.left !== boardEnds.right) {
      ambiguousTileIds.add(tile.id);
    }
  }

  return { moves, playableTileIds, ambiguousTileIds };
}