import {
  BoardState,
  CameraTransform,
  DominoTile,
  HeadingDeg,
  OpenEndState,
  PipValue,
  PlacedTile,
} from '../types/game';

export const TILE_LONG = 96;
export const TILE_SHORT = 48;
export const BOUNDARY_X = 400;
export const BOUNDARY_Y = 190;
export const CAMERA_PADDING = 90;
export const SAFETY_MARGIN = 24; // Minimum gap between non-adjacent domino branches

export function createInitialBoardState(w = 1000, h = 560): BoardState {
  return {
    placedTiles: [],
    leftEnd: null,
    rightEnd: null,
    camera: { scale: 1.0, offsetX: 0, offsetY: 0, chainWidth: 0, chainHeight: 0 },
    feltInnerWidth: w,
    feltInnerHeight: h,
  };
}

export function computeCameraTransform(placed: PlacedTile[], w: number, h: number): CameraTransform {
  if (placed.length === 0) return { scale: 1.0, offsetX: 0, offsetY: 0, chainWidth: 0, chainHeight: 0 };

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const pt of placed) {
    minX = Math.min(minX, pt.x - pt.width / 2);
    maxX = Math.max(maxX, pt.x + pt.width / 2);
    minY = Math.min(minY, pt.y - pt.height / 2);
    maxY = Math.max(maxY, pt.y + pt.height / 2);
  }

  const chainWidth = (maxX - minX) + CAMERA_PADDING;
  const chainHeight = (maxY - minY) + CAMERA_PADDING;
  const usableWidth = w - 120;
  const usableHeight = h - 80;

  const rawScale = Math.min(usableWidth / Math.max(chainWidth, 1), usableHeight / Math.max(chainHeight, 1));
  const targetScale = Number(Math.min(1.0, Math.max(0.36, rawScale)).toFixed(4));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    scale: targetScale,
    offsetX: Number((-centerX).toFixed(2)),
    offsetY: Number((-centerY).toFixed(2)),
    chainWidth: Math.round(chainWidth),
    chainHeight: Math.round(chainHeight),
  };
}

interface TileBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function getBox(x: number, y: number, w: number, h: number): TileBox {
  return { minX: x - w / 2, maxX: x + w / 2, minY: y - h / 2, maxY: y + h / 2 };
}

function boxesIntersect(a: TileBox, b: TileBox, buffer = 0): boolean {
  return !(
    a.maxX + buffer <= b.minX ||
    a.minX - buffer >= b.maxX ||
    a.maxY + buffer <= b.minY ||
    a.minY - buffer >= b.maxY
  );
}

function willCollideWithExisting(
  testBox: TileBox,
  placedTiles: PlacedTile[],
  ignoredTile: PlacedTile
): boolean {
  for (const placed of placedTiles) {
    if (placed === ignoredTile) continue;
    const placedBox = getBox(placed.x, placed.y, placed.width, placed.height);
    if (boxesIntersect(testBox, placedBox, SAFETY_MARGIN)) {
      return true;
    }
  }
  return false;
}

