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

/**
 * Formal Verification Tests (Test 1 through Test 5) answering V6.4 Phase 3:
 * Test 1: Normal (72 lineup, 18 bench => 80.0%)
 * Test 2: Decoupling of Lowest Efficiency (Manager A) vs Most Bench Points (Manager B)
 * Test 3: Negative Bench (10 lineup, -2 raw bench => raw preserved -2, efficiency null)
 * Test 4: Bench Boost (active => efficiency null, benchBoostActive true)
 * Test 5: Transfer Hit (points = 70, transferCost = 4 => netGameweekPoints = 66)
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
    allPassed: test1Passed && test2Passed && test3Passed && test4Passed && test5Passed,
  };
}
