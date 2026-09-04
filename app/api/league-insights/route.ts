import { NextResponse } from 'next/server';
import { getAllLeagueStandings, getBootstrap, getEntryHistory, getLeague, LEAGUE_ID } from '@/lib/fpl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Types for V6.3 League Performance Insights
export interface BestGameweek {
  event: number;
  averagePoints: number;
}

export interface WorstGameweek {
  event: number;
  averagePoints: number;
}

export interface BestWeeklyPerformance {
  entryId: number;
  managerName: string;
  event: number;
  points: number;
}

export interface BiggestRankGain {
  entryId: number;
  managerName: string;
  fromRank: number;
  toRank: number;
  movement: number;
  event: number;
}

export interface ConsistentOrVolatileManager {
  entryId: number;
  managerName: string;
  standardDeviation: number;
  averagePoints: number;
  gameweeksAnalyzed: number;
}

export interface LeagueCompetitiveness {
  metric: string;
  value: number;
  label: string;
}

export interface ScoreTrendItem {
  event: number;
  averagePoints: number;
  highestPoints: number;
  lowestPoints: number;
  managerCount: number;
}

export interface PerformanceInsights {
  bestGameweek: BestGameweek | null;
  worstGameweek: WorstGameweek | null;
  bestWeeklyPerformance: BestWeeklyPerformance | null;
  biggestRankGain: BiggestRankGain | null;
  mostConsistentManager: ConsistentOrVolatileManager | null;
  mostVolatileManager: ConsistentOrVolatileManager | null;
  competitiveness: LeagueCompetitiveness | null;
  scoreTrend: ScoreTrendItem[];
  narrative: string;
  summary: {
    completedGameweeks: number;
    managersAnalyzed: number;
    failedManagers: number;
  };
}

export interface LeaguePerformanceInsightsResponse {
  ok: boolean;
  leagueId: number;
  leagueName: string;
  checkedAt: string;
  performanceInsights: PerformanceInsights;
  error?: string;
}

// In-memory cache & In-flight request deduplication
interface CacheEntry {
  data: LeaguePerformanceInsightsResponse;
  expiresAt: number;
}

const CACHE_TTL_MS = 300 * 1000; // 300 seconds (5 minutes)
const insightsCache = new Map<number, CacheEntry>();
const inFlightInsights = new Map<number, Promise<LeaguePerformanceInsightsResponse>>();

/**
 * Controlled concurrency mapper with Promise.allSettled behavior
 * Ensures at most `limit` asynchronous operations execute concurrently.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let nextIndex = 0;

  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (nextIndex < items.length) {
      const currentIdx = nextIndex++;
      try {
        const res = await mapper(items[currentIdx]);
        results[currentIdx] = { status: 'fulfilled', value: res };
      } catch (reason) {
        results[currentIdx] = { status: 'rejected', reason };
      }
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Deterministic Indonesian narrative generator built strictly from actual metric values.
 */
function buildDeterministicNarrative(params: {
  completedGWsCount: number;
  bestGW: BestGameweek | null;
  worstGW: WorstGameweek | null;
  bestWeekly: BestWeeklyPerformance | null;
  biggestGain: BiggestRankGain | null;
  mostConsistent: ConsistentOrVolatileManager | null;
  mostVolatile: ConsistentOrVolatileManager | null;
  competitiveness: LeagueCompetitiveness | null;
}): string {
  const {
    completedGWsCount,
    bestGW,
    worstGW,
    bestWeekly,
    biggestGain,
    mostConsistent,
    mostVolatile,
  } = params;

  if (completedGWsCount === 0 || !bestGW) {
    return 'Belum ada data Gameweek yang cukup untuk menghasilkan League Performance Insights.';
  }

  const sentences: string[] = [];

  // Best & Toughest Gameweek
  if (bestGW) {
    sentences.push(
      `GW${bestGW.event} menjadi Gameweek terbaik Era Super League dengan rata-rata liga mencapai ${bestGW.averagePoints} poin.`
    );
  }

  if (worstGW && worstGW.event !== bestGW?.event) {
    sentences.push(
      `Sementara itu, GW${worstGW.event} menjadi pekan paling menantang dengan perolehan rata-rata terendah ${worstGW.averagePoints} poin.`
    );
  }

  // Best Weekly Performance
  if (bestWeekly) {
    sentences.push(
      `${bestWeekly.managerName} memegang rekor skor mingguan tertinggi musim ini dengan raihan impresif ${bestWeekly.points} poin pada GW${bestWeekly.event}.`
    );
  }

  // Biggest Rank Gain
  if (biggestGain) {
    sentences.push(
      `${biggestGain.managerName} mencatatkan lonjakan klasemen terbesar, melompat ${biggestGain.movement} posisi ke peringkat ${biggestGain.toRank} pada GW${biggestGain.event}.`
    );
  }

  // Consistency & Volatility (requires >= 3 GWs)
  if (mostConsistent && mostVolatile) {
    if (mostConsistent.entryId === mostVolatile.entryId) {
      sentences.push(
        `${mostConsistent.managerName} mencatatkan konsistensi stabil dengan standar deviasi ${mostConsistent.standardDeviation} poin.`
      );
    } else {
      sentences.push(
        `${mostConsistent.managerName} menjadi manajer paling konsisten (standar deviasi ${mostConsistent.standardDeviation} pts), sedangkan ${mostVolatile.managerName} memiliki fluktuasi skor tertinggi (standar deviasi ${mostVolatile.standardDeviation} pts).`
      );
    }
  } else if (completedGWsCount < 3) {
    sentences.push(
      'Analisis konsistensi dan volatilitas manajer akan aktif setelah minimal 3 Gameweek selesai dipertandingkan.'
    );
  }

  return sentences.join(' ');
}