function calculateNextPlacement(
  prevTile: PlacedTile,
  activeEndHeading: HeadingDeg,
  candidateHeading: HeadingDeg,
  isCorner: boolean,
  isPerpDouble: boolean
): { centerX: number; centerY: number; width: number; height: number; nextAttachX: number; nextAttachY: number } {
  const isHoriz = candidateHeading === 0 || candidateHeading === 180;
  const width = isHoriz
    ? (isPerpDouble ? TILE_SHORT : TILE_LONG)
    : (isPerpDouble ? TILE_LONG : TILE_SHORT);
  const height = isHoriz
    ? (isPerpDouble ? TILE_LONG : TILE_SHORT)
    : (isPerpDouble ? TILE_SHORT : TILE_LONG);

  const prevLeft = prevTile.x - prevTile.width / 2;
  const prevRight = prevTile.x + prevTile.width / 2;
  const prevTop = prevTile.y - prevTile.height / 2;
  const prevBottom = prevTile.y + prevTile.height / 2;

  let centerX: number;
  let centerY: number;

  if (!isCorner) {
    if (candidateHeading === 0) {
      centerX = prevRight + width / 2;
      centerY = prevTile.y;
    } else if (candidateHeading === 180) {
      centerX = prevLeft - width / 2;
      centerY = prevTile.y;
    } else if (candidateHeading === 90) {
      centerX = prevTile.x;
      centerY = prevBottom + height / 2;
    } else {
      // 270 (North)
      centerX = prevTile.x;
      centerY = prevTop - height / 2;
    }
  } else {
    // 90-degree flush L-bend
    if (activeEndHeading === 0 && candidateHeading === 90) {
      centerX = prevRight - width / 2;
      centerY = prevBottom + height / 2;
    } else if (activeEndHeading === 0 && candidateHeading === 270) {
      centerX = prevRight - width / 2;
      centerY = prevTop - height / 2;
    } else if (activeEndHeading === 180 && candidateHeading === 90) {
      centerX = prevLeft + width / 2;
      centerY = prevBottom + height / 2;
    } else if (activeEndHeading === 180 && candidateHeading === 270) {
      centerX = prevLeft + width / 2;
      centerY = prevTop - height / 2;
    } else if (activeEndHeading === 90 && candidateHeading === 0) {
      centerX = prevRight + width / 2;
      centerY = prevBottom - height / 2;
    } else if (activeEndHeading === 90 && candidateHeading === 180) {
      centerX = prevLeft - width / 2;
      centerY = prevBottom - height / 2;
    } else if (activeEndHeading === 270 && candidateHeading === 0) {
      centerX = prevRight + width / 2;
      centerY = prevTop + height / 2;
    } else {
      // 270 -> 180
      centerX = prevLeft - width / 2;
      centerY = prevTop + height / 2;
    }
  }

  let nextAttachX = centerX;
  let nextAttachY = centerY;
  if (candidateHeading === 0) nextAttachX = centerX + width / 2;
  else if (candidateHeading === 180) nextAttachX = centerX - width / 2;
  else if (candidateHeading === 90) nextAttachY = centerY + height / 2;
  else if (candidateHeading === 270) nextAttachY = centerY - height / 2;

  return { centerX, centerY, width, height, nextAttachX, nextAttachY };
}

