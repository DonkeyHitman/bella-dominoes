export type PipValue = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface DominoTile {
  id: string;
  left: PipValue;
  right: PipValue;
  isDouble: boolean;
  pipSum: number;
}

export type HeadingDeg = 0 | 90 | 180 | 270;

export interface PlacedTile {
  tile: DominoTile;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: HeadingDeg;
  placedOnEnd: 'root' | 'left' | 'right';
}

export interface OpenEndState {
  end: 'left' | 'right';
  openPip: PipValue;
  attachX: number;
  attachY: number;
  heading: HeadingDeg;
}

export interface CameraTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  chainWidth: number;
  chainHeight: number;
}

export interface BoardState {
  placedTiles: PlacedTile[];
  leftEnd: OpenEndState | null;
  rightEnd: OpenEndState | null;
  camera: CameraTransform;
  feltInnerWidth: number;
  feltInnerHeight: number;
}

export interface LegalMove {
  tile: DominoTile;
  targetEnd: 'root' | 'left' | 'right';
  resultingLeftPip: PipValue;
  resultingRightPip: PipValue;
}

export interface TurnSnapshot {
  playerId: string;
  handBeforeMove: DominoTile[];
  boardEndsBeforeMove: { left: PipValue; right: PipValue } | null;
  movePlayed: LegalMove;
  nextPlayerId: string;
  nextPlayerHand: DominoTile[];
  allHandsAtTurn: Record<string, DominoTile[]>;
}

export interface CounterfactualResult {
  precedingPlayerId: string;
  blockingPlayerId: string;
  isSuccessfulBlock: boolean;
  hadAlternativePlay: boolean;
  hadAlternativePreventingBlock: boolean;
  alternativeMoves: LegalMove[];
  tacticalClassification:
    | 'STANDARD_SUCCESSFUL_BLOCK'
    | 'ASSISTED_BLOCK_PENALTY'
    | 'STANDARD_UNSUCCESSFUL_BLOCK'
    | 'TRAP_BAIT_REWARD';
}

export interface PayoutResult {
  mode: 'NORMAL_FINISH' | 'BLOCKED_GAME';
  winnerId: string;
  creditChanges: Record<string, number>;
  pipTotals: Record<string, number>;
  counterfactual?: CounterfactualResult;
  summaryText: string;
}