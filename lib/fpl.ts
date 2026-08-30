export const LEAGUE_ID = 134820;
export const FPL_LEAGUE_URL = `https://fantasy.premierleague.com/en/leagues/${LEAGUE_ID}/standings/c`;
const BASE = 'https://fantasy.premierleague.com/api';

// Header browser yang aman untuk bypass Cloudflare WAF dari server/cloud hosting
const headers: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

export type Standing = {
  id?: number;
  entry: number;
  entry_name: string;
  player_name?: string;
  rank: number;
  last_rank: number;
  rank_sort: number;
  total: number;
  event_total: number;
};

export type LeagueResponse = {
  league?: {
    id: number;
    name: string;
    created: string;
    closed: boolean;
    max_entries: number | null;
    league_type: string;
    scoring: string;
    start_event: number;
    code_privacy: string;
    admin_entry: number | null;
  };
  standings: { has_next: boolean; page: number; results: Standing[] };
  new_entries?: unknown;
};

async function fplFetch<T>(path: string, revalidate = 60, noCache = false): Promise<T> {
  let lastError: unknown = null;
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const fetchOpts: RequestInit = { headers };
      if (noCache) {
        fetchOpts.cache = 'no-store';
      } else {
        fetchOpts.next = { revalidate };
      }
      const r = await fetch(`${BASE}${path}`, fetchOpts);

      if (!r.ok) {
        throw new Error(`FPL API ${r.status}`);
      }
      
      return (await r.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  }
  
  throw lastError instanceof Error ? lastError : new Error('FPL API unavailable');
}

export function getLeague(page = 1): Promise<LeagueResponse> {
  return fplFetch<LeagueResponse>(
    `/leagues-classic/${LEAGUE_ID}/standings/?page_standings=${Math.max(1, page)}&phase=1`,
    60
  );
}

export function getBootstrap() {
  return fplFetch<any>('/bootstrap-static/', 60, true);
}

export function getEntry(id: number) {
  return fplFetch<any>(`/entry/${id}/`, 60);
}

export function getEntryHistory(id: number) {
  return fplFetch<any>(`/entry/${id}/history/`, 60);
}

export async function getAllLeagueStandings() {
  const first = await getLeague(1);
  const allStandings: Standing[] = [...(first.standings?.results ?? [])];
  
  let page = 1;
  let hasNext = first.standings?.has_next;

  while (hasNext && page < 20) {
    page++;
    try {
      const nextLeague = await getLeague(page);
      if (nextLeague.standings?.results) {
        allStandings.push(...nextLeague.standings.results);
      }
      hasNext = nextLeague.standings?.has_next;
    } catch {
      break;
    }
  }

  // Deduplicate based on entry ID
  const uniqueStandings = Array.from(
    new Map(allStandings.map((standing) => [standing.entry, standing])).values()
  );
  
  return { standings: uniqueStandings };
}

export function getRankMovement(
  currentGameweek: number,
  lastRank: number | null,
  rank: number
): number | null {
  if (currentGameweek <= 1 || lastRank == null) return null;
  return lastRank - rank;
}

export function getEntryPicks(id: number, event: number) {
  return fplFetch<any>(`/entry/${id}/event/${event}/picks/`, 60);
}

export function getLiveEvent(event: number) {
  return fplFetch<any>(`/event/${event}/live/`, 60);
}

export function getFixtures(event?: number) {
  const path = event ? `/fixtures/?event=${event}` : '/fixtures/';
  return fplFetch<any[]>(path, 60);
}