/**
 * Computes League Performance Insights for the specified league ID.
 */
async function computeLeagueInsights(leagueId: number): Promise<LeaguePerformanceInsightsResponse> {
  // 1. Fetch standings and bootstrap concurrently
  const [{ standings }, bootstrap, leagueRes] = await Promise.all([
    getAllLeagueStandings(),
    getBootstrap(),
    getLeague(1).catch(() => null),
  ]);

  const leagueName = leagueRes?.league?.name || 'Era Super League';

  // 2. Identify eligible completed Gameweeks
  const events: any[] = bootstrap?.events || [];
  const completedEvents = events.filter(
    (e: any) => (e.finished || (e.is_current && e.data_checked)) && !e.is_next
  );
  const completedEventIds = new Set<number>(completedEvents.map((e: any) => e.id));

  // 3. Deduplicate managers by entry ID
  const uniqueManagers = Array.from(
    new Map(standings.map((m: any) => [m.entry, m])).values()
  );

  if (uniqueManagers.length === 0) {
    throw new Error('Tidak ada manajer terdaftar dalam liga ini.');
  }

  // 4. Concurrently fetch manager histories with maximum concurrency of 6
  const MAX_CONCURRENCY = 6;
  const historyResults = await mapWithConcurrency(
    uniqueManagers,
    MAX_CONCURRENCY,
    async (m) => {
      const history = await getEntryHistory(m.entry);
      return {
        manager: m,
        history,
      };
    }
  );

  // 5. Separate fulfilled and rejected results (Promise.allSettled behavior)
  interface SuccessfulManager {
    entryId: number;
    entryName: string;
    playerName: string;
    currentRank: number;
    currentTotal: number;
    historyCurrent: Array<{
      event: number;
      points: number;
      total_points: number;
    }>;
  }

  const successfulManagers: SuccessfulManager[] = [];
  let failedManagersCount = 0;

  for (const res of historyResults) {
    if (res.status === 'fulfilled' && res.value?.history?.current) {
      const m = res.value.manager;
      const rawCurrent = res.value.history.current;
      // Filter only completed valid Gameweeks
      const validHistory = rawCurrent
        .filter(
          (h: any) =>
            completedEventIds.has(h.event) &&
            typeof h.points === 'number' &&
            typeof h.total_points === 'number'
        )
        .map((h: any) => ({
          event: Number(h.event),
          points: Number(h.points),
          total_points: Number(h.total_points),
        }));

      successfulManagers.push({
        entryId: m.entry,
        entryName: m.entry_name,
        playerName: m.player_name || m.entry_name,
        currentRank: m.rank,
        currentTotal: m.total ?? 0,
        historyCurrent: validHistory,
      });
    } else {
      failedManagersCount++;
    }
  }

  if (successfulManagers.length === 0) {
    throw new Error('Gagal memuat riwayat manajer liga dari FPL.');
  }

  // Determine completed GW numbers that have data across successful managers
  const eventSet = new Set<number>();
  for (const m of successfulManagers) {
    for (const h of m.historyCurrent) {
      eventSet.add(h.event);
    }
  }
  const completedGWs = Array.from(eventSet).sort((a, b) => a - b);
  const completedGameweeksCount = completedGWs.length;

  // 6. A & B. Best & Worst Gameweek and Score Trend
  let bestGameweek: BestGameweek | null = null;
  let worstGameweek: WorstGameweek | null = null;
  const scoreTrend: ScoreTrendItem[] = [];

  const gwAverages: Array<{ event: number; avg: number }> = [];

  for (const event of completedGWs) {
    const managersInGw = successfulManagers
      .map((m) => {
        const item = m.historyCurrent.find((h) => h.event === event);
        return item ? { points: item.points, total_points: item.total_points } : null;
      })
      .filter((item): item is { points: number; total_points: number } => item !== null);

    if (managersInGw.length === 0) continue;

    const pointsList = managersInGw.map((x) => x.points);
    const sum = pointsList.reduce((acc, p) => acc + p, 0);
    const avg = sum / managersInGw.length;
    const roundedAvg = Math.round((avg + Number.EPSILON) * 10) / 10;
    const highest = Math.max(...pointsList);
    const lowest = Math.min(...pointsList);

    gwAverages.push({ event, avg });

    scoreTrend.push({
      event,
      averagePoints: roundedAvg,
      highestPoints: highest,
      lowestPoints: lowest,
      managerCount: managersInGw.length,
    });
  }

  if (gwAverages.length > 0) {
    // Best GW: highest avg, then earlier event
    const sortedBest = [...gwAverages].sort((a, b) => {
      if (b.avg !== a.avg) return b.avg - a.avg;
      return a.event - b.event;
    });
    bestGameweek = {
      event: sortedBest[0].event,
      averagePoints: Math.round((sortedBest[0].avg + Number.EPSILON) * 10) / 10,
    };

    // Worst GW: lowest avg, then earlier event
    const sortedWorst = [...gwAverages].sort((a, b) => {
      if (a.avg !== b.avg) return a.avg - b.avg;
      return a.event - b.event;
    });
    worstGameweek = {
      event: sortedWorst[0].event,
      averagePoints: Math.round((sortedWorst[0].avg + Number.EPSILON) * 10) / 10,
    };
  }

  // 7. C. Best Weekly Performance
  interface WeeklyScoreRecord {
    entryId: number;
    managerName: string;
    event: number;
    points: number;
  }

  const allWeeklyScores: WeeklyScoreRecord[] = [];
  for (const m of successfulManagers) {
    for (const h of m.historyCurrent) {
      allWeeklyScores.push({
        entryId: m.entryId,
        managerName: m.playerName,
        event: h.event,
        points: h.points,
      });
    }
  }

  let bestWeeklyPerformance: BestWeeklyPerformance | null = null;
  if (allWeeklyScores.length > 0) {
    allWeeklyScores.sort((a, b) => {
      // 1. Higher points
      if (b.points !== a.points) return b.points - a.points;
      // 2. Earlier Gameweek
      if (a.event !== b.event) return a.event - b.event;
      // 3. Manager name alphabetical
      const nameComp = a.managerName.localeCompare(b.managerName);
      if (nameComp !== 0) return nameComp;
      // 4. Entry ID ascending
      return a.entryId - b.entryId;
    });

    bestWeeklyPerformance = {
      entryId: allWeeklyScores[0].entryId,
      managerName: allWeeklyScores[0].managerName,
      event: allWeeklyScores[0].event,
      points: allWeeklyScores[0].points,
    };
  }

  // 8. D. Historical Mini-League Rank Reconstruction & Biggest Rank Gain
  // For every completed Gameweek, reconstruct ordinal rank from total_points
  const reconstructedRanksByEvent = new Map<number, Map<number, number>>();

  for (const event of completedGWs) {
    const managersWithEvent = successfulManagers
      .map((m) => {
        const item = m.historyCurrent.find((h) => h.event === event);
        return item
          ? {
              entryId: m.entryId,
              managerName: m.playerName,
              currentRank: m.currentRank,
              totalPoints: item.total_points,
            }
          : null;
      })
      .filter(
        (x): x is { entryId: number; managerName: string; currentRank: number; totalPoints: number } =>
          x !== null
      );

    // Sort deterministically:
    // 1. total_points descending
    // 2. current league rank ascending
    // 3. manager name alphabetical
    // 4. entry ID ascending
    managersWithEvent.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (a.currentRank !== b.currentRank) return a.currentRank - b.currentRank;
      const nameC = a.managerName.localeCompare(b.managerName);
      if (nameC !== 0) return nameC;
      return a.entryId - b.entryId;
    });

    const rankMap = new Map<number, number>();
    managersWithEvent.forEach((m, idx) => {
      rankMap.set(m.entryId, idx + 1);
    });

    reconstructedRanksByEvent.set(event, rankMap);
  }

  // Calculate Biggest Rank Gain across consecutive completed Gameweeks
  interface RankGainRecord {
    entryId: number;
    managerName: string;
    fromRank: number;
    toRank: number;
    movement: number;
    event: number;
    totalPoints: number;
  }

  const positiveGains: RankGainRecord[] = [];

  for (let i = 1; i < completedGWs.length; i++) {
    const prevEvent = completedGWs[i - 1];
    const currEvent = completedGWs[i];

    const prevRankMap = reconstructedRanksByEvent.get(prevEvent);
    const currRankMap = reconstructedRanksByEvent.get(currEvent);

    if (!prevRankMap || !currRankMap) continue;

    for (const m of successfulManagers) {
      const fromRank = prevRankMap.get(m.entryId);
      const toRank = currRankMap.get(m.entryId);

      if (fromRank !== undefined && toRank !== undefined) {
        const movement = fromRank - toRank;
        if (movement > 0) {
          const currItem = m.historyCurrent.find((h) => h.event === currEvent);
          positiveGains.push({
            entryId: m.entryId,
            managerName: m.playerName,
            fromRank,
            toRank,
            movement,
            event: currEvent,
            totalPoints: currItem?.total_points ?? 0,
          });
        }
      }
    }
  }

  let biggestRankGain: BiggestRankGain | null = null;
  if (positiveGains.length > 0) {
    // Tie-breaker:
    // 1. Largest movement
    // 2. Earlier event
    // 3. Lower toRank
    // 4. Higher total_points
    // 5. Manager name alphabetical
    // 6. Entry ID ascending
    positiveGains.sort((a, b) => {
      if (b.movement !== a.movement) return b.movement - a.movement;
      if (a.event !== b.event) return a.event - b.event;
      if (a.toRank !== b.toRank) return a.toRank - b.toRank;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      const nC = a.managerName.localeCompare(b.managerName);
      if (nC !== 0) return nC;
      return a.entryId - b.entryId;
    });

    biggestRankGain = {
      entryId: positiveGains[0].entryId,
      managerName: positiveGains[0].managerName,
      fromRank: positiveGains[0].fromRank,
      toRank: positiveGains[0].toRank,
      movement: positiveGains[0].movement,
      event: positiveGains[0].event,
    };
  }

  // 9. E & F. Most Consistent & Most Volatile Manager (Sample size guard >= 3 GWs)
  let mostConsistentManager: ConsistentOrVolatileManager | null = null;
  let mostVolatileManager: ConsistentOrVolatileManager | null = null;

  interface ConsistencyStats {
    entryId: number;
    managerName: string;
    stdDev: number;
    averagePoints: number;
    gameweeksAnalyzed: number;
    currentTotal: number;
    scoreRange: number;
  }

  const managerStats: ConsistencyStats[] = [];

  for (const m of successfulManagers) {
    if (m.historyCurrent.length >= 3) {
      const pts = m.historyCurrent.map((h) => h.points);
      const count = pts.length;
      const sum = pts.reduce((a, b) => a + b, 0);
      const mean = sum / count;
      const variance = pts.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / count;
      const stdDev = Math.sqrt(variance);
      const scoreRange = Math.max(...pts) - Math.min(...pts);

      managerStats.push({
        entryId: m.entryId,
        managerName: m.playerName,
        stdDev,
        averagePoints: mean,
        gameweeksAnalyzed: count,
        currentTotal: m.currentTotal,
        scoreRange,
      });
    }
  }

  if (managerStats.length > 0) {
    // Most Consistent:
    // 1. Lowest stdDev
    // 2. Higher averagePoints
    // 3. Higher current total points
    // 4. Manager name alphabetical
    // 5. Entry ID ascending
    const sortedConsistent = [...managerStats].sort((a, b) => {
      if (a.stdDev !== b.stdDev) return a.stdDev - b.stdDev;
      if (b.averagePoints !== a.averagePoints) return b.averagePoints - a.averagePoints;
      if (b.currentTotal !== a.currentTotal) return b.currentTotal - a.currentTotal;
      const nC = a.managerName.localeCompare(b.managerName);
      if (nC !== 0) return nC;
      return a.entryId - b.entryId;
    });

    const bestC = sortedConsistent[0];
    mostConsistentManager = {
      entryId: bestC.entryId,
      managerName: bestC.managerName,
      standardDeviation: Math.round((bestC.stdDev + Number.EPSILON) * 10) / 10,
      averagePoints: Math.round((bestC.averagePoints + Number.EPSILON) * 10) / 10,
      gameweeksAnalyzed: bestC.gameweeksAnalyzed,
    };

    // Most Volatile:
    // 1. Highest stdDev
    // 2. Higher score range
    // 3. Higher averagePoints
    // 4. Manager name alphabetical
    // 5. Entry ID ascending
    const sortedVolatile = [...managerStats].sort((a, b) => {
      if (b.stdDev !== a.stdDev) return b.stdDev - a.stdDev;
      if (b.scoreRange !== a.scoreRange) return b.scoreRange - a.scoreRange;
      if (b.averagePoints !== a.averagePoints) return b.averagePoints - a.averagePoints;
      const nC = a.managerName.localeCompare(b.managerName);
      if (nC !== 0) return nC;
      return a.entryId - b.entryId;
    });

    const bestV = sortedVolatile[0];
    mostVolatileManager = {
      entryId: bestV.entryId,
      managerName: bestV.managerName,
      standardDeviation: Math.round((bestV.stdDev + Number.EPSILON) * 10) / 10,
      averagePoints: Math.round((bestV.averagePoints + Number.EPSILON) * 10) / 10,
      gameweeksAnalyzed: bestV.gameweeksAnalyzed,
    };
  }

  // 10. H. League Competitiveness (Top 1 vs Top 5 Average Points Gap)
  let competitiveness: LeagueCompetitiveness | null = null;
  if (successfulManagers.length > 1) {
    const sortedByTotal = [...successfulManagers].sort((a, b) => b.currentTotal - a.currentTotal);
    const leaderPoints = sortedByTotal[0].currentTotal;

    const topCount = Math.min(5, sortedByTotal.length);
    const topGroup = sortedByTotal.slice(0, topCount);
    const topAvg = topGroup.reduce((s, m) => s + m.currentTotal, 0) / topGroup.length;
    const gap = Math.round((leaderPoints - topAvg + Number.EPSILON) * 10) / 10;

    competitiveness = {
      metric: 'TOP_5_AVERAGE_GAP',
      value: gap,
      label: `Leader is ${gap} points above the Top 5 average`,
    };
  }

  // 11. I. Narrative
  const narrative = buildDeterministicNarrative({
    completedGWsCount: completedGameweeksCount,
    bestGW: bestGameweek,
    worstGW: worstGameweek,
    bestWeekly: bestWeeklyPerformance,
    biggestGain: biggestRankGain,
    mostConsistent: mostConsistentManager,
    mostVolatile: mostVolatileManager,
    competitiveness,
  });

  return {
    ok: true,
    leagueId,
    leagueName,
    checkedAt: new Date().toISOString(),
    performanceInsights: {
      bestGameweek,
      worstGameweek,
      bestWeeklyPerformance,
      biggestRankGain,
      mostConsistentManager,
      mostVolatileManager,
      competitiveness,
      scoreTrend,
      narrative,
      summary: {
        completedGameweeks: completedGameweeksCount,
        managersAnalyzed: successfulManagers.length,
        failedManagers: failedManagersCount,
      },
    },
  };
}

