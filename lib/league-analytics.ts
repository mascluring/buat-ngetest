/**
 * Pure calculation helper for League Ownership, Effective Ownership (EO),
 * and Differential classification in Era Super League.
 *
 * Locked V6.3 calculations remain untouched.
 * Zero external network or React dependencies.
 */

export type DifferentialCategory = 'Differential' | 'Core' | 'Standard';

export interface ManagerPickItem {
  id: number;
  name?: string;
  fullName?: string;
  teamShortName?: string;
  teamName?: string;
  team?: string;
  positionName?: string;
  elementType?: number;
  position: number; // 1-11 starter, 12-15 bench
  multiplier?: number;
  isCaptain?: boolean;
  isVice?: boolean;
  points?: number;
  rawPoints?: number;
}

export interface ManagerPicksInput {
  entry: number | string;
  picks: ManagerPickItem[];
}

export interface PlayerOwnershipStats {
  playerId: number;
  playerName: string;
  team: string;
  position: string;
  ownership: number; // percentage e.g. 68.97
  effectiveOwnership: number; // percentage e.g. 103.45
  startingOwnership: number; // percentage e.g. 68.97
  captainExposure: number; // percentage e.g. 34.48
  ownerCount: number; // unique managers owning player
  starterCount: number; // unique managers starting player
  benchCount: number; // unique managers benching player
  captainCount: number; // unique managers captaining player (C or TC)
  tripleCaptainCount: number; // unique managers triple-captaining
  category: DifferentialCategory;
  points?: number;
}

export interface LeagueOwnershipSummary {
  totalManagers: number;
  players: PlayerOwnershipStats[];
  mostOwnedPlayer: PlayerOwnershipStats | null;
  highestEOPlayer: PlayerOwnershipStats | null;
  topDifferential: PlayerOwnershipStats | null;
  corePlayers: PlayerOwnershipStats[];
  differentialPlayers: PlayerOwnershipStats[];
  standardPlayers: PlayerOwnershipStats[];
}

const round2 = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/**
 * Calculates league-wide ownership and effective ownership for all players
 * across the provided managers' squads.
 * 
 * Rules:
 * - Ownership = (Unique managers owning player / Total managers) * 100
 * - Starting Ownership = (Unique managers starting player (pos <= 11) / Total managers) * 100
 * - Captain Exposure = (Unique managers captaining player / Total managers) * 100
 * - Effective Ownership (EO) = Starting Ownership + Captain Exposure
 * - Triple Captain is counted as 1 captain exposure for EO (TC multiplier affects points, not manager count).
 * - Category:
 *   - Differential: Ownership < 15%
 *   - Core: Ownership > 60%
 *   - Standard: 15% <= Ownership <= 60%
 */
