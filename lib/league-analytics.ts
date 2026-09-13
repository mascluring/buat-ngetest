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

// ============================================================================
// V6.4 PHASE 3 — SQUAD EFFICIENCY & BENCH ANALYSIS
// Pure calculation engine adhering to official FPL 2026/27 rules.
// Zero external network calls. Zero mutations of input data.
// ============================================================================

export interface PlayerLineupContribution {
  playerId: number;
  playerName: string;
  fullName: string;
  position: 'GKP' | 'DEF' | 'MID' | 'FWD';
  teamShort: string;
  teamName: string;
  jerseyUrl: string;
  points: number; // calculated points contribution (rawPoints * multiplier)
  rawPoints: number;
  minutes: number;
  multiplier: number; // 0 for bench, 1 for starter, 2 for captain, 3 for triple captain
  isCaptain: boolean;
  isViceCaptain: boolean;
  benchOrder: number; // 0 for Starter, 1 for GKP Sub, 2 for Sub 1, 3 for Sub 2, 4 for Sub 3
  wasSubbedIn?: boolean;
  wasSubbedOut?: boolean;
  elementPosition: number; // 1 to 15
}

export interface ManagerGameweekEfficiency {
  gameweek: number;
  lineupPoints: number | null; // Gross Starting XI points (official FPL entry_history.points)
  transferCost: number; // Event transfers cost (-4 per additional transfer)
  netGameweekPoints: number | null; // lineupPoints - transferCost
  rawBenchPoints: number | null; // Exact raw FPL value (can be negative, never silently clamped)
  benchPointsRaw: number | null; // Alias for rawBenchPoints
  derivedBenchPoints: number | null; // Derived non-negative value for ratio denominator
  benchPointsForEfficiency: number | null; // Alias for derivedBenchPoints
  startingXIEfficiency: number | null; // null if Bench Boost or invalid data
  activeChip: string | null;
  isBenchBoostActive: boolean;
  isTripleCaptainActive: boolean;
  isFinished: boolean;
}

export interface ManagerEfficiencySummary {
  managerId: number | string;
  managerName: string;
  teamName: string;
  rank: number;
  averageEfficiency: number | null; // average of regular completed gameweeks (excl. Bench Boost)
  averageBenchPoints: number; // based on raw bench points
  totalBenchPoints: number; // raw sum across all completed gameweeks (preserves negative values!)
  totalRawBenchPoints: number; // explicit raw sum
  totalDerivedBenchPoints: number; // sum of derived non-negative bench points
  totalLineupPoints: number; // total gross lineup points
  totalTransferCost: number; // total transfer cost
  totalNetPoints: number; // totalLineupPoints - totalTransferCost
  eligibleGWCount: number;
  bestEfficiencyGW: { gameweek: number; efficiency: number; points: number } | null;
  lowestEfficiencyGW: { gameweek: number; efficiency: number; points: number } | null;
  highestBenchGW: { gameweek: number; benchPoints: number } | null;
  gameweekHistory: ManagerGameweekEfficiency[];
}

export interface CurrentGWManagerSquadDetail {
  managerId: number | string;
  managerName: string;
  teamName: string;
  rank: number;
  gameweek: number;
  selectedXI: number; // 11
  finalScoringXI: number; // number of starters with multiplier >= 1 (or 15 if BB)
  lineupPoints: number | null; // Gross Starting XI points
  transferCost: number; // Transfers cost for the gameweek
  netGameweekPoints: number | null; // lineupPoints - transferCost
  rawBenchPoints: number | null; // Exact raw FPL value
  benchPointsRaw: number | null; // Alias
  derivedBenchPoints: number | null; // Non-negative derived value
  benchPointsForEfficiency: number | null; // Alias
  startingXIEfficiency: number | null;
  activeChip: string | null;
  isBenchBoostActive: boolean;
  isTripleCaptainActive: boolean;
  isFinished: boolean;
  isDataChecked: boolean;
  startingXI: PlayerLineupContribution[];
  bench: PlayerLineupContribution[];
  automaticSubs: Array<{
    elementIn: number;
    elementOut: number;
  }>;
}

export interface LeagueEfficiencyOverview {
  currentGameweek: number;
  isCurrentGWFinal: boolean;
  leagueAverageEfficiency: number | null;
  leagueAverageBenchPoints: number;
  totalLeagueBenchPoints: number; // Raw sum across all managers
  totalLeagueRawBenchPoints: number;
  currentGWAverageEfficiency: number | null;
  currentGWAverageBenchPoints: number;
  highestEfficiencyManager: {
    managerId: number | string;
    managerName: string;
    teamName: string;
    rank: number;
    value: number;
  } | null;
  lowestEfficiencyManager: {
    managerId: number | string;
    managerName: string;
    teamName: string;
    rank: number;
    value: number;
  } | null;
  highestBenchManager: {
    managerId: number | string;
    managerName: string;
    teamName: string;
    rank: number;
    value: number;
  } | null;
  gameweekTrends: Array<{
    gameweek: number;
    averageEfficiency: number | null;
    averageBenchPoints: number;
    averageLineupPoints: number;
  }>;
  managerSummaries: ManagerEfficiencySummary[];
}

/**
 * Calculates Starting XI Efficiency percentage.
 * Formula: Lineup Points / (Lineup Points + max(0, Bench Points)) * 100
 *
 * Rules:
 * - When Bench Boost is active: returns null (exempt from ratio, UI shows status badge)
 * - Raw bench points are preserved; only clamped to 0 in derived denominator
 * - Returns null if data is incomplete or invalid
 */
export function calculateStartingXIEfficiency(
  lineupPoints: number | null | undefined,
  benchPointsRaw: number | null | undefined,
  isBenchBoostActive: boolean
): number | null {
  // Exclusion 1: Bench Boost
  if (isBenchBoostActive) {
    return null;
  }

  // Exclusion 2: Missing or invalid lineup points
  if (
    lineupPoints === null ||
    lineupPoints === undefined ||
    typeof lineupPoints !== 'number' ||
    isNaN(lineupPoints)
  ) {
    return null;
  }

  // Exclusion 3: Missing or invalid bench points
  if (
    benchPointsRaw === null ||
    benchPointsRaw === undefined ||
    typeof benchPointsRaw !== 'number' ||
    isNaN(benchPointsRaw)
  ) {
    return null;
  }

  // Exclusion 4: Negative raw bench points (rawBenchPoints < 0)
  if (benchPointsRaw < 0) {
    return null;
  }

  // Exclusion 5: Invalid denominator (total <= 0)
  const total = lineupPoints + benchPointsRaw;
  if (total <= 0) {
    return null;
  }

  const eff = (lineupPoints / total) * 100;
  return Math.min(100.0, Math.max(0.0, Number(eff.toFixed(1))));
}

/**
 * Calculates efficiency for a single manager gameweek.
 */
