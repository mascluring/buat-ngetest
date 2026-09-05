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