export function calculateLeagueOwnership(
  managers: ManagerPicksInput[],
  totalManagersOverride?: number
): PlayerOwnershipStats[] {
  const totalManagers = totalManagersOverride && totalManagersOverride > 0
    ? totalManagersOverride
    : managers.length;

  if (totalManagers === 0 || !Array.isArray(managers) || managers.length === 0) {
    return [];
  }

  interface PlayerAccumulator {
    playerId: number;
    playerName: string;
    team: string;
    position: string;
    uniqueOwners: Set<number | string>;
    uniqueStarters: Set<number | string>;
    uniqueBenchers: Set<number | string>;
    uniqueCaptains: Set<number | string>;
    uniqueTripleCaptains: Set<number | string>;
    points?: number;
  }

  const map = new Map<number, PlayerAccumulator>();

  for (const mgr of managers) {
    const mgrId = mgr.entry;
    const picks = Array.isArray(mgr.picks) ? mgr.picks : [];

    // Deduplicate picks per manager in case of malformed data
    const seenPlayerIds = new Set<number>();

    for (const pick of picks) {
      if (!pick || typeof pick.id !== 'number' || pick.id <= 0) continue;
      if (seenPlayerIds.has(pick.id)) continue;
      seenPlayerIds.add(pick.id);

      let record = map.get(pick.id);
      if (!record) {
        const pos = pick.positionName || (
          pick.elementType === 1 ? 'GKP' :
          pick.elementType === 2 ? 'DEF' :
          pick.elementType === 3 ? 'MID' :
          pick.elementType === 4 ? 'FWD' : 'UNK'
        );
        const teamStr = pick.teamShortName || pick.team || pick.teamName || '—';
        const nameStr = pick.name || pick.fullName || `Player #${pick.id}`;

        record = {
          playerId: pick.id,
          playerName: nameStr,
          team: teamStr,
          position: pos,
          uniqueOwners: new Set(),
          uniqueStarters: new Set(),
          uniqueBenchers: new Set(),
          uniqueCaptains: new Set(),
          uniqueTripleCaptains: new Set(),
        };
        map.set(pick.id, record);
      }

      // Track ownership
      record.uniqueOwners.add(mgrId);

      // Track starters vs bench
      const isStarter = typeof pick.position === 'number' && pick.position <= 11;
      if (isStarter) {
        record.uniqueStarters.add(mgrId);
      } else {
        record.uniqueBenchers.add(mgrId);
      }

      // Track captain exposure
      // Both captain (2x) and triple captain (3x) count as 1 captain exposure
      if (pick.isCaptain) {
        record.uniqueCaptains.add(mgrId);
        if (pick.multiplier === 3) {
          record.uniqueTripleCaptains.add(mgrId);
        }
      }

      if (record.points === undefined) {
        if (typeof pick.rawPoints === 'number') {
          record.points = pick.rawPoints;
        } else if (typeof pick.points === 'number' && !pick.isCaptain) {
          record.points = pick.points;
        }
      }
    }
  }

  const results: PlayerOwnershipStats[] = [];

  for (const record of map.values()) {
    const ownerCount = record.uniqueOwners.size;
    const starterCount = record.uniqueStarters.size;
    const benchCount = record.uniqueBenchers.size;
    const captainCount = record.uniqueCaptains.size;
    const tripleCaptainCount = record.uniqueTripleCaptains.size;

    const ownership = round2((ownerCount / totalManagers) * 100);
    const startingOwnership = round2((starterCount / totalManagers) * 100);
    const captainExposure = round2((captainCount / totalManagers) * 100);
    const effectiveOwnership = round2(startingOwnership + captainExposure);

    let category: DifferentialCategory = 'Standard';
    if (ownership < 15) {
      category = 'Differential';
    } else if (ownership > 60) {
      category = 'Core';
    }

    results.push({
      playerId: record.playerId,
      playerName: record.playerName,
      team: record.team,
      position: record.position,
      ownership,
      effectiveOwnership,
      startingOwnership,
      captainExposure,
      ownerCount,
      starterCount,
      benchCount,
      captainCount,
      tripleCaptainCount,
      category,
      points: record.points,
    });
  }

  // Sort default: highest Effective Ownership, then Ownership, then Name
  return results.sort((a, b) => {
    if (b.effectiveOwnership !== a.effectiveOwnership) {
      return b.effectiveOwnership - a.effectiveOwnership;
    }
    if (b.ownership !== a.ownership) {
      return b.ownership - a.ownership;
    }
    return a.playerName.localeCompare(b.playerName);
  });
}

/**
 * Calculates standalone effective ownership for an ownership item.
 */
export function calculateEffectiveOwnership(player: PlayerOwnershipStats): number {
  return round2(player.startingOwnership + player.captainExposure);
}

/**
 * Filters and returns players classified as Differentials (< 15% ownership).
 */
export function calculateDifferentials(players: PlayerOwnershipStats[]): PlayerOwnershipStats[] {
  return players
    .filter((p) => p.category === 'Differential')
    .sort((a, b) => b.effectiveOwnership - a.effectiveOwnership || b.ownership - a.ownership);
}