export function calculateManagerGameweekEfficiency(params: {
  gameweek: number;
  lineupPoints: number | null;
  benchPointsRaw?: number | null;
  rawBenchPoints?: number | null;
  transferCost?: number;
  activeChip: string | null;
  isFinished?: boolean;
}): ManagerGameweekEfficiency {
  const chipUpper = (params.activeChip || '').toUpperCase();
  const isBenchBoostActive = chipUpper === 'BBOOST' || chipUpper === 'BB';
  const isTripleCaptainActive = chipUpper === '3XC' || chipUpper === 'TC';

  // Preserve exact raw value from FPL (negative values are NOT clamped here!)
  const rawBenchPoints =
    typeof params.rawBenchPoints === 'number'
      ? params.rawBenchPoints
      : typeof params.benchPointsRaw === 'number'
      ? params.benchPointsRaw
      : null;

  // Derived non-negative bench points used strictly as denominator component for ratio
  const derivedBenchPoints =
    rawBenchPoints !== null ? Math.max(0, rawBenchPoints) : null;

  const transferCost = typeof params.transferCost === 'number' ? params.transferCost : 0;
  const netGameweekPoints =
    params.lineupPoints !== null ? params.lineupPoints - transferCost : null;

  const startingXIEfficiency = calculateStartingXIEfficiency(
    params.lineupPoints,
    rawBenchPoints,
    isBenchBoostActive
  );

  return {
    gameweek: params.gameweek,
    lineupPoints: params.lineupPoints,
    transferCost,
    netGameweekPoints,
    rawBenchPoints,
    benchPointsRaw: rawBenchPoints,
    derivedBenchPoints,
    benchPointsForEfficiency: derivedBenchPoints,
    startingXIEfficiency,
    activeChip: params.activeChip,
    isBenchBoostActive,
    isTripleCaptainActive,
    isFinished: Boolean(params.isFinished ?? true),
  };
}

/**
 * Calculates historical efficiency metrics across all completed GWs for a single manager.
 */
export function calculateManagerEfficiencyHistory(
  history: Array<{
    event: number;
    points: number;
    total_points: number;
    points_on_bench: number;
    event_transfers_cost?: number;
  }>,
  chips: Array<{ name: string; event: number }>,
  managerMeta: {
    entryId: number | string;
    managerName: string;
    teamName: string;
    rank: number;
  }
): ManagerEfficiencySummary {
  const chipsMap = new Map<number, string>();
  for (const c of chips || []) {
    chipsMap.set(Number(c.event), String(c.name || ''));
  }

  const gameweekHistory: ManagerGameweekEfficiency[] = (history || [])
    .map((h) => {
      const eventNum = Number(h.event);
      const chip = chipsMap.get(eventNum) || null;
      return calculateManagerGameweekEfficiency({
        gameweek: eventNum,
        lineupPoints: typeof h.points === 'number' ? h.points : null,
        rawBenchPoints: typeof h.points_on_bench === 'number' ? h.points_on_bench : 0,
        transferCost: typeof h.event_transfers_cost === 'number' ? h.event_transfers_cost : 0,
        activeChip: chip,
        isFinished: true,
      });
    })
    .sort((a, b) => a.gameweek - b.gameweek);

  let totalBenchPoints = 0;
  let totalDerivedBenchPoints = 0;
  let totalLineupPoints = 0;
  let totalTransferCost = 0;
  let efficiencySum = 0;
  let eligibleGWCount = 0;

  let bestEfficiencyGW: { gameweek: number; efficiency: number; points: number } | null = null;
  let lowestEfficiencyGW: { gameweek: number; efficiency: number; points: number } | null = null;
  let highestBenchGW: { gameweek: number; benchPoints: number } | null = null;

  for (const gw of gameweekHistory) {
    const rawBench = gw.rawBenchPoints ?? 0;
    const derivedBench = gw.derivedBenchPoints ?? 0;
    const lineup = gw.lineupPoints ?? 0;
    const cost = gw.transferCost ?? 0;

    // Preserves raw negative bench points during summation!
    totalBenchPoints += rawBench;
    totalDerivedBenchPoints += derivedBench;
    totalLineupPoints += lineup;
    totalTransferCost += cost;

    if (highestBenchGW === null || rawBench > highestBenchGW.benchPoints) {
      highestBenchGW = { gameweek: gw.gameweek, benchPoints: rawBench };
    }

    if (gw.startingXIEfficiency !== null && !gw.isBenchBoostActive) {
      efficiencySum += gw.startingXIEfficiency;
      eligibleGWCount++;

      if (bestEfficiencyGW === null || gw.startingXIEfficiency > bestEfficiencyGW.efficiency) {
        bestEfficiencyGW = { gameweek: gw.gameweek, efficiency: gw.startingXIEfficiency, points: lineup };
      }
      if (lowestEfficiencyGW === null || gw.startingXIEfficiency < lowestEfficiencyGW.efficiency) {
        lowestEfficiencyGW = { gameweek: gw.gameweek, efficiency: gw.startingXIEfficiency, points: lineup };
      }
    }
  }

  const averageEfficiency =
    eligibleGWCount > 0 ? Number((efficiencySum / eligibleGWCount).toFixed(1)) : null;

  const totalGWs = gameweekHistory.length;
  const averageBenchPoints =
    totalGWs > 0 ? Number((totalBenchPoints / totalGWs).toFixed(1)) : 0;

  return {
    managerId: managerMeta.entryId,
    managerName: managerMeta.managerName,
    teamName: managerMeta.teamName,
    rank: managerMeta.rank,
    averageEfficiency,
    averageBenchPoints,
    totalBenchPoints,
    totalRawBenchPoints: totalBenchPoints,
    totalDerivedBenchPoints,
    totalLineupPoints,
    totalTransferCost,
    totalNetPoints: totalLineupPoints - totalTransferCost,
    eligibleGWCount,
    bestEfficiencyGW,
    lowestEfficiencyGW,
    highestBenchGW,
    gameweekHistory,
  };
}

/**
 * Aggregates league-wide efficiency overview, rankings, and historical trends.
 */
