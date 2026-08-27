const FPL_BASE = 'https://fantasy.premierleague.com/api';

export async function fetchFPL(endpoint: string, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${FPL_BASE}${endpoint}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        next: { revalidate: 60 },
      });
      if (res.status === 403) {
        throw new Error('403 Forbidden / Rate-limit');
      }
      if (!res.ok) throw new Error(`FPL API Status ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
}

export async function getBootstrap() {
  return fetchFPL('/bootstrap-static/');
}

export async function getLeagueStandings(leagueId: number, page = 1) {
  return fetchFPL(`/leagues-classic/${leagueId}/standings/?page_standings=${page}`);
}

export async function getEntryPicks(entryId: number, gw: number) {
  return fetchFPL(`/entry/${entryId}/event/${gw}/picks/`);
}

export async function getLiveEvent(gw: number) {
  return fetchFPL(`/event/${gw}/live/`);
}

export async function getEntry(entryId: number) {
  return fetchFPL(`/entry/${entryId}/`);
}

export async function getEntryHistory(entryId: number) {
  return fetchFPL(`/entry/${entryId}/history/`);
}