/**
 * Filters and returns players classified as Core (> 60% ownership).
 */
export function calculateCorePlayers(players: PlayerOwnershipStats[]): PlayerOwnershipStats[] {
  return players
    .filter((p) => p.category === 'Core')
    .sort((a, b) => b.effectiveOwnership - a.effectiveOwnership || b.ownership - a.ownership);
}

/**
 * Creates a comprehensive League Ownership & Differential Radar summary.
 */
export function getLeagueOwnershipSummary(
  managers: ManagerPicksInput[],
  totalManagersOverride?: number
): LeagueOwnershipSummary {
  const totalManagers = totalManagersOverride && totalManagersOverride > 0
    ? totalManagersOverride
    : managers.length;

  const players = calculateLeagueOwnership(managers, totalManagers);

  const mostOwnedPlayer = players.length > 0
    ? [...players].sort((a, b) => b.ownership - a.ownership || b.effectiveOwnership - a.effectiveOwnership)[0]
    : null;

  const highestEOPlayer = players.length > 0
    ? [...players].sort((a, b) => b.effectiveOwnership - a.effectiveOwnership || b.ownership - a.ownership)[0]
    : null;

  const differentialPlayers = calculateDifferentials(players);
  const corePlayers = calculateCorePlayers(players);
  const standardPlayers = players.filter((p) => p.category === 'Standard');

  const topDifferential = differentialPlayers.length > 0 ? differentialPlayers[0] : null;

  return {
    totalManagers,
    players,
    mostOwnedPlayer,
    highestEOPlayer,
    topDifferential,
    corePlayers,
    differentialPlayers,
    standardPlayers,
  };
}

/**
 * Creates a lookup map keyed by player element ID for quick O(1) badge lookups in Pitch View.
 */
export function getPlayerOwnershipMap(players: PlayerOwnershipStats[]): Map<number, PlayerOwnershipStats> {
  const map = new Map<number, PlayerOwnershipStats>();
  for (const p of players) {
    map.set(p.playerId, p);
  }
  return map;
}

/**
 * ============================================================================
 * V6.4 PHASE 2: HEAD-TO-HEAD SQUAD OVERLAP & RIVAL SIMILARITY MATRIX
 * ============================================================================
 */

export interface SquadOverlapPlayerInfo {
  id: number;
  name: string;
  fullName?: string;
  team: string;
  position: string;
  positionNumber?: number; // 1-15 (1-11 starter, 12-15 bench)
  isStarter?: boolean;
  isCaptain?: boolean;
  isVice?: boolean;
  isCaptainA?: boolean;
  isCaptainB?: boolean;
  multiplier?: number;
}

export interface ManagerWithPicks extends ManagerPicksInput {
  name?: string;
  teamName?: string;
  rank?: number;
}

export interface SquadOverlapResult {
  managerAId: number | string;
  managerBId: number | string;
  managerAName?: string;
  managerBName?: string;
  managerATeam?: string;
  managerBTeam?: string;
  overlapCount: number;
  overlapPercentage: number;
  squadASize: number;
  squadBSize: number;
  commonPlayerIds: number[];
  uniqueToAPlayerIds: number[];
  uniqueToBPlayerIds: number[];
  commonPlayers: SquadOverlapPlayerInfo[];
  uniqueToAPlayers: SquadOverlapPlayerInfo[];
  uniqueToBPlayers: SquadOverlapPlayerInfo[];
  narrative: string;
}

export interface LeagueOverlapMatrixEntry {
  managerId: number | string;
  managerName: string;
  teamName: string;
  rank?: number;
  overlaps: {
    targetManagerId: number | string;
    overlapPercentage: number;
    overlapCount: number;
  }[];
  averageOverlap: number;
}