export async function GET() {
  const now = Date.now();

  // 1. Check in-memory cache
  const cached = insightsCache.get(LEAGUE_ID);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data, {
      headers: {
        'Cache-Control': 's-maxage=120, stale-while-revalidate=300',
        'X-Cache': 'HIT',
      },
    });
  }

  // 2. In-flight request deduplication
  let pending = inFlightInsights.get(LEAGUE_ID);
  if (!pending) {
    pending = computeLeagueInsights(LEAGUE_ID)
      .then((data) => {
        // Cache valid completed response
        insightsCache.set(LEAGUE_ID, {
          data,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        return data;
      })
      .catch((err) => {
        // Do NOT permanently cache failures
        throw err;
      })
      .finally(() => {
        inFlightInsights.delete(LEAGUE_ID);
      });

    inFlightInsights.set(LEAGUE_ID, pending);
  }

  try {
    const result = await pending;
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 's-maxage=120, stale-while-revalidate=300',
        'X-Cache': 'MISS',
      },
    });
  } catch (error: any) {
    // Safe public error handling without leaking stack traces or internal URLs
    return NextResponse.json(
      {
        ok: false,
        error: 'Gagal memuat League Performance Insights. Silakan coba sesaat lagi.',
        leagueId: LEAGUE_ID,
      },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