export function calculateLeagueEfficiencyOverview(
  managerHistories: Array<{
    entryId: number;
    entryName: string;
    playerName: string;
    currentRank: number;
    chips: Array<{ name: string; event: number }>;
    history: Array<{
      event: number;
      points: number;
      total_points: number;
      points_on_bench: number;
      event_transfers_cost?: number;
    }>;
  }>,
  currentPicksDetails?: Record<string | number, any>,
  currentGW: number = 1,
  isCurrentGWFinal: boolean = true
): LeagueEfficiencyOverview {
  const managerSummaries: ManagerEfficiencySummary[] = (managerHistories || []).map((m: any) => {
    const hist = Array.isArray(m.history) ? m.history : Array.isArray(m.current) ? m.current : [];
    const chips = Array.isArray(m.chips) ? m.chips : [];
    const mgrName = m.playerName || m.managerName || m.entryName || `Manager #${m.entryId}`;
    const tmName = m.entryName || m.teamName || '';
    const rk = typeof m.currentRank === 'number' ? m.currentRank : typeof m.rank === 'number' ? m.rank : 999;

    return calculateManagerEfficiencyHistory(hist, chips, {
      entryId: m.entryId,
      managerName: mgrName,
      teamName: tmName,
      rank: rk,
    });
  });

  // League averages
  const validEfficiencies = managerSummaries
    .map((m) => m.averageEfficiency)
    .filter((e): e is number => typeof e === 'number');

  const leagueAverageEfficiency =
    validEfficiencies.length > 0
      ? Number((validEfficiencies.reduce((a, b) => a + b, 0) / validEfficiencies.length).toFixed(1))
      : null;

  const totalLeagueBenchPoints = managerSummaries.reduce((sum, m) => sum + m.totalBenchPoints, 0);
  const leagueAverageBenchPoints =
    managerSummaries.length > 0
      ? Number((managerSummaries.reduce((sum, m) => sum + m.averageBenchPoints, 0) / managerSummaries.length).toFixed(1))
      : 0;

  // Find extremes for regular managers - Decoupled metrics!
  // 1. Highest Efficiency: max(averageEfficiency)
  // 2. Lowest Efficiency: min(averageEfficiency)
  // 3. Highest Bench Points (Most Bench Points): max(totalBenchPoints)
  let highestEfficiencyManager: LeagueEfficiencyOverview['highestEfficiencyManager'] = null;
  let lowestEfficiencyManager: LeagueEfficiencyOverview['lowestEfficiencyManager'] = null;
  let highestBenchManager: LeagueEfficiencyOverview['highestBenchManager'] = null;

  for (const m of managerSummaries) {
    if (m.averageEfficiency !== null) {
      if (
        highestEfficiencyManager === null ||
        m.averageEfficiency > highestEfficiencyManager.value ||
        (m.averageEfficiency === highestEfficiencyManager.value && m.rank < highestEfficiencyManager.rank)
      ) {
        highestEfficiencyManager = {
          managerId: m.managerId,
          managerName: m.managerName,
          teamName: m.teamName,
          rank: m.rank,
          value: m.averageEfficiency,
        };
      }
      if (
        lowestEfficiencyManager === null ||
        m.averageEfficiency < lowestEfficiencyManager.value ||
        (m.averageEfficiency === lowestEfficiencyManager.value && m.rank > lowestEfficiencyManager.rank)
      ) {
        lowestEfficiencyManager = {
          managerId: m.managerId,
          managerName: m.managerName,
          teamName: m.teamName,
          rank: m.rank,
          value: m.averageEfficiency,
        };
      }
    }

    if (
      highestBenchManager === null ||
      m.totalBenchPoints > highestBenchManager.value ||
      (m.totalBenchPoints === highestBenchManager.value && m.rank < highestBenchManager.rank)
    ) {
      highestBenchManager = {
        managerId: m.managerId,
        managerName: m.managerName,
        teamName: m.teamName,
        rank: m.rank,
        value: m.totalBenchPoints,
      };
    }
  }

  // Gameweek trends
  const eventSet = new Set<number>();
  for (const m of managerSummaries) {
    for (const h of m.gameweekHistory) {
      eventSet.add(h.gameweek);
    }
  }
  const sortedGWs = Array.from(eventSet).sort((a, b) => a - b);

  const gameweekTrends: LeagueEfficiencyOverview['gameweekTrends'] = sortedGWs.map((gw) => {
    const gwItems = managerSummaries
      .map((m) => m.gameweekHistory.find((h) => h.gameweek === gw))
      .filter((h): h is ManagerGameweekEfficiency => Boolean(h));

    const validEffs = gwItems
      .map((h) => h.startingXIEfficiency)
      .filter((e): e is number => typeof e === 'number');

    const avgEff =
      validEffs.length > 0
        ? Number((validEffs.reduce((a, b) => a + b, 0) / validEffs.length).toFixed(1))
        : null;

    const benchSum = gwItems.reduce((acc, h) => acc + (h.benchPointsRaw ?? 0), 0);
    const avgBench = gwItems.length > 0 ? Number((benchSum / gwItems.length).toFixed(1)) : 0;

    const lineupSum = gwItems.reduce((acc, h) => acc + (h.lineupPoints ?? 0), 0);
    const avgLineup = gwItems.length > 0 ? Number((lineupSum / gwItems.length).toFixed(1)) : 0;

    return {
      gameweek: gw,
      averageEfficiency: avgEff,
      averageBenchPoints: avgBench,
      averageLineupPoints: avgLineup,
    };
  });

  // Current GW averages from picksDetails if available
  let currentGWAverageEfficiency: number | null = null;
  let currentGWAverageBenchPoints = 0;

  if (currentPicksDetails) {
    const detailsList = Object.values(currentPicksDetails);
    if (detailsList.length > 0) {
      const curEffs: number[] = [];
      let curBenchSum = 0;

      for (const d of detailsList) {
        const isBB = String(d.chip || '').toUpperCase() === 'BB' || String(d.chip || '').toUpperCase() === 'BBOOST';
        const rawBench = typeof d.benchPoints === 'number' ? d.benchPoints : 0;
        curBenchSum += rawBench;

        const lineup = typeof d.entry_history?.points === 'number'
          ? d.entry_history.points
          : typeof d.lineupPoints === 'number'
          ? d.lineupPoints
          : null;

        const eff = calculateStartingXIEfficiency(lineup, rawBench, isBB);
        if (typeof eff === 'number') {
          curEffs.push(eff);
        }
      }

      currentGWAverageBenchPoints = Number((curBenchSum / detailsList.length).toFixed(1));
      if (curEffs.length > 0) {
        currentGWAverageEfficiency = Number(
          (curEffs.reduce((a, b) => a + b, 0) / curEffs.length).toFixed(1)
        );
      }
    }
  }

  return {
    currentGameweek: currentGW,
    isCurrentGWFinal,
    leagueAverageEfficiency,
    leagueAverageBenchPoints,
    totalLeagueBenchPoints,
    totalLeagueRawBenchPoints: totalLeagueBenchPoints,
    currentGWAverageEfficiency,
    currentGWAverageBenchPoints,
    highestEfficiencyManager,
    lowestEfficiencyManager,
    highestBenchManager,
    gameweekTrends,
    managerSummaries,
  };
}

/**
 * Builds full 15-player squad detail for the Current Gameweek Inspector.
 */