export interface LeagueOverlapInsights {
  mostSimilarPair: {
    managerA: { id: number | string; name: string; team: string };
    managerB: { id: number | string; name: string; team: string };
    overlapPercentage: number;
    overlapCount: number;
  } | null;
  mostDifferentPair: {
    managerA: { id: number | string; name: string; team: string };
    managerB: { id: number | string; name: string; team: string };
    overlapPercentage: number;
    overlapCount: number;
  } | null;
  mostUniqueManager: {
    id: number | string;
    name: string;
    team: string;
    averageOverlap: number;
  } | null;
}

/**
 * Returns deterministic rival insight narrative in Indonesian based on squad overlap percentage.
 */
export function getOverlapNarrative(overlapPercentage: number): string {
  if (overlapPercentage >= 80) {
    return 'Squad sangat mirip — duel kemungkinan ditentukan oleh pemain diferensial.';
  }
  if (overlapPercentage >= 60) {
    return 'Mayoritas squad sama, tetapi beberapa pemain diferensial dapat menentukan hasil.';
  }
  if (overlapPercentage >= 40) {
    return 'Overlap sedang — terdapat cukup banyak pemain berbeda di kedua squad.';
  }
  return 'Squad sangat berbeda — ini merupakan duel diferensial yang kuat.';
}

/**
 * Helper to extract deduplicated player information from a manager's picks.
 */
function extractPlayerMap(picks: ManagerPickItem[]): Map<number, SquadOverlapPlayerInfo> {
  const map = new Map<number, SquadOverlapPlayerInfo>();
  if (!Array.isArray(picks)) return map;

  for (const p of picks) {
    if (!p || typeof p.id !== 'number' || p.id <= 0) continue;
    if (map.has(p.id)) continue; // Deduplicate duplicate input

    const pos = p.positionName || (
      p.elementType === 1 ? 'GKP' :
      p.elementType === 2 ? 'DEF' :
      p.elementType === 3 ? 'MID' :
      p.elementType === 4 ? 'FWD' : 'UNK'
    );
    const teamStr = p.teamShortName || p.team || p.teamName || '—';
    const nameStr = p.name || p.fullName || `Player #${p.id}`;

    map.set(p.id, {
      id: p.id,
      name: nameStr,
      fullName: p.fullName || nameStr,
      team: teamStr,
      position: pos,
      positionNumber: p.position,
      isStarter: typeof p.position === 'number' ? p.position <= 11 : true,
      isCaptain: !!p.isCaptain,
      isVice: !!p.isVice,
      multiplier: p.multiplier ?? 1,
    });
  }
  return map;
}

const positionOrder: Record<string, number> = { GKP: 1, DEF: 2, MID: 3, FWD: 4, UNK: 5 };
function sortPlayersByPosition(a: SquadOverlapPlayerInfo, b: SquadOverlapPlayerInfo): number {
  const posA = positionOrder[a.position] || 99;
  const posB = positionOrder[b.position] || 99;
  if (posA !== posB) return posA - posB;
  return a.name.localeCompare(b.name);
}

/**
 * Calculates Head-to-Head Squad Overlap between Manager A and Manager B.
 *
 * Rules:
 * - Common players = intersection(squadA, squadB)
 * - Denominator = min(squadA.length, squadB.length) to prevent skewing on incomplete data.
 * - Overlap % = (common.length / denominator) * 100
 * - If denominator === 0: overlap % = 0 (no NaN/Infinity)
 * - Deduplicates player IDs using Set
 */
