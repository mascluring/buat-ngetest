export interface PointBreakdownRow {
  key: string;
  label: string;
  value: number;
  points: number;
}

export interface PlayerBreakdownResult {
  rows: PointBreakdownRow[];
  fullBreakdown: PointBreakdownRow[];
  visibleBreakdown: PointBreakdownRow[];
  officialRaw: number;
  calculatedRaw: number;
  totalPoints: number;
  source: 'official' | 'fallback';
}

/**
 * Pure function to calculate or extract player point breakdown.
 * Prioritizes official FPL live `explain` array when available,
 * falling back to official FPL scoring rules when explain is absent.
 */
export function getPlayerBreakdownRows(player: any): PlayerBreakdownResult {
  if (!player) {
    return {
      rows: [],
      fullBreakdown: [],
      visibleBreakdown: [],
      officialRaw: 0,
      calculatedRaw: 0,
      totalPoints: 0,
      source: 'fallback',
    };
  }

  const b = player.breakdown || {};
  const minutes = b.minutes ?? player.minutes ?? 0;
  const goalsScored = b.goalsScored ?? player.goals_scored ?? 0;
  const assists = b.assists ?? player.assists ?? 0;
  const cleanSheets = b.cleanSheets ?? player.clean_sheets ?? 0;
  const goalsConceded = b.goalsConceded ?? player.goals_conceded ?? 0;
  const ownGoals = b.ownGoals ?? player.own_goals ?? 0;
  const penaltiesSaved = b.penaltiesSaved ?? player.penalties_saved ?? 0;
  const penaltiesMissed = b.penaltiesMissed ?? player.penalties_missed ?? 0;
  const yellowCards = b.yellowCards ?? player.yellow_cards ?? 0;
  const redCards = b.redCards ?? player.red_cards ?? 0;
  const saves = b.saves ?? player.saves ?? 0;
  const bonus = b.bonus ?? player.bonus ?? 0;
  const dcValue = b.defensiveContributionValue ?? b.defensiveContribution ?? player.defensive_contribution ?? 0;
  const dcPoints = b.defensiveContributionPoints ?? player.defensive_contribution_points ?? 0;

  const elementType = player.elementType || 1; // 1: GKP, 2: DEF, 3: MID, 4: FWD
  const isGkpOrDef = elementType === 1 || elementType === 2;
  const isMid = elementType === 3;

  const multiplier = player.multiplier || 1;
  const officialRaw = player.rawPoints ?? b.totalPoints ?? player.total_points ?? 0;

  // 1. If explain exists from FPL live API, map fixtures to exact official breakdown (covers DGW seamlessly)
  const explain = player.explain || [];
  if (Array.isArray(explain) && explain.length > 0) {
    const explainStatMap = new Map<string, { value: number; points: number }>();
    explain.forEach((fixture: any) => {
      (fixture.stats || []).forEach((s: any) => {
        const id = s.identifier;
        const current = explainStatMap.get(id) || { value: 0, points: 0 };
        explainStatMap.set(id, {
          value: current.value + (s.value ?? 0),
          points: current.points + (s.points ?? 0),
        });
      });
    });

    const rows: PointBreakdownRow[] = [];

    // 1. Minutes (always show in full breakdown)
    const minStat = explainStatMap.get('minutes') || {
      value: minutes,
      points: minutes >= 60 ? 2 : minutes > 0 ? 1 : 0,
    };
    rows.push({
      key: 'minutes',
      label: 'Minutes played',
      value: minStat.value,
      points: minStat.points,
    });

    // 2. Goals scored
    const goalStat = explainStatMap.get('goals_scored');
    if (goalStat && (goalStat.value > 0 || goalStat.points !== 0)) {
      rows.push({
        key: 'goals_scored',
        label: 'Goals scored',
        value: goalStat.value,
        points: goalStat.points,
      });
    }

    // 3. Assists
    const assistStat = explainStatMap.get('assists');
    if (assistStat && (assistStat.value > 0 || assistStat.points !== 0)) {
      rows.push({
        key: 'assists',
        label: 'Assists',
        value: assistStat.value,
        points: assistStat.points,
      });
    }

    // 4. Clean Sheet
    const csStat = explainStatMap.get('clean_sheets');
    if (csStat && (csStat.value > 0 || csStat.points !== 0)) {
      rows.push({
        key: 'clean_sheets',
        label: 'Clean Sheet',
        value: csStat.value,
        points: csStat.points,
      });
    }

    // 5. Defensive Contribution
    const dcStat = explainStatMap.get('defensive_contribution');
    if (dcStat && (dcStat.value > 0 || dcStat.points !== 0)) {
      rows.push({
        key: 'defensive_contribution',
        label: 'Defensive Contribution',
        value: dcStat.value,
        points: dcStat.points,
      });
    } else if (dcValue > 0 && dcPoints > 0) {
      rows.push({
        key: 'defensive_contribution',
        label: 'Defensive Contribution',
        value: dcValue,
        points: dcPoints,
      });
    }

    // 6. Goals Conceded
    const gcStat = explainStatMap.get('goals_conceded');
    if (gcStat && (gcStat.value > 0 || gcStat.points !== 0)) {
      rows.push({
        key: 'goals_conceded',
        label: 'Goals Conceded',
        value: gcStat.value,
        points: gcStat.points,
      });
    }

    // 7. Saves
    const saveStat = explainStatMap.get('saves');
    if (saveStat && (saveStat.value > 0 || saveStat.points !== 0)) {
      rows.push({
        key: 'saves',
        label: 'Saves',
        value: saveStat.value,
        points: saveStat.points,
      });
    }

    // 8. Penalties Saved
    const psStat = explainStatMap.get('penalties_saved');
    if (psStat && (psStat.value > 0 || psStat.points !== 0)) {
      rows.push({
        key: 'penalties_saved',
        label: 'Penalties Saved',
        value: psStat.value,
        points: psStat.points,
      });
    }

    // 9. Penalties Missed
    const pmStat = explainStatMap.get('penalties_missed');
    if (pmStat && (pmStat.value > 0 || pmStat.points !== 0)) {
      rows.push({
        key: 'penalties_missed',
        label: 'Penalties Missed',
        value: pmStat.value,
        points: pmStat.points,
      });
    }

    // 10. Own Goals
    const ogStat = explainStatMap.get('own_goals');
    if (ogStat && (ogStat.value > 0 || ogStat.points !== 0)) {
      rows.push({
        key: 'own_goals',
        label: 'Own Goals',
        value: ogStat.value,
        points: ogStat.points,
      });
    }

    // 11. Yellow Cards
    const ycStat = explainStatMap.get('yellow_cards');
    if (ycStat && (ycStat.value > 0 || ycStat.points !== 0)) {
      rows.push({
        key: 'yellow_cards',
        label: 'Yellow Card',
        value: ycStat.value,
        points: ycStat.points,
      });
    }

    // 12. Red Cards
    const rcStat = explainStatMap.get('red_cards');
    if (rcStat && (rcStat.value > 0 || rcStat.points !== 0)) {
      rows.push({
        key: 'red_cards',
        label: 'Red Card',
        value: rcStat.value,
        points: rcStat.points,
      });
    }

    // 13. Bonus
    const bonusStat = explainStatMap.get('bonus');
    if (bonusStat && (bonusStat.value > 0 || bonusStat.points !== 0)) {
      rows.push({
        key: 'bonus',
        label: 'Bonus',
        value: bonusStat.value,
        points: bonusStat.points,
      });
    }

    // Catch any additional FPL official identifiers without discarding points
    const standardKeys = new Set([
      'minutes', 'goals_scored', 'assists', 'clean_sheets',
      'defensive_contribution', 'goals_conceded', 'saves',
      'penalties_saved', 'penalties_missed', 'own_goals',
      'yellow_cards', 'red_cards', 'bonus'
    ]);
    explainStatMap.forEach((stat, identifier) => {
      if (!standardKeys.has(identifier) && (stat.points !== 0 || stat.value !== 0)) {
        const formattedLabel = identifier
          .split('_')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        rows.push({
          key: identifier,
          label: formattedLabel,
          value: stat.value,
          points: stat.points,
        });
      }
    });

    const calculatedRaw = rows.reduce((sum, r) => sum + r.points, 0);
    const visibleBreakdown = rows.filter((item) => Number(item.points ?? 0) !== 0);

    return {
      rows,
      fullBreakdown: rows,
      visibleBreakdown,
      officialRaw,
      calculatedRaw,
      totalPoints: officialRaw * multiplier,
      source: 'official',
    };
  }

  // 2. Fallback direct rule calculation
  const rows: PointBreakdownRow[] = [];

  // Minutes (always)
  const minPts = minutes >= 60 ? 2 : minutes > 0 ? 1 : 0;
  rows.push({
    key: 'minutes',
    label: 'Minutes played',
    value: minutes,
    points: minPts,
  });

  // Goals (GK=10 or 6, DEF=6, MID=5, FWD=4)
  if (goalsScored > 0) {
    const goalPts = goalsScored * (elementType === 1 ? 10 : elementType === 2 ? 6 : isMid ? 5 : 4);
    rows.push({
      key: 'goals_scored',
      label: 'Goals scored',
      value: goalsScored,
      points: goalPts,
    });
  }

  // Assists
  if (assists > 0) {
    rows.push({
      key: 'assists',
      label: 'Assists',
      value: assists,
      points: assists * 3,
    });
  }

  // Clean Sheet
  if (cleanSheets > 0 && minutes >= 60 && (isGkpOrDef || isMid)) {
    const csPts = isGkpOrDef ? cleanSheets * 4 : cleanSheets * 1;
    rows.push({
      key: 'clean_sheets',
      label: 'Clean Sheet',
      value: cleanSheets,
      points: csPts,
    });
  }

  // Defensive Contribution
  if (dcValue > 0 && dcPoints > 0) {
    rows.push({
      key: 'defensive_contribution',
      label: 'Defensive Contribution',
      value: dcValue,
      points: dcPoints,
    });
  }

  // Goals Conceded
  if (isGkpOrDef && goalsConceded >= 2 && minutes > 0) {
    const gcPts = -Math.floor(goalsConceded / 2);
    rows.push({
      key: 'goals_conceded',
      label: 'Goals Conceded',
      value: goalsConceded,
      points: gcPts,
    });
  }

  // Saves
  if (elementType === 1 && saves >= 3) {
    const savePts = Math.floor(saves / 3);
    rows.push({
      key: 'saves',
      label: 'Saves',
      value: saves,
      points: savePts,
    });
  }

  // Penalties Saved
  if (penaltiesSaved > 0) {
    rows.push({
      key: 'penalties_saved',
      label: 'Penalties Saved',
      value: penaltiesSaved,
      points: penaltiesSaved * 5,
    });
  }

  // Penalties Missed
  if (penaltiesMissed > 0) {
    rows.push({
      key: 'penalties_missed',
      label: 'Penalties Missed',
      value: penaltiesMissed,
      points: penaltiesMissed * -2,
    });
  }

  // Own Goals
  if (ownGoals > 0) {
    rows.push({
      key: 'own_goals',
      label: 'Own Goals',
      value: ownGoals,
      points: ownGoals * -2,
    });
  }

  // Yellow Cards
  if (yellowCards > 0) {
    rows.push({
      key: 'yellow_cards',
      label: 'Yellow Card',
      value: yellowCards,
      points: yellowCards * -1,
    });
  }

  // Red Cards
  if (redCards > 0) {
    rows.push({
      key: 'red_cards',
      label: 'Red Card',
      value: redCards,
      points: redCards * -3,
    });
  }

  // Bonus
  if (bonus > 0) {
    rows.push({
      key: 'bonus',
      label: 'Bonus',
      value: bonus,
      points: bonus,
    });
  }

  const calculatedRaw = rows.reduce((sum, r) => sum + r.points, 0);
  const visibleBreakdown = rows.filter((item) => Number(item.points ?? 0) !== 0);

  return {
    rows,
    fullBreakdown: rows,
    visibleBreakdown,
    officialRaw,
    calculatedRaw,
    totalPoints: officialRaw * multiplier,
    source: 'fallback',
  };
}