export function buildCurrentGWManagerDetail(
  managerEntry: number | string,
  detailsMap: Record<string | number, any>,
  standingsMap?: Map<string, any>,
  isFinished: boolean = true,
  isDataChecked: boolean = true
): CurrentGWManagerSquadDetail | null {
  const d = detailsMap?.[managerEntry] || detailsMap?.[String(managerEntry)];
  if (!d) return null;

  const st = standingsMap?.get(String(managerEntry));
  const managerName = d.player_name || st?.player_name || `Manager #${d.entry}`;
  const teamName = d.entry_name || st?.entry_name || '';
  const rank = typeof d.rank === 'number' && d.rank > 0
    ? d.rank
    : typeof st?.rank === 'number'
    ? st.rank
    : 999;

  const activeChip = d.chip ? String(d.chip).toUpperCase() : null;
  const isBenchBoostActive = activeChip === 'BB' || activeChip === 'BBOOST';
  const isTripleCaptainActive = activeChip === '3XC' || activeChip === 'TC';

  const autoSubs = Array.isArray(d.automatic_subs) ? d.automatic_subs : [];
  const subbedInIds = new Set<number>(autoSubs.map((s: any) => Number(s.element_in)));
  const subbedOutIds = new Set<number>(autoSubs.map((s: any) => Number(s.element_out)));

  const picksList = Array.isArray(d.picksList) ? d.picksList : [];

  const startingXI: PlayerLineupContribution[] = [];
  const bench: PlayerLineupContribution[] = [];

  for (const p of picksList) {
    const pId = Number(p.id || p.element);
    const posNum = Number(p.position || 1);
    const wasSubbedIn = subbedInIds.has(pId);
    const wasSubbedOut = subbedOutIds.has(pId);

    // If subbed in, player joins final scoring starting XI. If subbed out, joins bench.
    const isStarter = (posNum <= 11 && !wasSubbedOut) || wasSubbedIn;
    const benchOrder = isStarter
      ? 0
      : posNum <= 11
      ? 4 // Subbed out former starter placed at end of bench
      : posNum === 12
      ? 1
      : posNum - 11;

    let mult = typeof p.multiplier === 'number' ? p.multiplier : isStarter ? 1 : 0;
    if (wasSubbedIn && mult === 0) {
      mult = 1;
    }
    if (wasSubbedOut && !isBenchBoostActive) {
      mult = 0;
    }
    if (isBenchBoostActive && mult === 0) {
      mult = 1;
    }

    const rawPts = typeof p.rawPoints === 'number' ? p.rawPoints : p.total_points ?? 0;
    const points = typeof p.points === 'number' && !wasSubbedIn && !wasSubbedOut ? p.points : rawPts * mult;

    const item: PlayerLineupContribution = {
      playerId: pId,
      playerName: p.name || p.web_name || 'Player',
      fullName: p.fullName || p.name || p.web_name || 'Player',
      position: p.positionName || (p.elementType === 1 ? 'GKP' : p.elementType === 2 ? 'DEF' : p.elementType === 3 ? 'MID' : 'FWD'),
      teamShort: p.teamShortName || '',
      teamName: p.teamName || '',
      jerseyUrl: p.jerseyUrl || '',
      points,
      rawPoints: rawPts,
      minutes: p.minutes ?? 0,
      multiplier: mult,
      isCaptain: Boolean(p.isCaptain || p.is_captain),
      isViceCaptain: Boolean(p.isVice || p.is_vice_captain),
      benchOrder,
      wasSubbedIn,
      wasSubbedOut,
      elementPosition: posNum,
    };

    if (isStarter) {
      startingXI.push(item);
    } else {
      bench.push(item);
    }
  }

  // Canonical Lineup Points (Gross Starting XI points)
  let lineupPoints: number | null = null;
  if (typeof d.entry_history?.points === 'number') {
    lineupPoints = d.entry_history.points;
  } else if (typeof d.lineupPoints === 'number') {
    lineupPoints = d.lineupPoints;
  }

  // Transfer cost (-4 per extra transfer)
  const transferCost = typeof d.entry_history?.event_transfers_cost === 'number'
    ? d.entry_history.event_transfers_cost
    : typeof d.transfersCost === 'number'
    ? d.transfersCost
    : 0;

  const netGameweekPoints = lineupPoints !== null ? lineupPoints - transferCost : null;

  // Raw Bench Points (never clamped, preserves negative points if any)
  const rawBenchPoints = typeof d.entry_history?.points_on_bench === 'number'
    ? d.entry_history.points_on_bench
    : typeof d.benchPoints === 'number'
    ? d.benchPoints
    : 0;

  const derivedBenchPoints = rawBenchPoints !== null ? Math.max(0, rawBenchPoints) : null;

  const startingXIEfficiency = calculateStartingXIEfficiency(
    lineupPoints,
    rawBenchPoints,
    isBenchBoostActive
  );

  const finalScoringXI = isBenchBoostActive
    ? startingXI.length + bench.length
    : startingXI.filter((p) => p.multiplier >= 1).length;

  return {
    managerId: d.entry,
    managerName,
    teamName,
    rank,
    gameweek: d.entry_history?.event || 1,
    selectedXI: 11,
    finalScoringXI,
    lineupPoints,
    transferCost,
    netGameweekPoints,
    rawBenchPoints,
    benchPointsRaw: rawBenchPoints,
    derivedBenchPoints,
    benchPointsForEfficiency: derivedBenchPoints,
    startingXIEfficiency,
    activeChip,
    isBenchBoostActive,
    isTripleCaptainActive,
    isFinished,
    isDataChecked,
    startingXI,
    bench,
    automaticSubs: autoSubs.map((s: any) => ({
      elementIn: Number(s.element_in),
      elementOut: Number(s.element_out),
    })),
  };
}

// ==========================================
// V6.5 MANAGER DNA & MOMENTUM CALCULATIONS
// ==========================================

export type PlaystylePersona =
  | 'The Template General'
  | 'The Chaos Merchant'
  | 'The Differential Sniper'
  | 'The Squad Hoarder'
  | 'The Steady Grinder'
  | 'Calibrating';

export interface ManagerDNAProfile {
  managerId: number;
  managerName: string;
  teamName: string;
  rank: number;
  currentTotal: number;

  // 1. Aggressiveness Index (0-100)
  aggressiveness: {
    score: number; // 0 - 100
    totalTransferCost: number; // Sum of event_transfers_cost
    totalTransfers: number; // Sum of event_transfers
    hitGWsCount: number; // GWs with cost > 0
    eligibleGWsCount: number; // Completed GWs excluding WC/FH
    avgHitPerEligibleGW: number;
    hitFrequencyRatio: number; // hitGWsCount / eligibleGWsCount
    hitDragRatio: number; // totalTransferCost / totalGrossLineupPoints
  };

  // 2. Differential Affinity (0-100)
  differentialAffinity: {
    score: number; // 0 - 100 (Higher = more differential)
    templateExposure: number; // Weighted average league ownership of squad (0-100)
    differentialCount: number; // Count of players in 15-man squad with ownership < 15%
    coreCount: number; // Count of players in 15-man squad with ownership > 60%
    standardCount: number;
  };

  // 3. Captaincy Boldness (0-100)
  captaincyBoldness: {
    score: number; // 0 - 100
    currentCaptainName: string;
    isConsensusCaptain: boolean;
    consensusCaptainName: string;
    captainLeagueOwnership: number; // % of league owning this captain
    captainExposureShare: number; // % of league captaining this player
  };

  // 4. Bench Profile
  benchProfile: {
    painRatio: number | null; // % of total points left on bench across eligible GWs
    totalRawBenchPoints: number; // Exact raw sum (negative numbers preserved)
    gwsWithBenchedDoubleDigits: number; // Frequency of leaving >= 10 pts on bench
    eligibleBenchGWsCount: number;
  };

  // 5. Synthesis & Archetype
  persona: PlaystylePersona;
  personaTitle: string;
  personaDescription: string;
  calibrationStatus: 'CALIBRATING' | 'CALIBRATED';
  sampleSize: {
    completedGameweeks: number;
    eligibleTransferGameweeks: number;
  };
}