export function calculateSquadOverlap(
  managerA: ManagerWithPicks,
  managerB: ManagerWithPicks
): SquadOverlapResult {
  const managerAId = managerA?.entry ?? 'A';
  const managerBId = managerB?.entry ?? 'B';

  const mapA = extractPlayerMap(managerA?.picks || []);
  const mapB = extractPlayerMap(managerB?.picks || []);

  const squadASet = new Set(mapA.keys());
  const squadBSet = new Set(mapB.keys());

  const squadASize = squadASet.size;
  const squadBSize = squadBSet.size;

  // Handle same manager comparison
  if (managerAId === managerBId && squadASize > 0) {
    const allIds = Array.from(squadASet);
    const allPlayers = allIds.map((id) => mapA.get(id)!).sort(sortPlayersByPosition);
    return {
      managerAId,
      managerBId,
      managerAName: managerA?.name,
      managerBName: managerB?.name,
      managerATeam: managerA?.teamName,
      managerBTeam: managerB?.teamName,
      overlapCount: squadASize,
      overlapPercentage: 100,
      squadASize,
      squadBSize,
      commonPlayerIds: allIds,
      uniqueToAPlayerIds: [],
      uniqueToBPlayerIds: [],
      commonPlayers: allPlayers,
      uniqueToAPlayers: [],
      uniqueToBPlayers: [],
      narrative: getOverlapNarrative(100),
    };
  }

  // Handle empty squad edge cases
  if (squadASize === 0 || squadBSize === 0) {
    return {
      managerAId,
      managerBId,
      managerAName: managerA?.name,
      managerBName: managerB?.name,
      managerATeam: managerA?.teamName,
      managerBTeam: managerB?.teamName,
      overlapCount: 0,
      overlapPercentage: 0,
      squadASize,
      squadBSize,
      commonPlayerIds: [],
      uniqueToAPlayerIds: Array.from(squadASet),
      uniqueToBPlayerIds: Array.from(squadBSet),
      commonPlayers: [],
      uniqueToAPlayers: Array.from(mapA.values()).sort(sortPlayersByPosition),
      uniqueToBPlayers: Array.from(mapB.values()).sort(sortPlayersByPosition),
      narrative: 'Squad data unavailable',
    };
  }

  const commonPlayerIds: number[] = [];
  const uniqueToAPlayerIds: number[] = [];
  const uniqueToBPlayerIds: number[] = [];

  for (const id of squadASet) {
    if (squadBSet.has(id)) {
      commonPlayerIds.push(id);
    } else {
      uniqueToAPlayerIds.push(id);
    }
  }

  for (const id of squadBSet) {
    if (!squadASet.has(id)) {
      uniqueToBPlayerIds.push(id);
    }
  }

  const overlapCount = commonPlayerIds.length;
  const denominator = Math.min(squadASize, squadBSize);
  const overlapPercentage = denominator > 0
    ? round2((overlapCount / denominator) * 100)
    : 0;

  const commonPlayers = commonPlayerIds
    .map((id) => {
      const pA = mapA.get(id)!;
      const pB = mapB.get(id);
      return {
        ...pA,
        isCaptainA: pA.isCaptain,
        isCaptainB: pB?.isCaptain,
      };
    })
    .sort(sortPlayersByPosition);

  const uniqueToAPlayers = uniqueToAPlayerIds
    .map((id) => mapA.get(id)!)
    .sort(sortPlayersByPosition);

  const uniqueToBPlayers = uniqueToBPlayerIds
    .map((id) => mapB.get(id)!)
    .sort(sortPlayersByPosition);

  const narrative = getOverlapNarrative(overlapPercentage);

  return {
    managerAId,
    managerBId,
    managerAName: managerA?.name,
    managerBName: managerB?.name,
    managerATeam: managerA?.teamName,
    managerBTeam: managerB?.teamName,
    overlapCount,
    overlapPercentage,
    squadASize,
    squadBSize,
    commonPlayerIds,
    uniqueToAPlayerIds,
    uniqueToBPlayerIds,
    commonPlayers,
    uniqueToAPlayers,
    uniqueToBPlayers,
    narrative,
  };
}

/**
 * Calculates a complete League-Wide Overlap Matrix and summary insights in pure memory.
 * No additional network calls required.
 */
