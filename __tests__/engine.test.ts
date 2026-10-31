import { describe, it, expect } from "vitest";
import { generateDoubleSixDeck, hasFourOrMoreDoubles, dealValidFourPlayerHands, determineStartingPlayer } from "../src/engine/deck";
import { createInitialBoardState, placeTileOnBoard } from "../src/engine/boardLayoutEngine";
import { calculateNormalFinishPayout } from "../src/engine/payoutCalculator";
import { DominoTile, PipValue } from "../src/types/game";

function make(a: PipValue, b: PipValue): DominoTile {
  return { id: `${Math.min(a,b)}-${Math.max(a,b)}`, left: Math.min(a,b) as PipValue, right: Math.max(a,b) as PipValue, isDouble: a===b, pipSum: a+b };
}

describe("Engine Tests", () => {
  it("generates 28 tiles and 7 doubles", () => {
    const deck = generateDoubleSixDeck();
    expect(deck).toHaveLength(28);
    expect(deck.filter(t => t.isDouble)).toHaveLength(7);
  });

  it("detects 4 doubles", () => {
    expect(hasFourOrMoreDoubles([make(0,0), make(1,1), make(2,2), make(3,3)])).toBe(true);
    expect(hasFourOrMoreDoubles([make(0,0), make(1,1), make(2,2), make(1,2)])).toBe(false);
  });

  it("places root tile and normalizes camera", () => {
    const board = createInitialBoardState();
    const placed = placeTileOnBoard(board, make(6,6), "root");
    expect(placed.placedTiles).toHaveLength(1);
    expect(placed.camera.scale).toBe(1.0);
  });

  it("scores normal finish (+2, +1, -1, -2)", () => {
    const hands = { p1: [], p2: [make(1,1)], p3: [make(2,3)], p4: [make(6,6)] };
    const p = calculateNormalFinishPayout(hands);
    expect(p.creditChanges).toEqual({ p1: 2, p2: 1, p3: -1, p4: -2 });
  });
});