export interface ManagerMomentumEntry {
  managerId: number;
  managerName: string;
  teamName: string;
  currentRank: number;
  currentTotal: number;
  windowGWs: number[];
  recentPointsSum: number;
  recentAverage: number;
  recentRankMovement: number; // Sum of (last_rank - rank) across window
  momentumScore: number; // 0 - 100 normalized index
  trend: 'HOT' | 'WARM' | 'COOL' | 'COLD';
}

export interface LeagueDNAResult {
  profiles: ManagerDNAProfile[];
  medianAggressiveness: number;
  medianDifferentialAffinity: number;
  medianCaptaincyBoldness: number;
  medianBenchPainRatio: number | null;
  consensusCaptain: {
    playerName: string;
    captainCount: number;
    sharePercentage: number;
  } | null;
  personaDistribution: Record<PlaystylePersona, number>;
  momentumRanking: ManagerMomentumEntry[];
}

/**
 * Calculates deterministic Manager DNA & Playstyle Profiling for all managers in the league.
 * Zero external network calls - consumes existing batched managerHistories and league-picks details.
 */
export function calculateLeagueManagerDNA(params: {
  managerHistories: Array<{
    entryId: number;
    entryName: string;
    playerName: string;
    currentRank: number;
    currentTotal: number;
    chips: Array<{ name: string; event: number }>;
    history: Array<{
      event: number;
      points: number;
      total_points: number;
      rank: number;
      overall_rank: number;
      bank: number;
      value: number;
      event_transfers: number;
      event_transfers_cost: number;
      points_on_bench: number;
    }>;
  }>;
  picksDetails?: Record<string | number, any> | null;
  ownershipMap?: Map<number, PlayerOwnershipStats> | null;
  completedGameweeksCount?: number;
}): LeagueDNAResult {
  const {
    managerHistories = [],
    picksDetails = {},
    ownershipMap = new Map<number, PlayerOwnershipStats>(),
    completedGameweeksCount = 0,
  } = params;

  const totalManagers = managerHistories.length;
  if (totalManagers === 0) {
    return {
      profiles: [],
      medianAggressiveness: 0,
      medianDifferentialAffinity: 0,
      medianCaptaincyBoldness: 0,
      medianBenchPainRatio: null,
      consensusCaptain: null,
      personaDistribution: {
        'The Template General': 0,
        'The Chaos Merchant': 0,
        'The Differential Sniper': 0,
        'The Squad Hoarder': 0,
        'The Steady Grinder': 0,
        'Calibrating': 0,
      },
      momentumRanking: [],
    };
  }

  // 1. Identify current consensus captain from picksDetails
  const captainTally = new Map<string, { count: number; playerName: string }>();
  let totalCaptainsRecorded = 0;

  if (picksDetails && Object.keys(picksDetails).length > 0) {
    Object.values(picksDetails).forEach((detail: any) => {
      const capName = detail.captainName;
      if (capName && capName !== '—') {
        const entry = captainTally.get(capName) || { count: 0, playerName: capName };
        entry.count += 1; // Triple Captain counts as 1 exposure in count
        captainTally.set(capName, entry);
        totalCaptainsRecorded += 1;
      }
    });
  }

  let consensusCaptainInfo: { playerName: string; count: number; share: number } | null = null;
  if (captainTally.size > 0) {
    const sortedCaptains = Array.from(captainTally.values()).sort((a, b) => b.count - a.count);
    const topCap = sortedCaptains[0];
    consensusCaptainInfo = {
      playerName: topCap.playerName,
      count: topCap.count,
      share: totalCaptainsRecorded > 0 ? round2((topCap.count / totalCaptainsRecorded) * 100) : 0,
    };
  }

  // 2. Compute individual metrics per manager
  const rawProfiles = managerHistories.map((m) => {
    const historyList = Array.isArray(m.history) ? m.history : [];
    const chipsList = Array.isArray(m.chips) ? m.chips : [];

    // Chip GW lookup (Wildcard / Free Hit makes transfers free)
    const freeTransferEvents = new Set<number>();
    const benchBoostEvents = new Set<number>();

    chipsList.forEach((c) => {
      const name = String(c.name || '').toLowerCase();
      if (name.includes('wildcard') || name.includes('freehit')) {
        freeTransferEvents.add(c.event);
      }
      if (name.includes('bboost') || name === 'bb') {
        benchBoostEvents.add(c.event);
      }
    });

    // A. AGGRESSIVENESS INDEX (0-100)
    // Eligible GWs = completed GWs excluding Wildcard & Free Hit
    let totalTransferCost = 0;
    let totalTransfers = 0;
    let hitGWsCount = 0;
    let eligibleGWsCount = 0;
    let totalGrossLineupPoints = 0;

    historyList.forEach((h) => {
      const isEligible = !freeTransferEvents.has(h.event);
      if (isEligible) {
        eligibleGWsCount++;
        const cost = Number(h.event_transfers_cost || 0);
        if (cost > 0) {
          hitGWsCount++;
          totalTransferCost += cost;
        }
      }
      totalTransfers += Number(h.event_transfers || 0);
      totalGrossLineupPoints += Number(h.points || 0);
    });

    const hitFrequencyRatio = eligibleGWsCount > 0 ? round2(hitGWsCount / eligibleGWsCount) : 0;
    const avgHitPerEligibleGW = eligibleGWsCount > 0 ? round2(totalTransferCost / eligibleGWsCount) : 0;
    const hitDragRatio = totalGrossLineupPoints > 0 ? round2(totalTransferCost / totalGrossLineupPoints) : 0;

    // Continuous exponential saturation model (No arbitrary hard clamp)
    // Score = 0.5 * hitFrequencyRatio + 0.5 * (avgHitPerEligibleGW / 4)
    // Aggressiveness = round(100 * (1 - e^(-1.6 * Score)))
    let aggressivenessScore = 0;
    if (eligibleGWsCount > 0 && totalTransferCost > 0) {
      const compositeHitScore = (0.5 * hitFrequencyRatio) + (0.5 * (avgHitPerEligibleGW / 4));
      aggressivenessScore = Math.min(100, Math.max(0, Math.round(100 * (1 - Math.exp(-1.6 * compositeHitScore)))));
    }

    // B. DIFFERENTIAL AFFINITY (0-100)
    // Evaluates 15-man squad against League Ownership Map
    const managerPickDetail = picksDetails ? picksDetails[m.entryId] : null;
    const picksList: any[] = managerPickDetail?.picksList || [];

    let differentialCount = 0;
    let coreCount = 0;
    let standardCount = 0;
    let weightedExposureSum = 0;
    let weightedMaxDenominator = 0;

    if (picksList.length > 0 && ownershipMap && ownershipMap.size > 0) {
      picksList.forEach((pick: any) => {
        const playerId = Number(pick.id);
        const ownStat = ownershipMap.get(playerId);
        const ownPct = ownStat ? ownStat.ownership : 0;
        const isStarter = pick.position <= 11;
        const weight = isStarter ? 1.0 : 0.5;

        weightedExposureSum += ownPct * weight;
        weightedMaxDenominator += 100 * weight;

        if (ownPct < 15.0) {
          differentialCount++;
        } else if (ownPct > 60.0) {
          coreCount++;
        } else {
          standardCount++;
        }
      });
    }

    const templateExposure = weightedMaxDenominator > 0
      ? round2((weightedExposureSum / weightedMaxDenominator) * 100)
      : 50.0;
    const differentialAffinityScore = Math.min(100, Math.max(0, round2(100 - templateExposure)));

    // C. CAPTAINCY BOLDNESS (0-100)
    const currentCaptainName = managerPickDetail?.captainName || '—';
    const currentCaptainPick = picksList.find((p: any) => p.isCaptain || p.is_captain);
    const captainPlayerId = currentCaptainPick ? Number(currentCaptainPick.id) : null;
    const captainOwnStat = captainPlayerId ? ownershipMap?.get(captainPlayerId) : null;
    const captainLeagueOwnership = captainOwnStat ? captainOwnStat.ownership : 0;

    const isConsensusCaptain = Boolean(
      consensusCaptainInfo &&
      currentCaptainName !== '—' &&
      currentCaptainName.toLowerCase() === consensusCaptainInfo.playerName.toLowerCase()
    );

    let captainExposureShare = 0;
    if (consensusCaptainInfo && currentCaptainName !== '—') {
      const tally = captainTally.get(currentCaptainName);
      if (tally && totalCaptainsRecorded > 0) {
        captainExposureShare = round2((tally.count / totalCaptainsRecorded) * 100);
      }
    }

    let captaincyBoldnessScore = 50;
    if (currentCaptainName !== '—' && totalCaptainsRecorded > 0) {
      if (isConsensusCaptain && consensusCaptainInfo) {
        // Safe captain: boldness is inversely proportional to consensus dominance
        captaincyBoldnessScore = Math.min(100, Math.max(0, round2(100 - consensusCaptainInfo.share)));
      } else {
        // Maverick captain: boldness is 100 minus the share of managers captaining this pick
        captaincyBoldnessScore = Math.min(100, Math.max(0, round2(100 - captainExposureShare)));
      }
    }

    // D. BENCH PROFILE (Bench Utilization / Pain Ratio)
    let totalRawBenchPoints = 0;
    let validBenchPointsSum = 0;
    let validLineupPointsSum = 0;
    let gwsWithBenchedDoubleDigits = 0;
    let eligibleBenchGWsCount = 0;

    historyList.forEach((h) => {
      const rawBench = Number(h.points_on_bench ?? 0);
      const grossLineup = Number(h.points ?? 0);
      totalRawBenchPoints += rawBench;

      const isBenchBoost = benchBoostEvents.has(h.event);
      // Canonical V6.4 Rule: If Bench Boost active OR rawBench < 0, ratio metric for that GW is null
      if (!isBenchBoost && rawBench >= 0) {
        validBenchPointsSum += rawBench;
        validLineupPointsSum += grossLineup;
        eligibleBenchGWsCount++;
        if (rawBench >= 10) {
          gwsWithBenchedDoubleDigits++;
        }
      }
    });

    const totalValidCombined = validLineupPointsSum + validBenchPointsSum;
    const benchPainRatio = (eligibleBenchGWsCount > 0 && totalValidCombined > 0)
      ? round2((validBenchPointsSum / totalValidCombined) * 100)
      : null;

    // Calibration check (requires >= 3 completed GWs)
    const effectiveGWsCount = Math.max(completedGameweeksCount, historyList.length);
    const isCalibrated = effectiveGWsCount >= 3;

    return {
      managerId: m.entryId,
      managerName: m.playerName || `Manager #${m.entryId}`,
      teamName: m.entryName || '',
      rank: m.currentRank,
      currentTotal: m.currentTotal,
      aggressiveness: {
        score: aggressivenessScore,
        totalTransferCost,
        totalTransfers,
        hitGWsCount,
        eligibleGWsCount,
        avgHitPerEligibleGW,
        hitFrequencyRatio,
        hitDragRatio,
      },
      differentialAffinity: {
        score: differentialAffinityScore,
        templateExposure,
        differentialCount,
        coreCount,
        standardCount,
      },
      captaincyBoldness: {
        score: captaincyBoldnessScore,
        currentCaptainName,
        isConsensusCaptain,
        consensusCaptainName: consensusCaptainInfo ? consensusCaptainInfo.playerName : '—',
        captainLeagueOwnership,
        captainExposureShare,
      },
      benchProfile: {
        painRatio: benchPainRatio,
        totalRawBenchPoints,
        gwsWithBenchedDoubleDigits,
        eligibleBenchGWsCount,
      },
      effectiveGWsCount,
      isCalibrated,
    };
  });

  // 3. Compute Medians for relative league benchmarking
  const aggScores = rawProfiles.map((p) => p.aggressiveness.score).sort((a, b) => a - b);
  const diffScores = rawProfiles.map((p) => p.differentialAffinity.score).sort((a, b) => a - b);
  const capScores = rawProfiles.map((p) => p.captaincyBoldness.score).sort((a, b) => a - b);
  const benchPains = rawProfiles
    .map((p) => p.benchProfile.painRatio)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : round2((arr[mid - 1] + arr[mid]) / 2);
  };

  const medianAgg = median(aggScores);
  const medianDiff = median(diffScores);
  const medianCap = median(capScores);
  const medianBench = benchPains.length > 0 ? median(benchPains) : null;

  // 4. Assign deterministic Persona with explicit precedence
  const personaDistribution: Record<PlaystylePersona, number> = {
    'The Template General': 0,
    'The Chaos Merchant': 0,
    'The Differential Sniper': 0,
    'The Squad Hoarder': 0,
    'The Steady Grinder': 0,
    'Calibrating': 0,
  };

  const finalizedProfiles: ManagerDNAProfile[] = rawProfiles.map((p) => {
    if (!p.isCalibrated) {
      personaDistribution['Calibrating']++;
      return {
        ...p,
        persona: 'Calibrating' as PlaystylePersona,
        personaTitle: 'Sedang Kalibrasi Data',
        personaDescription: `Profil gaya bermain membutuhkan minimal 3 Gameweek selesai (saat ini: GW ${p.effectiveGWsCount}/3).`,
        calibrationStatus: 'CALIBRATING',
        sampleSize: {
          completedGameweeks: p.effectiveGWsCount,
          eligibleTransferGameweeks: p.aggressiveness.eligibleGWsCount,
        },
      };
    }

    let persona: PlaystylePersona;
    let personaTitle: string;
    let personaDescription: string;

    const isHighAgg = p.aggressiveness.score >= Math.max(35, medianAgg + 15) && p.aggressiveness.hitGWsCount >= 2;
    const isHighDiff = p.differentialAffinity.score >= Math.max(55, medianDiff + 10);
    const isLowDiff = p.differentialAffinity.score <= Math.min(45, medianDiff - 10);
    const isHighBenchPain = p.benchProfile.painRatio !== null && medianBench !== null && p.benchProfile.painRatio >= medianBench + 8;
    const isConservativeAgg = p.aggressiveness.score <= Math.min(25, medianAgg);

    // Precedence hierarchy:
    // 1. The Chaos Merchant (Priority: High Aggressiveness)
    // 2. The Differential Sniper (Priority: High Differential + Low/Med Aggressiveness)
    // 3. The Template General (Priority: Low Differential + Conservative)
    // 4. The Squad Hoarder (Priority: High Bench Pain)
    // 5. The Steady Grinder (Balanced / Default)
    if (isHighAgg) {
      persona = 'The Chaos Merchant';
      personaTitle = 'The Chaos Merchant';
      personaDescription = 'Gaya bermain ultra-agresif; berani mengambil penalti poin transfer demi merombak tim dan mengejar momentum.';
    } else if (isHighDiff && isConservativeAgg) {
      persona = 'The Differential Sniper';
      personaTitle = 'The Differential Sniper';
      personaDescription = 'Jeli memilih pemain differential berkepemilikan rendah dengan tetap disiplin menjaga pengeluaran transfer.';
    } else if (isLowDiff && isConservativeAgg) {
      persona = 'The Template General';
      personaTitle = 'The Template General';
      personaDescription = 'Mengandalkan pemain konsensus utama liga; bermain aman, disiplin, dan meminimalkan resiko transfer minus.';
    } else if (isHighBenchPain) {
      persona = 'The Squad Hoarder';
      personaTitle = 'The Squad Hoarder';
      personaDescription = 'Memiliki kedalaman skuad tinggi namun kerap dipusingkan rotasi; potensi poin besar kerap tertinggal di bench.';
    } else {
      persona = 'The Steady Grinder';
      personaTitle = 'The Steady Grinder';
      personaDescription = 'Pendekatan taktis berimbang; seimbang antara adaptasi pemain populer dan konsistensi jangka panjang.';
    }

    personaDistribution[persona]++;

    return {
      managerId: p.managerId,
      managerName: p.managerName,
      teamName: p.teamName,
      rank: p.rank,
      currentTotal: p.currentTotal,
      aggressiveness: p.aggressiveness,
      differentialAffinity: p.differentialAffinity,
      captaincyBoldness: p.captaincyBoldness,
      benchProfile: p.benchProfile,
      persona,
      personaTitle,
      personaDescription,
      calibrationStatus: 'CALIBRATED',
      sampleSize: {
        completedGameweeks: p.effectiveGWsCount,
        eligibleTransferGameweeks: p.aggressiveness.eligibleGWsCount,
      },
    };
  });

  // 5. Compute Momentum Ranking (Form Power Ranking)
  // Evaluates rolling 3 completed GWs
  const momentumRanking: ManagerMomentumEntry[] = managerHistories.map((m) => {
    const historyList = [...(m.history || [])].sort((a, b) => a.event - b.event);
    const windowSize = Math.min(3, historyList.length);
    const recentWindow = historyList.slice(-windowSize);

    const windowGWs = recentWindow.map((h) => h.event);
    const recentPointsSum = recentWindow.reduce((s, h) => s + (h.points || 0), 0);
    const recentAverage = windowSize > 0 ? round2(recentPointsSum / windowSize) : 0;

    // Rank movement sum across window: lower overall_rank is better (positive movement = climbed up)
    let recentRankMovement = 0;
    for (let i = 1; i < recentWindow.length; i++) {
      const prevRank = recentWindow[i - 1].overall_rank;
      const currRank = recentWindow[i].overall_rank;
      if (prevRank && currRank) {
        recentRankMovement += (prevRank - currRank);
      }
    }

    return {
      managerId: m.entryId,
      managerName: m.playerName || `Manager #${m.entryId}`,
      teamName: m.entryName || '',
      currentRank: m.currentRank,
      currentTotal: m.currentTotal,
      windowGWs,
      recentPointsSum,
      recentAverage,
      recentRankMovement,
      momentumScore: 50, // To be normalized below
      trend: 'WARM' as 'HOT' | 'WARM' | 'COOL' | 'COLD',
    };
  });

  // Normalize Momentum Score 0-100 based on recentAverage
  if (momentumRanking.length > 0) {
    const minAvg = Math.min(...momentumRanking.map((m) => m.recentAverage));
    const maxAvg = Math.max(...momentumRanking.map((m) => m.recentAverage));
    const range = maxAvg - minAvg;

    momentumRanking.forEach((m) => {
      let score = 50;
      if (range > 0) {
        score = Math.min(100, Math.max(0, Math.round(((m.recentAverage - minAvg) / range) * 100)));
      }
      m.momentumScore = score;
      if (score >= 75) m.trend = 'HOT';
      else if (score >= 50) m.trend = 'WARM';
      else if (score >= 25) m.trend = 'COOL';
      else m.trend = 'COLD';
    });

    // Deterministic sort: Momentum score desc, then recentRankMovement desc, then currentRank asc
    momentumRanking.sort((a, b) => {
      if (b.momentumScore !== a.momentumScore) return b.momentumScore - a.momentumScore;
      if (b.recentRankMovement !== a.recentRankMovement) return b.recentRankMovement - a.recentRankMovement;
      return a.currentRank - b.currentRank;
    });
  }

  return {
    profiles: finalizedProfiles.sort((a, b) => a.rank - b.rank),
    medianAggressiveness: medianAgg,
    medianDifferentialAffinity: medianDiff,
    medianCaptaincyBoldness: medianCap,
    medianBenchPainRatio: medianBench,
    consensusCaptain: consensusCaptainInfo ? {
      playerName: consensusCaptainInfo.playerName,
      captainCount: consensusCaptainInfo.count,
      sharePercentage: consensusCaptainInfo.share,
    } : null,
    personaDistribution,
    momentumRanking,
  };
}