export function calculateLeagueOverlapMatrix(
  managers: ManagerWithPicks[]
): {
  matrix: LeagueOverlapMatrixEntry[];
  insights: LeagueOverlapInsights;
} {
  if (!Array.isArray(managers) || managers.length === 0) {
    return {
      matrix: [],
      insights: {
        mostSimilarPair: null,
        mostDifferentPair: null,
        mostUniqueManager: null,
      },
    };
  }

  // Precompute sets and basic info
  const precomputed = managers.map((m) => {
    const rawPicks = Array.isArray(m.picks) ? m.picks : [];
    const set = new Set<number>();
    for (const p of rawPicks) {
      if (p && typeof p.id === 'number' && p.id > 0) {
        set.add(p.id);
      }
    }
    return {
      id: m.entry,
      name: m.name || `Manager #${m.entry}`,
      team: m.teamName || '',
      rank: m.rank,
      set,
    };
  });

  const matrix: LeagueOverlapMatrixEntry[] = [];
  let maxOverlap = -1;
  let minOverlap = 999;
  let mostSimilarPair: LeagueOverlapInsights['mostSimilarPair'] = null;
  let mostDifferentPair: LeagueOverlapInsights['mostDifferentPair'] = null;

  for (let i = 0; i < precomputed.length; i++) {
    const mgrA = precomputed[i];
    const overlaps: LeagueOverlapMatrixEntry['overlaps'] = [];
    let overlapSum = 0;
    let comparisons = 0;

    for (let j = 0; j < precomputed.length; j++) {
      const mgrB = precomputed[j];
      if (i === j) {
        overlaps.push({
          targetManagerId: mgrB.id,
          overlapPercentage: 100,
          overlapCount: mgrA.set.size,
        });
        continue;
      }

      // Compute intersection
      let common = 0;
      for (const id of mgrA.set) {
        if (mgrB.set.has(id)) common++;
      }

      const denom = Math.min(mgrA.set.size, mgrB.set.size);
      const pct = denom > 0 ? round2((common / denom) * 100) : 0;

      overlaps.push({
        targetManagerId: mgrB.id,
        overlapPercentage: pct,
        overlapCount: common,
      });

      overlapSum += pct;
      comparisons++;

      // Track global extremes for unique pairs (i < j)
      if (i < j && denom > 0) {
        if (pct > maxOverlap) {
          maxOverlap = pct;
          mostSimilarPair = {
            managerA: { id: mgrA.id, name: mgrA.name, team: mgrA.team },
            managerB: { id: mgrB.id, name: mgrB.name, team: mgrB.team },
            overlapPercentage: pct,
            overlapCount: common,
          };
        }
        if (pct < minOverlap) {
          minOverlap = pct;
          mostDifferentPair = {
            managerA: { id: mgrA.id, name: mgrA.name, team: mgrA.team },
            managerB: { id: mgrB.id, name: mgrB.name, team: mgrB.team },
            overlapPercentage: pct,
            overlapCount: common,
          };
        }
      }
    }

    const averageOverlap = comparisons > 0 ? round2(overlapSum / comparisons) : 0;

    matrix.push({
      managerId: mgrA.id,
      managerName: mgrA.name,
      teamName: mgrA.team,
      rank: mgrA.rank,
      overlaps,
      averageOverlap,
    });
  }

  // Find most unique manager (lowest average overlap)
  let mostUniqueManager: LeagueOverlapInsights['mostUniqueManager'] = null;
  if (matrix.length > 0) {
    const sortedByUnique = [...matrix].sort((a, b) => a.averageOverlap - b.averageOverlap);
    const topUnique = sortedByUnique[0];
    mostUniqueManager = {
      id: topUnique.managerId,
      name: topUnique.managerName,
      team: topUnique.teamName,
      averageOverlap: topUnique.averageOverlap,
    };
  }

  return {
    matrix,
    insights: {
      mostSimilarPair,
      mostDifferentPair,
      mostUniqueManager,
    },
  };
}