export function placeTileOnBoard(
  state: BoardState,
  tile: DominoTile,
  targetEnd: 'root' | 'left' | 'right'
): BoardState {
  const placed = [...state.placedTiles];

  // 1. Root tile at dead center (0, 0)
  if (placed.length === 0 || targetEnd === 'root') {
    const isDbl = tile.isDouble;
    const width = isDbl ? TILE_SHORT : TILE_LONG;
    const height = isDbl ? TILE_LONG : TILE_SHORT;

    const rootPlaced: PlacedTile = {
      tile,
      x: 0,
      y: 0,
      width,
      height,
      rotation: isDbl ? 90 : 0,
      placedOnEnd: 'root',
    };
    placed.push(rootPlaced);

    return {
      ...state,
      placedTiles: placed,
      leftEnd: { end: 'left', openPip: tile.left, attachX: -width / 2, attachY: 0, heading: 180 },
      rightEnd: { end: 'right', openPip: tile.right, attachX: width / 2, attachY: 0, heading: 0 },
      camera: computeCameraTransform(placed, state.feltInnerWidth, state.feltInnerHeight),
    };
  }

  const activeEnd = targetEnd === 'left' ? state.leftEnd! : state.rightEnd!;
  const matchingPip = activeEnd.openPip;

  if (tile.left !== matchingPip && tile.right !== matchingPip) {
    return state;
  }

  const newOpenPip: PipValue = tile.left === matchingPip ? tile.right : tile.left;
  const prevTile = placed.filter((p) => p.placedOnEnd === targetEnd || p.placedOnEnd === 'root').pop()!;

  // Candidate headings to test (prefer straight, then perpendicular options)
  const currentHeading = activeEnd.heading;
  const perpA: HeadingDeg = ((currentHeading + 90) % 360) as HeadingDeg;
  const perpB: HeadingDeg = ((currentHeading + 270) % 360) as HeadingDeg;

  // Prioritize turning away from the other branch to prevent collision
  const candidateHeadings: HeadingDeg[] = [currentHeading, perpA, perpB];

  // If at table edge boundaries, prioritize turning inward
  const prevRight = prevTile.x + prevTile.width / 2;
  const prevLeft = prevTile.x - prevTile.width / 2;
  const prevBottom = prevTile.y + prevTile.height / 2;
  const prevTop = prevTile.y - prevTile.height / 2;

  const hitsRail =
    (currentHeading === 0 && prevRight >= BOUNDARY_X) ||
    (currentHeading === 180 && prevLeft <= -BOUNDARY_X) ||
    (currentHeading === 90 && prevBottom >= BOUNDARY_Y) ||
    (currentHeading === 270 && prevTop <= -BOUNDARY_Y);

  let bestPlacement: ReturnType<typeof calculateNextPlacement> | null = null;
  let chosenHeading: HeadingDeg = currentHeading;
  let chosenIsCorner = false;

  for (const candHeading of candidateHeadings) {
    const isCorner = candHeading !== currentHeading;
    if (hitsRail && !isCorner) continue; // Must turn if at outer rail

    const isPerpDouble = tile.isDouble && !isCorner;
    const placement = calculateNextPlacement(prevTile, currentHeading, candHeading, isCorner, isPerpDouble);
    const testBox = getBox(placement.centerX, placement.centerY, placement.width, placement.height);

    // Look ahead 1 full step to ensure we do not box ourselves into a dead end
    const lookaheadX = placement.nextAttachX;
    const lookaheadY = placement.nextAttachY;
    const lookaheadBox = getBox(lookaheadX, lookaheadY, placement.width, placement.height);

    const collidesNow = willCollideWithExisting(testBox, placed, prevTile);
    const collidesSoon = willCollideWithExisting(lookaheadBox, placed, prevTile);

    if (!collidesNow && !collidesSoon) {
      bestPlacement = placement;
      chosenHeading = candHeading;
      chosenIsCorner = isCorner;
      break;
    } else if (!collidesNow && !bestPlacement) {
      // Fallback valid placement if lookahead is tight
      bestPlacement = placement;
      chosenHeading = candHeading;
      chosenIsCorner = isCorner;
    }
  }

  // Fallback if all options were tight
  if (!bestPlacement) {
    const isCorner = true;
    chosenHeading = perpA;
    chosenIsCorner = isCorner;
    bestPlacement = calculateNextPlacement(prevTile, currentHeading, perpA, true, false);
  }

  // Exact Pip Orientation (matching pip faces inward against prevTile)
  let orientedTile: DominoTile;
  if (chosenHeading === 0 || chosenHeading === 90) {
    orientedTile = tile.left === matchingPip
      ? { ...tile }
      : { ...tile, left: tile.right, right: tile.left };
  } else {
    // 180 or 270
    orientedTile = tile.right === matchingPip
      ? { ...tile }
      : { ...tile, left: tile.right, right: tile.left };
  }

  const isPerpDouble = tile.isDouble && !chosenIsCorner;
  const rotation: HeadingDeg = isPerpDouble
    ? (((chosenHeading + 90) % 360) as HeadingDeg)
    : chosenHeading;

  const newPlaced: PlacedTile = {
    tile: orientedTile,
    x: bestPlacement.centerX,
    y: bestPlacement.centerY,
    width: bestPlacement.width,
    height: bestPlacement.height,
    rotation,
    placedOnEnd: targetEnd,
  };
  placed.push(newPlaced);

  const updatedEnd: OpenEndState = {
    end: targetEnd,
    openPip: newOpenPip,
    attachX: bestPlacement.nextAttachX,
    attachY: bestPlacement.nextAttachY,
    heading: chosenHeading,
  };

  return {
    ...state,
    placedTiles: placed,
    leftEnd: targetEnd === 'left' ? updatedEnd : state.leftEnd,
    rightEnd: targetEnd === 'right' ? updatedEnd : state.rightEnd,
    camera: computeCameraTransform(placed, state.feltInnerWidth, state.feltInnerHeight),
  };
}