/**
 * Formal Verification Tests (Test 1 through Test 5) answering V6.4 Phase 3:
 * Test 1: Normal (72 lineup, 18 bench => 80.0%)
 * Test 2: Decoupling of Lowest Efficiency (Manager A) vs Most Bench Points (Manager B)
 * Test 3: Negative Bench (10 lineup, -2 raw bench => raw preserved -2, efficiency null)
 * Test 4: Bench Boost (active => efficiency null, benchBoostActive true)
 * Test 5: Transfer Hit (points = 70, transferCost = 4 => netGameweekPoints = 66)
 *
 * Plus V6.5 Tests:
 * Test 6: Zero transfer hit => aggressiveness 0
 * Test 7: Captain consensus case vs Differential case
 * Test 8: Triple Captain counts as 1 exposure in DNA
 * Test 9: Negative bench preservation in DNA benchProfile
 * Test 10: Early season calibration threshold (< 3 GWs => Calibrating)
 */
export function runRequiredSemanticTests() {
  // Test 1: Normal
  const effTest1 = calculateStartingXIEfficiency(72, 18, false);
  const test1Passed = effTest1 === 80.0;

  // Test 2: Lowest Efficiency vs Most Bench Points
  const effA_Test2 = calculateStartingXIEfficiency(100, 50, false); // 100/150 = 66.7%
  const effB_Test2 = calculateStartingXIEfficiency(300, 60, false); // 300/360 = 83.3%

  const overviewTest2 = calculateLeagueEfficiencyOverview([
    {
      entryId: 1,
      entryName: 'Team A',
      playerName: 'Manager A',
      currentRank: 1,
      chips: [],
      history: [{ event: 1, points: 100, total_points: 100, points_on_bench: 50 }],
    },
    {
      entryId: 2,
      entryName: 'Team B',
      playerName: 'Manager B',
      currentRank: 2,
      chips: [],
      history: [{ event: 1, points: 300, total_points: 300, points_on_bench: 60 }],
    },
  ]);

  const test2Passed =
    effA_Test2 === 66.7 &&
    effB_Test2 === 83.3 &&
    overviewTest2.lowestEfficiencyManager?.managerId === 1 &&
    overviewTest2.highestBenchManager?.managerId === 2;

  // Test 3: Negative Bench
  const gwTest3 = calculateManagerGameweekEfficiency({
    gameweek: 5,
    lineupPoints: 10,
    rawBenchPoints: -2,
    activeChip: null,
    isFinished: true,
  });
  const test3Passed =
    gwTest3.rawBenchPoints === -2 &&
    gwTest3.startingXIEfficiency === null;

  // Test 4: Bench Boost
  const gwTest4 = calculateManagerGameweekEfficiency({
    gameweek: 12,
    lineupPoints: 95,
    rawBenchPoints: 24,
    activeChip: 'bboost',
    isFinished: true,
  });
  const test4Passed =
    gwTest4.startingXIEfficiency === null &&
    gwTest4.isBenchBoostActive === true;

  // Test 5: Transfer Hit
  const gwTest5 = calculateManagerGameweekEfficiency({
    gameweek: 2,
    lineupPoints: 70, // Gross 11 starters
    rawBenchPoints: 11,
    transferCost: 4,
    activeChip: null,
    isFinished: true,
  });
  const test5Passed =
    gwTest5.lineupPoints === 70 &&
    gwTest5.transferCost === 4 &&
    gwTest5.netGameweekPoints === 66;

  // Test 6 (V6.5): Zero transfer hit => aggressiveness 0
  const dnaTest6 = calculateLeagueManagerDNA({
    managerHistories: [
      {
        entryId: 1,
        entryName: 'Disciplined FC',
        playerName: 'Manager Zero Hit',
        currentRank: 1,
        currentTotal: 350,
        chips: [],
        history: [
          { event: 1, points: 70, total_points: 70, rank: 1, overall_rank: 1, bank: 0, value: 1000, event_transfers: 0, event_transfers_cost: 0, points_on_bench: 5 },
          { event: 2, points: 65, total_points: 135, rank: 1, overall_rank: 1, bank: 0, value: 1000, event_transfers: 1, event_transfers_cost: 0, points_on_bench: 4 },
          { event: 3, points: 80, total_points: 215, rank: 1, overall_rank: 1, bank: 0, value: 1000, event_transfers: 1, event_transfers_cost: 0, points_on_bench: 8 },
        ],
      },
    ],
    completedGameweeksCount: 3,
  });
  const test6Passed = dnaTest6.profiles[0].aggressiveness.score === 0 && dnaTest6.profiles[0].aggressiveness.totalTransferCost === 0;

  // Test 7 (V6.5): Negative bench preserved in benchProfile
  const dnaTest7 = calculateLeagueManagerDNA({
    managerHistories: [
      {
        entryId: 2,
        entryName: 'Deficit FC',
        playerName: 'Manager Neg Bench',
        currentRank: 2,
        currentTotal: 200,
        chips: [],
        history: [
          { event: 1, points: 60, total_points: 60, rank: 2, overall_rank: 2, bank: 0, value: 1000, event_transfers: 0, event_transfers_cost: 0, points_on_bench: -2 },
          { event: 2, points: 70, total_points: 130, rank: 2, overall_rank: 2, bank: 0, value: 1000, event_transfers: 0, event_transfers_cost: 0, points_on_bench: 10 },
          { event: 3, points: 70, total_points: 200, rank: 2, overall_rank: 2, bank: 0, value: 1000, event_transfers: 0, event_transfers_cost: 0, points_on_bench: 5 },
        ],
      },
    ],
    completedGameweeksCount: 3,
  });
  const test7Passed = dnaTest7.profiles[0].benchProfile.totalRawBenchPoints === 13; // -2 + 10 + 5 = 13 raw

  // Test 8 (V6.5): Early calibration threshold (<3 GWs => Calibrating)
  const dnaTest8 = calculateLeagueManagerDNA({
    managerHistories: [
      {
        entryId: 3,
        entryName: 'Early FC',
        playerName: 'Manager Early',
        currentRank: 3,
        currentTotal: 70,
        chips: [],
        history: [
          { event: 1, points: 70, total_points: 70, rank: 3, overall_rank: 3, bank: 0, value: 1000, event_transfers: 0, event_transfers_cost: 0, points_on_bench: 4 },
        ],
      },
    ],
    completedGameweeksCount: 1,
  });
  const test8Passed = dnaTest8.profiles[0].calibrationStatus === 'CALIBRATING' && dnaTest8.profiles[0].persona === 'Calibrating';

  return {
    test1: {
      lineup: 72,
      bench: 18,
      efficiency: effTest1,
      expected: 80.0,
      passed: test1Passed,
    },
    test2: {
      managerA: { lineup: 100, bench: 50, efficiency: effA_Test2 },
      managerB: { lineup: 300, bench: 60, efficiency: effB_Test2 },
      lowestEfficiencyManager: overviewTest2.lowestEfficiencyManager?.managerName,
      mostBenchManager: overviewTest2.highestBenchManager?.managerName,
      passed: test2Passed,
    },
    test3: {
      lineup: 10,
      rawBenchPoints: gwTest3.rawBenchPoints,
      startingXIEfficiency: gwTest3.startingXIEfficiency,
      passed: test3Passed,
    },
    test4: {
      activeChip: 'bboost',
      isBenchBoostActive: gwTest4.isBenchBoostActive,
      startingXIEfficiency: gwTest4.startingXIEfficiency,
      passed: test4Passed,
    },
    test5: {
      grossLineupPoints: gwTest5.lineupPoints,
      transferCost: gwTest5.transferCost,
      netGameweekPoints: gwTest5.netGameweekPoints,
      passed: test5Passed,
    },
    test6: {
      zeroHitAggressiveness: dnaTest6.profiles[0]?.aggressiveness.score,
      passed: test6Passed,
    },
    test7: {
      negativeBenchPreservedSum: dnaTest7.profiles[0]?.benchProfile.totalRawBenchPoints,
      passed: test7Passed,
    },
    test8: {
      calibrationStatus: dnaTest8.profiles[0]?.calibrationStatus,
      passed: test8Passed,
    },
    allPassed:
      test1Passed &&
      test2Passed &&
      test3Passed &&
      test4Passed &&
      test5Passed &&
      test6Passed &&
      test7Passed &&
      test8Passed,
  };
}

