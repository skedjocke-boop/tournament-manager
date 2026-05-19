'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { saveMatch, generateRegularSeasonSchedule, initiatePlayoffs, triggerAwardCeremony, startNextSeason, updateTeamIdentity } from '@/app/actions'

type TeamStats = { played: number; wins: number; otWins: number; losses: number; otLosses: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number; cleanSheets: number; form: string[]; }
type Team = { id: string; name: string; division: string; currentElo: number; peakElo: number; logoPath?: string | null; primaryColor: string; secondaryColor?: string | null; tertiaryColor?: string | null; isActive: boolean; stats: TeamStats; trophies?: any[]; homeMatches?: any[]; awayMatches?: any[]; }

// UPPDATERAD HIERARKI
const TROPHY_ORDER = [
    'THE TRI-FECTA', 
    'Champions League Vinnare', 
    'Världsmästare', 
    'Vinnare Elitserien', 
    'Vinnare Superettan', 
    'Sämst'
];

export default function DashboardClient({ initialTeams, initialMatches, activeSeason }: { initialTeams: any[], initialMatches: any[], activeSeason: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const defaultTab = searchParams.get('tab') || 'spelschema';
  const defaultSub = searchParams.get('sub') || '';

  const [activeMainTab, setActiveMainTabState] = useState(defaultTab);
  const [activeSubTab, setActiveSubTabState] = useState(defaultSub);
  const [loading, setLoading] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  useEffect(() => {
      if (!searchParams.get('sub')) {
          if (activeMainTab === 'elitserien' || activeMainTab === 'superettan') setActiveSubTabState('tabell');
          else if (activeMainTab === 'champions_league') setActiveSubTabState('bracket');
          else if (activeMainTab === 'lagen_hof') setActiveSubTabState('elo');
          else if (activeMainTab === 'admin') setActiveSubTabState(activeSeason?.phase === 'OFF_SEASON' ? 'awards' : 'ceremonies');
          else setActiveSubTabState('');
      }
  }, [activeMainTab, searchParams, activeSeason?.phase]);

  const setTab = (main: string, sub: string = '') => {
      setActiveMainTabState(main);
      setActiveSubTabState(sub);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', main);
      if (sub) params.set('sub', sub); else params.delete('sub');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
      if (activeSeason?.phase === 'OFF_SEASON' && activeMainTab !== 'admin') {
          setTab('admin', 'awards');
      }
  }, [activeSeason?.phase]);

  const phaseTranslations: Record<string, string> = { 'PRE_SEASON': 'Försäsong', 'REGULAR_SEASON': 'Grundserie', 'PLAYOFFS': 'Slutspel', 'OFF_SEASON': 'Semester / Prisutdelning' };
  const displayPhase = activeSeason ? (phaseTranslations[activeSeason.phase] || activeSeason.phase) : 'Laddar...';
  
  const sortTeams = (teams: Team[]) => teams.sort((a, b) => {
    if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
    if (b.stats.goalDifference !== a.stats.goalDifference) return b.stats.goalDifference - a.stats.goalDifference;
    if (b.stats.goalsFor !== a.stats.goalsFor) return b.stats.goalsFor - a.stats.goalsFor;
    return b.currentElo - a.currentElo;
  });

  const elitserien = sortTeams(initialTeams.filter(t => t.division === 'ELITSERIEN' && t.name !== 'TBD'));
  const superettan = sortTeams(initialTeams.filter(t => t.division === 'SUPERETTAN' && t.name !== 'TBD'));
  const globalEloTeams = [...initialTeams].filter(t => t.name !== 'TBD').sort((a, b) => b.currentElo - a.currentElo);
  const allTrophies = initialTeams.flatMap(t => t.trophies || []).sort((a, b) => new Date(b.dateAwarded).getTime() - new Date(a.dateAwarded).getTime());

  const getTeamRank = (teamId: string, division: string) => {
    const table = division === 'ELITSERIEN' ? elitserien : superettan;
    const index = table.findIndex(t => t.id === teamId);
    return index !== -1 ? index + 1 : '-';
  }

  const activeMatches = initialMatches.filter(m => m.status !== 'CANCELLED');
  const regularMatches = activeMatches.filter(m => m.matchType === 'REGULAR');
  const playoffMatches = activeMatches.filter(m => m.matchType === 'PLAYOFF');
  const clMatches = activeMatches.filter(m => m.matchType === 'CL');
  const qualifierMatches = activeMatches.filter(m => m.matchType === 'QUALIFIER');
  const bottomMatches = activeMatches.filter(m => m.matchType === 'BOTTOM_BATTLE');

  const tbdTeamId = initialTeams.find(t => t.name === 'TBD')?.id;

  const masterTimeline = [
      { id: 1, title: 'Omgång 1 (Premiär)', items: [{ type: 'REGULAR', div: 'SUPERETTAN', round: 1 }] },
      { id: 2, title: 'Omgång 2', items: [{ type: 'REGULAR', div: 'SUPERETTAN', round: 2 }] },
      { id: 3, title: 'Omgång 3', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 1 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 3 }] },
      { id: 4, title: 'Champions League (16-delsfinal - Match 1)', items: [{ type: 'CL', playoffRound: 'RO32', leg: 1 }] },
      { id: 5, title: 'Omgång 5', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 2 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 4 }] },
      { id: 6, title: 'Omgång 6', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 3 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 5 }] },
      { id: 7, title: 'Omgång 7', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 4 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 6 }] },
      { id: 8, title: 'Champions League (16-delsfinal - Match 2)', items: [{ type: 'CL', playoffRound: 'RO32', leg: 2 }] },
      { id: 9, title: 'Omgång 9', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 5 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 7 }] },
      { id: 10, title: 'Omgång 10', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 6 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 8 }] },
      { id: 11, title: 'Omgång 11', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 7 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 9 }] },
      { id: 12, title: 'Omgång 12', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 8 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 10 }] },
      { id: 13, title: 'Omgång 13', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 9 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 11 }] },
      { id: 14, title: 'Champions League (8-delsfinal - Match 1)', items: [{ type: 'CL', playoffRound: 'RO16', leg: 1 }] },
      { id: 15, title: 'Omgång 15', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 10 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 12 }] },
      { id: 16, title: 'Omgång 16', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 11 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 13 }] },
      { id: 17, title: 'Omgång 17', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 12 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 14 }] },
      { id: 18, title: 'Champions League (8-delsfinal - Match 2)', items: [{ type: 'CL', playoffRound: 'RO16', leg: 2 }] },
      { id: 19, title: 'Omgång 19', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 13 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 15 }] },
      { id: 20, title: 'Omgång 20', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 14 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 16 }] },
      { id: 21, title: 'Omgång 21', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 15 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 17 }] },
      { id: 22, title: 'Omgång 22', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 16 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 18 }] },
      { id: 23, title: 'Omgång 23', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 17 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 19 }] },
      { id: 24, title: 'Champions League (Kvartsfinal - Match 1)', items: [{ type: 'CL', playoffRound: 'QF', leg: 1 }] },
      { id: 25, title: 'Omgång 25', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 18 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 20 }] },
      { id: 26, title: 'Omgång 26', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 19 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 21 }] },
      { id: 27, title: 'Omgång 27', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 20 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 22 }] },
      { id: 28, title: 'Omgång 28', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 21 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 23 }] },
      { id: 29, title: 'Omgång 29', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 22 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 24 }] },
      { id: 30, title: 'Champions League (Kvartsfinal - Match 2)', items: [{ type: 'CL', playoffRound: 'QF', leg: 2 }] },
      { id: 31, title: 'Omgång 31', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 23 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 25 }] },
      { id: 32, title: 'Omgång 32', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 24 }, { type: 'REGULAR', div: 'SUPERETTAN', round: 26 }] }, 
      { id: 33, title: 'Omgång 33', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 25 }] },
      { id: 34, title: 'Omgång 34 (Grundserien Slut)', items: [{ type: 'REGULAR', div: 'ELITSERIEN', round: 26 }] }, 

      { id: 35, title: 'Slutspel & Kval (Match 1:5)', items: [{ type: 'PLAYOFF', playoffRound: 'QF', leg: 1 }, { type: 'QUALIFIER', leg: 1 }, { type: 'BOTTOM_BATTLE', leg: 1 }] },
      { id: 36, title: 'Slutspel & Kval (Match 2:5)', items: [{ type: 'PLAYOFF', playoffRound: 'QF', leg: 2 }, { type: 'QUALIFIER', leg: 2 }, { type: 'BOTTOM_BATTLE', leg: 2 }] },
      { id: 37, title: 'Slutspel & Kval (Match 3:5) + CL SF 1', items: [{ type: 'PLAYOFF', playoffRound: 'QF', leg: 3 }, { type: 'QUALIFIER', leg: 3 }, { type: 'BOTTOM_BATTLE', leg: 3 }, { type: 'CL', playoffRound: 'SF', leg: 1 }] },
      { id: 38, title: 'Slutspel & Kval (Match 4:5)', items: [{ type: 'PLAYOFF', playoffRound: 'QF', leg: 4 }, { type: 'QUALIFIER', leg: 4 }, { type: 'BOTTOM_BATTLE', leg: 4 }] },
      { id: 39, title: 'Slutspel & Kval (Match 5:5)', items: [{ type: 'PLAYOFF', playoffRound: 'QF', leg: 5 }, { type: 'QUALIFIER', leg: 5 }, { type: 'BOTTOM_BATTLE', leg: 5 }] },

      { id: 40, title: 'Semifinaler (Match 1:5)', items: [{ type: 'PLAYOFF', playoffRound: 'SF', leg: 1 }] },
      { id: 41, title: 'Semifinaler (Match 2:5) + CL SF 2', items: [{ type: 'PLAYOFF', playoffRound: 'SF', leg: 2 }, { type: 'CL', playoffRound: 'SF', leg: 2 }] },
      { id: 42, title: 'Semifinaler (Match 3:5)', items: [{ type: 'PLAYOFF', playoffRound: 'SF', leg: 3 }] },
      { id: 43, title: 'Semifinaler (Match 4:5)', items: [{ type: 'PLAYOFF', playoffRound: 'SF', leg: 4 }] },
      { id: 44, title: 'Semifinaler (Match 5:5)', items: [{ type: 'PLAYOFF', playoffRound: 'SF', leg: 5 }] },

      { id: 45, title: 'Finaler (Match 1:5)', items: [{ type: 'PLAYOFF', playoffRound: 'FINAL', leg: 1 }, { type: 'CL', playoffRound: 'FINAL', leg: 1 }] },
      { id: 46, title: 'Finaler (Match 2:5)', items: [{ type: 'PLAYOFF', playoffRound: 'FINAL', leg: 2 }, { type: 'CL', playoffRound: 'FINAL', leg: 2 }] },
      { id: 47, title: 'Finaler (Match 3:5)', items: [{ type: 'PLAYOFF', playoffRound: 'FINAL', leg: 3 }, { type: 'CL', playoffRound: 'FINAL', leg: 3 }] },
      { id: 48, title: 'Finaler (Match 4:5)', items: [{ type: 'PLAYOFF', playoffRound: 'FINAL', leg: 4 }, { type: 'CL', playoffRound: 'FINAL', leg: 4 }] },
      { id: 49, title: 'Finaler (Match 5:5)', items: [{ type: 'PLAYOFF', playoffRound: 'FINAL', leg: 5 }, { type: 'CL', playoffRound: 'FINAL', leg: 5 }] },
  ];

  let matchesToShow: any[] = [];
  let activeTimelineHeader = 'Spelschema';

  const getMatchesForMasterItem = (item: any) => {
      return activeMatches.filter(m => {
          if (m.status !== 'SCHEDULED') return false;
          if (m.homeTeamId === tbdTeamId || m.awayTeamId === tbdTeamId) return false;
          if (m.matchType !== item.type) return false;

          if (item.type === 'REGULAR') {
              const homeDiv = initialTeams.find(t => t.id === m.homeTeamId)?.division;
              return homeDiv === item.div && m.round === item.round;
          } else if (item.type === 'CL' || item.type === 'PLAYOFF') {
              return m.playoffRound === item.playoffRound && m.gameNumber === item.leg;
          } else {
              return m.gameNumber === item.leg;
          }
      });
  };

  const currentValidTimeline = activeSeason?.phase === 'REGULAR_SEASON' ? masterTimeline.filter(t => t.id <= 34) : masterTimeline.filter(t => t.id >= 35);

  if (activeSeason?.phase === 'REGULAR_SEASON' || activeSeason?.phase === 'PLAYOFFS') {
      for (const step of currentValidTimeline) {
          const stepMatches = [];
          let hasUnplayedMatchesInStep = false;
          
          for (const item of step.items) {
              const itemMatches = getMatchesForMasterItem(item);
              if (itemMatches.length > 0) {
                  hasUnplayedMatchesInStep = true;
                  stepMatches.push(...itemMatches);
              }
          }
          if (hasUnplayedMatchesInStep) {
              matchesToShow = stepMatches;
              activeTimelineHeader = step.title;
              break; 
          }
      }
  }

  const isRegularSeasonDone = regularMatches.length > 0 && 
                              regularMatches.every(m => m.status === 'COMPLETED') &&
                              clMatches.filter(m => ['RO32', 'RO16', 'QF'].includes(m.playoffRound!)).every(m => m.status === 'COMPLETED' || m.status === 'CANCELLED');
  
  const isPlayoffsDone = playoffMatches.length > 0 && 
                         playoffMatches.every(m => m.status === 'COMPLETED' || m.status === 'CANCELLED') && 
                         qualifierMatches.every(m => m.status === 'COMPLETED' || m.status === 'CANCELLED') &&
                         bottomMatches.every(m => m.status === 'COMPLETED' || m.status === 'CANCELLED') &&
                         clMatches.every(m => m.status === 'COMPLETED' || m.status === 'CANCELLED');

  const recordsObj = useMemo(() => {
      const calcFor = (division: string | null, isCl: boolean, isCurrent: boolean) => {
          let theMarathon = { score: 0, match: null as any };
          let theBlowout = { margin: 0, match: null as any };
          let offensiveJuggernaut = { avg: 0, team: null as any }; 
          
          let maxSeasonPoints = { value: 0, team: null as any, season: null as any };
          let maxSeasonGoals = { value: 0, team: null as any, season: null as any };
          let maxSeasonWins = { value: 0, team: null as any, season: null as any };
          let maxSeasonCleanSheets = { value: 0, team: null as any, season: null as any };

          const seasonStats = new Map<string, any>();
          
          initialTeams.forEach(team => {
              if (division && team.division !== division) return;

              let teamMatches = [
                  ...(team.homeMatches || []).map((m:any) => ({...m, isHome: true, opp: m.awayTeam})),
                  ...(team.awayMatches || []).map((m:any) => ({...m, isHome: false, opp: m.homeTeam}))
              ].filter(m => m.status === 'COMPLETED' && m.opp?.name !== 'TBD');

              if (isCl) teamMatches = teamMatches.filter(m => m.matchType === 'CL');
              else if (division) teamMatches = teamMatches.filter(m => m.matchType === 'REGULAR'); 

              if (isCurrent) teamMatches = teamMatches.filter(m => m.seasonId === activeSeason?.id);
              
              teamMatches.sort((a,b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

              let totalGoalsForTeam = 0;

              teamMatches.forEach(m => {
                  const isWin = m.isHome ? m.homePoints > m.awayPoints : m.awayPoints > m.homePoints;
                  const ptsScored = m.isHome ? m.homePoints : m.awayPoints;
                  const oppPts = m.isHome ? m.awayPoints : m.homePoints;

                  totalGoalsForTeam += ptsScored;

                  if (ptsScored + oppPts > theMarathon.score) {
                      theMarathon = { score: ptsScored + oppPts, match: { ...m, teamA: team, teamB: m.opp, isHomeTeamA: m.isHome } };
                  }
                  const margin = Math.abs(ptsScored - oppPts);
                  if (margin > theBlowout.margin) {
                      theBlowout = { margin, match: { ...m, teamA: team, teamB: m.opp, isHomeTeamA: m.isHome } };
                  }

                  if (m.matchType === 'REGULAR') {
                      const statKey = `${m.seasonId}_${team.id}`;
                      if (!seasonStats.has(statKey)) seasonStats.set(statKey, { team, season: m.season, points: 0, goalsFor: 0, wins: 0, cleanSheets: 0 });
                      const stats = seasonStats.get(statKey);
                      
                      stats.goalsFor += ptsScored;
                      if (isWin) { stats.wins += 1; stats.points += m.isSuddenDeath ? 2 : 3; } else { stats.points += m.isSuddenDeath ? 1 : 0; }
                      if (oppPts === 0) stats.cleanSheets += 1;
                  } else if (m.matchType === 'CL') {
                      const statKey = `${m.seasonId}_${team.id}`;
                      if (!seasonStats.has(statKey)) seasonStats.set(statKey, { team, season: m.season, points: 0, goalsFor: 0, wins: 0, cleanSheets: 0 });
                      const stats = seasonStats.get(statKey);
                      stats.goalsFor += ptsScored;
                      if (isWin) stats.wins += 1;
                      if (oppPts === 0) stats.cleanSheets += 1;
                  }
              });

              if (teamMatches.length > 5) {
                  const avg = parseFloat((totalGoalsForTeam / teamMatches.length).toFixed(2));
                  if (avg > offensiveJuggernaut.avg) offensiveJuggernaut = { avg, team };
              }
          });

          seasonStats.forEach(stats => {
              if (stats.points > maxSeasonPoints.value) maxSeasonPoints = { value: stats.points, team: stats.team, season: stats.season };
              if (stats.goalsFor > maxSeasonGoals.value) maxSeasonGoals = { value: stats.goalsFor, team: stats.team, season: stats.season };
              if (stats.wins > maxSeasonWins.value) maxSeasonWins = { value: stats.wins, team: stats.team, season: stats.season };
              if (stats.cleanSheets > maxSeasonCleanSheets.value) maxSeasonCleanSheets = { value: stats.cleanSheets, team: stats.team, season: stats.season };
          });

          return { theMarathon, theBlowout, offensiveJuggernaut, maxSeasonPoints, maxSeasonGoals, maxSeasonWins, maxSeasonCleanSheets };
      };

      return {
          elit: { current: calcFor('ELITSERIEN', false, true), hist: calcFor('ELITSERIEN', false, false) },
          super: { current: calcFor('SUPERETTAN', false, true), hist: calcFor('SUPERETTAN', false, false) },
          cl: { current: calcFor(null, true, true), hist: calcFor(null, true, false) }
      }
  }, [initialMatches, initialTeams, activeSeason]);

  const seasonAwardsStats = useMemo(() => {
    if (activeSeason?.phase !== 'OFF_SEASON') return null;

    let mostAchievements = { count: 0, team: null as any };
    let most50s = { count: 0, team: null as any };
    let mostLockdowns = { count: 0, team: null as any };
    let mostNailbiters = { count: 0, team: null as any };
    let longestStreak = { count: 0, team: null as any };
    let mostGoals = { count: 0, team: null as any };
    let leastGoals = { count: 9999, team: null as any };
    let mostCleanSheets = { count: 0, team: null as any };

    initialTeams.forEach(team => {
        const sm = [
            ...(team.homeMatches || []).map((m:any) => ({...m, isHome: true, opp: m.awayTeam})),
            ...(team.awayMatches || []).map((m:any) => ({...m, isHome: false, opp: m.homeTeam}))
        ].filter(m => m.seasonId === activeSeason.id && m.status === 'COMPLETED' && m.opp?.name !== 'TBD');

        sm.sort((a,b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

        let t50s=0, tLock=0, tNail=0, tStreak=0, currStreak=0, tGoalsFor=0, tGoalsAgainst=0, tClean=0;

        sm.forEach(m => {
            const ptsScored = m.isHome ? m.homePoints : m.awayPoints;
            const oppPts = m.isHome ? m.awayPoints : m.homePoints;
            const isWin = ptsScored > oppPts;
            const margin = Math.abs(ptsScored - oppPts);

            tGoalsFor += ptsScored;
            tGoalsAgainst += oppPts;

            if (isWin) {
                currStreak++;
                if (currStreak > tStreak) tStreak = currStreak;
                if (ptsScored >= 50) t50s++;
                if (oppPts < 15 && oppPts > 0) tLock++;
                if (oppPts === 0) tClean++;
                if (margin <= 3) tNail++;
            } else {
                currStreak = 0;
            }
        });

        const tAchievements = t50s + tLock + tClean + tNail;

        if (tAchievements > mostAchievements.count) mostAchievements = { count: tAchievements, team };
        if (t50s > most50s.count) most50s = { count: t50s, team };
        if (tLock > mostLockdowns.count) mostLockdowns = { count: tLock, team };
        if (tNail > mostNailbiters.count) mostNailbiters = { count: tNail, team };
        if (tStreak > longestStreak.count) longestStreak = { count: tStreak, team };
        if (tGoalsFor > mostGoals.count) mostGoals = { count: tGoalsFor, team };
        
        if (sm.length >= 20 && tGoalsAgainst < leastGoals.count) leastGoals = { count: tGoalsAgainst, team };
        if (tClean > mostCleanSheets.count) mostCleanSheets = { count: tClean, team };
    });

    return { mostAchievements, most50s, mostLockdowns, mostNailbiters, longestStreak, mostGoals, leastGoals, mostCleanSheets };
  }, [initialTeams, activeSeason]);

  const relegationData = useMemo(() => {
      if (activeSeason?.phase !== 'OFF_SEASON') return null;
      
      const promotedDirect = superettan[0];
      const relegatedDirect = elitserien[elitserien.length - 1]; 

      const getSeriesWinner = (roundKey: string) => {
          const matches = qualifierMatches.filter(m => m.playoffRound === roundKey && m.status === 'COMPLETED');
          if(matches.length === 0) return null;
          let teamA = matches[0].homeTeamId, teamB = matches[0].awayTeamId;
          let winsA = 0, winsB = 0;
          matches.forEach(m => {
              const aWon = m.homeTeamId === teamA ? m.homePoints > m.awayPoints : m.awayPoints > m.homePoints;
              if (aWon) winsA++; else winsB++;
          });
          if(winsA >= 3) return teamA;
          if(winsB >= 3) return teamB;
          return null;
      };

      const k1WinId = getSeriesWinner('KVAL_1');
      const k2WinId = getSeriesWinner('KVAL_2');
      const k1Winner = initialTeams.find(t => t.id === k1WinId);
      const k2Winner = initialTeams.find(t => t.id === k2WinId);
      const k1LoserId = qualifierMatches.find(m => m.playoffRound === 'KVAL_1')?.homeTeamId === k1WinId ? qualifierMatches.find(m => m.playoffRound === 'KVAL_1')?.awayTeamId : qualifierMatches.find(m => m.playoffRound === 'KVAL_1')?.homeTeamId;
      const k2LoserId = qualifierMatches.find(m => m.playoffRound === 'KVAL_2')?.homeTeamId === k2WinId ? qualifierMatches.find(m => m.playoffRound === 'KVAL_2')?.awayTeamId : qualifierMatches.find(m => m.playoffRound === 'KVAL_2')?.homeTeamId;
      
      const k1Loser = initialTeams.find(t => t.id === k1LoserId && t.id !== 'TBD');
      const k2Loser = initialTeams.find(t => t.id === k2LoserId && t.id !== 'TBD');

      return { promotedDirect, relegatedDirect, k1Winner, k2Winner, k1Loser, k2Loser };
  }, [activeSeason, superettan, elitserien, qualifierMatches, initialTeams]);

  const trophiesBySeason = allTrophies.reduce((acc: any, trophy: any) => {
      const sName = trophy.season?.name || 'Okänd Säsong';
      if (!acc[sName]) acc[sName] = [];
      acc[sName].push(trophy);
      return acc;
  }, {});
  const sortedSeasonsForHof = Object.keys(trophiesBySeason).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numB - numA;
  });

  const currentSeasonTrophies = allTrophies.filter(t => t.seasonId === activeSeason?.id);
  const sortedCurrentSeasonTrophies = [...currentSeasonTrophies].sort((a,b) => {
      let idxA = TROPHY_ORDER.indexOf(a.name);
      let idxB = TROPHY_ORDER.indexOf(b.name);
      if (idxA === -1) idxA = 99; if (idxB === -1) idxB = 99;
      return idxA - idxB;
  });

  const handleSaveMatch = async (matchId: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); 
    const formData = new FormData(e.currentTarget);
    const homePoints = parseInt(formData.get('homePoints') as string, 10);
    const awayPoints = parseInt(formData.get('awayPoints') as string, 10);
    const isSuddenDeath = formData.get('isSuddenDeath') === 'on';

    if (homePoints === awayPoints) { alert("Matchen kan inte sluta oavgjort.\nKryssa i 'Sudden Death' och lägg till extrapoängen för laget som sänkte sista bollen."); return; }
    setLoading(true);
    try { await saveMatch(matchId, homePoints, awayPoints, isSuddenDeath); } catch (error: any) { alert(error.message); } finally { setLoading(false); }
  }

  const handleGenerateSchedule = async () => {
    if(!confirm("Skapa spelschema och det statiska Champions League-trädet?")) return;
    setLoading(true);
    try { await generateRegularSeasonSchedule(activeSeason.id); setTab('spelschema'); } catch (error: any) { alert(error.message); }
    setLoading(false);
  }

  const handleInitiatePlayoffs = async () => {
      if(!confirm("Initiera slutspel? Detta bygger slutspelsträdet, Kvalspel och Bottenstriden.")) return;
      setLoading(true);
      try { await initiatePlayoffs(activeSeason.id); setTab('slutspel'); } catch(e:any){alert(e.message)}
      setLoading(false); 
  }

  const handleAwardCeremony = async () => { 
      if(!confirm("Dela ut priser? Detta analyserar alla matcher och delar ut säsongens pokaler.")) return;
      setLoading(true); 
      try { await triggerAwardCeremony(activeSeason.id); setTab('admin', 'awards'); } catch(e:any){alert(e.message)} 
      setLoading(false); 
  }

  const handleStartNextSeason = async () => {
      if(!confirm("Är du HELT säker? Detta genomför upp/nedflyttningar, stänger denna säsong och skapar en ny tom säsong.")) return;
      setLoading(true);
      try { await startNextSeason(activeSeason.id); setTab('admin', 'ceremonies'); } catch(e:any){alert(e.message)}
      setLoading(false);
  }

  const handleUpdateTeam = async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!editingTeam) return;
      setLoading(true);
      const formData = new FormData(e.currentTarget);
      const color1 = formData.get('primaryColor') as string;
      const logo = formData.get('logoPath') as string;
      try {
          await updateTeamIdentity(editingTeam.id, color1, logo); 
          setEditingTeam(null);
      } catch (err: any) { alert(err.message); }
      setLoading(false);
  }

  const getThemeVars = (tab: string) => {
      switch(tab) {
          case 'spelschema': return { color: '#10b981', glow: 'rgba(16,185,129,0.4)', bgClass: 'bg-emerald-600', textClass: 'text-emerald-400' };
          case 'elitserien': return { color: '#3b82f6', glow: 'rgba(59,130,246,0.4)', bgClass: 'bg-blue-600', textClass: 'text-blue-400' };
          case 'superettan': return { color: '#f97316', glow: 'rgba(249,115,22,0.4)', bgClass: 'bg-orange-600', textClass: 'text-orange-400' };
          case 'champions_league': return { color: '#fbbf24', glow: 'rgba(245,158,11,0.4)', bgClass: 'bg-amber-500', textClass: 'text-amber-400' };
          case 'slutspel': return { color: '#ef4444', glow: 'rgba(239,68,68,0.4)', bgClass: 'bg-red-600', textClass: 'text-red-400' };
          case 'lagen_hof': return { color: '#a855f7', glow: 'rgba(168,85,247,0.4)', bgClass: 'bg-purple-600', textClass: 'text-purple-400' };
          case 'admin': return { color: '#00ff41', glow: 'rgba(0,255,65,0.4)', bgClass: 'bg-[#00ff41] text-black font-bold', textClass: 'text-[#00ff41]' };
          default: return { color: '#3b82f6', glow: 'rgba(59,130,246,0.4)', bgClass: 'bg-blue-600', textClass: 'text-blue-400' };
      }
  }
  const theme = getThemeVars(activeMainTab);

  const FormIcon = ({ result }: { result: string }) => {
    let bgColor = 'bg-slate-700';
    if (result === 'W') bgColor = 'bg-green-600';
    if (result === 'OTW') bgColor = 'bg-blue-600';
    if (result === 'OTL') bgColor = 'bg-orange-600';
    if (result === 'L') bgColor = 'bg-red-600';
    return <div className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] text-white font-bold shadow-sm ${bgColor}`} title={result}>{result.replace('OT', 'S')[0]}</div>
  }

  const H2HBar = ({ winsHome, winsAway, colorHome, colorAway, textHome, textAway }: { winsHome: number, winsAway: number, colorHome: string, colorAway: string, textHome: string, textAway: string }) => {
      const total = winsHome + winsAway;
      if (total === 0) return (
          <div className="flex flex-col items-center mt-3 w-full max-w-[120px] mx-auto">
             <div className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">Inbördes Möten</div>
             <div className="w-full bg-slate-800 border border-slate-700 text-slate-500 text-[9px] font-bold text-center py-0.5 rounded-full">0 - 0</div>
          </div>
      );
      const homePct = Math.max(15, Math.min(85, (winsHome / total) * 100)); 
      const awayPct = 100 - homePct;

      const fallbackTextHome = (colorHome.toLowerCase() === '#ffffff') ? '#000000' : '#ffffff';
      const fallbackTextAway = (colorAway.toLowerCase() === '#ffffff') ? '#000000' : '#ffffff';

      return (
          <div className="flex flex-col items-center mt-3 w-full max-w-[140px] mx-auto opacity-90 hover:opacity-100 transition-opacity">
              <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Inbördes Möten</div>
              <div className="flex w-full h-5 rounded-full overflow-hidden shadow-lg border border-slate-700">
                  <div className="flex items-center justify-center text-[10px] font-black drop-shadow-sm" style={{ width: `${homePct}%`, backgroundColor: colorHome, color: textHome || fallbackTextHome }}>{winsHome > 0 ? winsHome : ''}</div>
                  <div className="flex items-center justify-center text-[10px] font-black drop-shadow-sm" style={{ width: `${awayPct}%`, backgroundColor: colorAway, color: textAway || fallbackTextAway }}>{winsAway > 0 ? winsAway : ''}</div>
              </div>
          </div>
      )
  }

  const LeagueTable = ({ title, teams }: { title: string, teams: Team[] }) => (
    <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden mb-8">
      <div className="bg-slate-950/50 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
        <h2 className="text-xl font-bold text-white uppercase tracking-wider">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-500 uppercase tracking-wider border-b border-slate-800 text-xs">
              <th className="p-4 font-semibold">#</th>
              <th className="p-4 font-semibold">Lag</th>
              <th className="p-4 text-center font-semibold">S</th>
              <th className="p-4 text-center font-semibold">V</th>
              <th className="p-4 text-center font-semibold">SV</th>
              <th className="p-4 text-center font-semibold">SF</th>
              <th className="p-4 text-center font-semibold">F</th>
              <th className="p-4 text-center font-semibold">BP</th>
              <th className="p-4 text-center font-semibold">+/-</th>
              <th className="p-4 text-center font-black text-white">P</th>
              <th className="p-4 text-center font-semibold">Form</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, index) => {
              let rowBorderColor = 'border-transparent';
              if (title === 'Elitserien') {
                  if (index < 8) rowBorderColor = 'border-blue-500';
                  else if (index === 11 || index === 12) rowBorderColor = 'border-orange-500';
                  else if (index === 13) rowBorderColor = 'border-red-500';
              } else if (title === 'Superettan') {
                  if (index === 0) rowBorderColor = 'border-emerald-500';
                  else if (index === 1 || index === 2) rowBorderColor = 'border-orange-500';
                  else if (index > 11) rowBorderColor = 'border-red-500';
              }
              const onFire = team.stats?.form?.length === 5 && team.stats.form.every((f: string) => f === 'W' || f === 'OTW');
              
              return (
                <tr key={team.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors last:border-b-0 relative group">
                  <td className={`p-4 text-slate-400 font-bold border-l-4 ${rowBorderColor}`}>{index + 1}</td>
                  <td className={`p-4 font-bold flex items-center gap-4 ${onFire ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'text-slate-200'}`}>
                      {team.logoPath ? ( <img src={team.logoPath} alt={team.name} className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform" /> ) : ( <div className="w-10 h-10 rounded shadow-md border border-slate-700" style={{ backgroundColor: team.primaryColor }}></div> )}
                      {team.name}
                  </td>
                  <td className="p-4 text-center text-slate-400">{team.stats.played}</td>
                  <td className="p-4 text-center text-slate-400">{team.stats.wins}</td>
                  <td className="p-4 text-center text-slate-400">{team.stats.otWins}</td>
                  <td className="p-4 text-center text-slate-400">{team.stats.otLosses}</td>
                  <td className="p-4 text-center text-slate-400">{team.stats.losses}</td>
                  <td className="p-4 text-center text-slate-400">{team.stats.goalsFor}:{team.stats.goalsAgainst}</td>
                  <td className="p-4 text-center font-medium text-slate-300">{team.stats.goalDifference > 0 ? `+${team.stats.goalDifference}` : team.stats.goalDifference}</td>
                  <td className="p-4 text-center font-black text-lg" style={{ color: theme.color }}>{team.stats.points}</td>
                  <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                          {team.stats.form.length > 0 ? team.stats.form.map((f, i) => <FormIcon key={i} result={f} />) : <span className="text-slate-600">-</span>}
                      </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  const EnhancedMatchCard = ({ match }: { match: any }) => {
    const homeTeam = initialTeams.find(t => t.id === match.homeTeamId);
    const awayTeam = initialTeams.find(t => t.id === match.awayTeamId);
    if (!homeTeam || !awayTeam) return null;

    const homeRank = getTeamRank(homeTeam.id, homeTeam.division);
    const awayRank = getTeamRank(awayTeam.id, awayTeam.division);
    const homeOnFire = homeTeam.stats?.form?.length === 5 && homeTeam.stats.form.every((f: string) => f === 'W' || f === 'OTW');
    const awayOnFire = awayTeam.stats?.form?.length === 5 && awayTeam.stats.form.every((f: string) => f === 'W' || f === 'OTW');

    let seriesText = "";
    if (match.matchType === 'PLAYOFF' || match.matchType === 'QUALIFIER' || match.matchType === 'BOTTOM_BATTLE' || (match.matchType === 'CL' && match.playoffRound === 'FINAL')) {
        const seriesMatches = activeMatches.filter(m => m.matchType === match.matchType && m.playoffRound === match.playoffRound && m.round === match.round && m.status === 'COMPLETED');
        let winsHome = 0, winsAway = 0;
        seriesMatches.forEach(m => {
            const isHomeTeamA = m.homeTeamId === homeTeam.id;
            const hWon = m.homePoints! > m.awayPoints!;
            if (isHomeTeamA) { if (hWon) winsHome++; else winsAway++; } else { if (hWon) winsAway++; else winsHome++; }
        });
        if (winsHome > winsAway) seriesText = `Leder serien: ${winsHome}-${winsAway}`;
        else if (winsAway > winsHome) seriesText = `Underläge: ${winsHome}-${winsAway}`;
        else if (winsHome > 0 || winsAway > 0) seriesText = `Oavgjort i serien: ${winsHome}-${winsAway}`;
    }

    let aggText = "";
    if (match.matchType === 'CL' && match.gameNumber === 2) {
        const leg1 = activeMatches.find((m:any) => m.matchType === 'CL' && m.playoffRound === match.playoffRound && m.round === match.round && m.gameNumber === 1 && m.status === 'COMPLETED');
        if (leg1) {
            const homeAgg = leg1.homeTeamId === homeTeam.id ? leg1.homePoints : leg1.awayPoints;
            const awayAgg = leg1.awayTeamId === awayTeam.id ? leg1.awayPoints : leg1.homePoints;
            aggText = `Match 1: ${homeAgg} - ${awayAgg}`;
        }
    }

    const allHistoricalMatches = [
        ...(homeTeam.homeMatches || []),
        ...(homeTeam.awayMatches || [])
    ].filter((m: any) => m.status === 'COMPLETED' && (m.homeTeamId === awayTeam.id || m.awayTeamId === awayTeam.id));

    let homeH2hWins = 0, awayH2hWins = 0;
    allHistoricalMatches.forEach((m: any) => {
        const isHomeTeamA = m.homeTeamId === homeTeam.id;
        const tAPoints = isHomeTeamA ? m.homePoints : m.awayPoints;
        const tBPoints = isHomeTeamA ? m.awayPoints : m.homePoints;
        if (tAPoints! > tBPoints!) homeH2hWins++; else awayH2hWins++;
    });

    let headerTitle = '';
    if (match.matchType === 'CL') {
        const roundNames: Record<string,string> = { 'RO32': '16-delsfinal', 'RO16': '8-delsfinal', 'QF': 'Kvartsfinal', 'SF': 'Semifinal', 'FINAL': 'Final' };
        headerTitle = `CL ${roundNames[match.playoffRound] || ''} (Match ${match.gameNumber})`;
    } else if (match.matchType === 'PLAYOFF') {
        const roundNames: Record<string,string> = { 'QF': 'Kvartsfinal', 'SF': 'Semifinal', 'FINAL': 'Final' };
        headerTitle = `Slutspel ${roundNames[match.playoffRound] || ''} (Match ${match.gameNumber}:5)`;
    } else if (match.matchType === 'QUALIFIER') {
        headerTitle = `Kval till Elitserien (Match ${match.gameNumber}:5)`;
    } else if (match.matchType === 'BOTTOM_BATTLE') {
        headerTitle = `Bottenstriden (Match ${match.gameNumber}:5)`;
    }

    return (
      <form onSubmit={(e) => handleSaveMatch(match.id, e)} className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 overflow-hidden flex flex-col md:flex-row items-center justify-between p-6 transition-all hover:border-[var(--active-theme)] gap-4 relative mt-4 w-full group">
        {headerTitle && ( <span className="absolute -top-3 left-6 bg-slate-950 text-[var(--active-theme)] px-3 py-1 rounded-full shadow-lg border border-slate-800 text-[10px] font-black uppercase tracking-widest">{headerTitle}</span> )}
        
        <div className="flex items-center justify-end gap-5 w-full md:w-1/3 pt-3 md:pt-0">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500">#{homeRank}</span>
              <span className={`font-black text-xl md:text-2xl truncate max-w-[140px] md:max-w-[200px] tracking-tight ${homeOnFire ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'text-slate-100'}`}>{homeTeam.name}</span>
            </div>
            <div className="flex gap-1 mt-1">
              {homeTeam.stats?.form?.length > 0 ? homeTeam.stats.form.map((f: string, i: number) => <FormIcon key={i} result={f} />) : <span className="text-[9px] text-slate-600 font-bold">INGEN FORM</span>}
            </div>
          </div>
          {homeTeam.logoPath ? ( <img src={homeTeam.logoPath} alt={homeTeam.name} className="w-20 h-20 md:w-24 md:h-24 object-contain drop-shadow-[0_10px_15px_rgba(255,255,255,0.05)] group-hover:scale-105 transition-transform flex-shrink-0" /> ) : ( <div className="w-20 h-20 md:w-24 md:h-24 rounded-full shadow-inner border border-slate-700 flex-shrink-0" style={{ backgroundColor: homeTeam.primaryColor }}></div> )}
        </div>

        <div className="flex flex-col items-center justify-center gap-2 w-full md:w-auto relative">
            {aggText && ( <div className="absolute -top-6 text-[10px] font-black text-amber-400 uppercase tracking-widest whitespace-nowrap bg-slate-950 px-3 py-0.5 rounded-full border border-slate-800 shadow-sm">{aggText}</div> )}

            <div className="flex items-center gap-4">
               <input type="number" name="homePoints" required min="0" className="w-16 h-14 text-center text-2xl font-black border border-slate-700 rounded-xl focus:ring-2 focus:ring-[var(--active-theme)] focus:border-[var(--active-theme)] bg-slate-950 text-white shadow-inner" placeholder="0" />
               <span className="text-slate-600 font-black text-xl">-</span>
               <input type="number" name="awayPoints" required min="0" className="w-16 h-14 text-center text-2xl font-black border border-slate-700 rounded-xl focus:ring-2 focus:ring-[var(--active-theme)] focus:border-[var(--active-theme)] bg-slate-950 text-white shadow-inner" placeholder="0" />
            </div>
            <H2HBar winsHome={homeH2hWins} winsAway={awayH2hWins} colorHome={homeTeam.primaryColor} colorAway={awayTeam.primaryColor} textHome={homeTeam.secondaryColor || ''} textAway={awayTeam.secondaryColor || ''} />
            {seriesText && <span className="text-[9px] font-bold text-white uppercase tracking-widest mt-1 bg-slate-800 px-3 py-1 rounded-full shadow-inner border border-slate-700">{seriesText}</span>}
        </div>

        <div className="flex items-center justify-start gap-5 w-full md:w-1/3">
          {awayTeam.logoPath ? ( <img src={awayTeam.logoPath} alt={awayTeam.name} className="w-20 h-20 md:w-24 md:h-24 object-contain drop-shadow-[0_10px_15px_rgba(255,255,255,0.05)] group-hover:scale-105 transition-transform flex-shrink-0" /> ) : ( <div className="w-20 h-20 md:w-24 md:h-24 rounded-full shadow-inner border border-slate-700 flex-shrink-0" style={{ backgroundColor: awayTeam.primaryColor }}></div> )}
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2">
              <span className={`font-black text-xl md:text-2xl truncate max-w-[140px] md:max-w-[200px] tracking-tight ${awayOnFire ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'text-slate-100'}`}>{awayTeam.name}</span>
              <span className="text-[10px] font-bold text-slate-500">#{awayRank}</span>
            </div>
            <div className="flex gap-1 mt-1">
              {awayTeam.stats?.form?.length > 0 ? awayTeam.stats.form.map((f: string, i: number) => <FormIcon key={i} result={f} />) : <span className="text-[9px] text-slate-600 font-bold">INGEN FORM</span>}
            </div>
          </div>
        </div>

        <div className="flex flex-row md:flex-col items-center justify-center gap-4 w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-800 pt-6 md:pt-0 md:pl-6 px-2">
           <label className="flex items-center gap-2 cursor-pointer group/sd">
             <input type="checkbox" name="isSuddenDeath" className="w-5 h-5 text-[var(--active-theme)] rounded focus:ring-[var(--active-theme)] border-slate-700 bg-slate-950 cursor-pointer" />
             <span className="text-[10px] font-bold text-slate-500 group-hover/sd:text-slate-300 uppercase tracking-widest transition-colors">Sudden Death</span>
           </label>
           <button type="submit" disabled={loading} className="w-full md:w-auto bg-[var(--active-theme)] hover:opacity-80 text-white font-black text-xs uppercase tracking-widest py-3 px-6 rounded-xl shadow-lg transition-all disabled:opacity-50" style={{ color: activeMainTab === 'champions_league' || activeMainTab === 'admin' ? '#0f172a' : '#ffffff'}}>Spara</button>
        </div>
      </form>
    )
  }

  const BracketNode = ({ matches, title, matchType }: { matches: any[], title: string, matchType: string }) => {
    return (
        <div className="flex flex-col justify-around w-48 md:w-52 shrink-0 relative">
            <div className="text-center font-black uppercase tracking-widest text-[10px] mb-4 border-b border-slate-800 pb-2" style={{color: theme.color}}>{title}</div>
            <div className="flex flex-col justify-around h-full gap-3">
                {matches.map((slotMatches, i) => {
                    if (slotMatches.length === 0) return <div key={i} className="h-10 bg-transparent"></div>;
                    const slotNumber = slotMatches[0].round;
                    const teamA = initialTeams.find(t => t.id === slotMatches[0].homeTeamId);
                    const teamB = initialTeams.find(t => t.id === slotMatches[0].awayTeamId);
                    const isBye = slotMatches.some((m:any) => m.homePoints === 1 && m.awayPoints === 0 && teamB?.name === 'TBD');
                    
                    const isBestOf5 = matchType === 'PLAYOFF' || matchType === 'QUALIFIER' || matchType === 'BOTTOM_BATTLE' || (matchType === 'CL' && title === 'Final');
                    
                    let statA = 0, statB = 0;
                    if (isBestOf5) {
                        slotMatches.forEach((m:any) => {
                            if (m.status === 'COMPLETED') {
                                const aWon = m.homeTeamId === teamA?.id ? m.homePoints! > m.awayPoints! : m.awayPoints! > m.homePoints!;
                                if (aWon) statA++; else statB++;
                            }
                        });
                    } else {
                        slotMatches.forEach((m:any) => {
                            if (m.status === 'COMPLETED') {
                                if (m.homeTeamId === teamA?.id) { statA += (m.homePoints || 0); statB += (m.awayPoints || 0); }
                                else { statA += (m.awayPoints || 0); statB += (m.homePoints || 0); }
                            }
                        });
                    }

                    const isActiveSlot = slotMatches.some((m:any) => m.status === 'SCHEDULED');
                    const nodeBorder = isActiveSlot ? `border-[var(--active-theme)] shadow-[0_0_10px_var(--active-theme)]` : 'border-slate-800';

                    return (
                        <div key={slotNumber} className={`relative bg-slate-900 border ${nodeBorder} shadow-lg rounded-xl text-xs flex flex-col overflow-hidden transition-all`}>
                            <div className="flex justify-between items-center p-2 border-b border-slate-800 bg-slate-950/30 hover:bg-slate-800/50 transition-colors">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {teamA && teamA.name !== 'TBD' && (teamA.logoPath ? <img src={teamA.logoPath} className="w-6 h-6 object-contain drop-shadow-sm" /> : <div className="w-6 h-6 rounded-full shadow-inner" style={{backgroundColor: teamA.primaryColor}}></div>)}
                                    <span className={`truncate font-bold ${!teamA || teamA.name === 'TBD' ? 'text-slate-600 italic' : 'text-slate-200'}`}>{teamA?.name || 'TBD'}</span>
                                </div>
                                {teamA?.name !== 'TBD' && <span className={`text-[10px] bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-md font-mono shadow-inner ml-2 shrink-0 ${isBestOf5 && statA >= 3 ? 'text-[var(--active-theme)] font-black' : 'text-slate-400'}`}>{statA}</span>}
                            </div>
                            <div className="flex justify-between items-center p-2 bg-slate-950/30 hover:bg-slate-800/50 transition-colors">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {!isBye && teamB && teamB.name !== 'TBD' && (teamB.logoPath ? <img src={teamB.logoPath} className="w-6 h-6 object-contain drop-shadow-sm" /> : <div className="w-6 h-6 rounded-full shadow-inner" style={{backgroundColor: teamB.primaryColor}}></div>)}
                                    <span className={`truncate font-bold ${!teamB || teamB.name === 'TBD' ? 'text-slate-600 italic' : 'text-slate-200'}`}>{isBye ? 'BYE' : (teamB?.name || 'TBD')}</span>
                                </div>
                                {teamB?.name !== 'TBD' && !isBye && <span className={`text-[10px] bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-md font-mono shadow-inner ml-2 shrink-0 ${isBestOf5 && statB >= 3 ? 'text-[var(--active-theme)] font-black' : 'text-slate-400'}`}>{statB}</span>}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
  }

  const RecordsView = ({ recs, isLeague, isCurrent }: { recs: any, isLeague: boolean, isCurrent: boolean }) => (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
              <h3 className="text-xl font-black uppercase text-slate-100 tracking-wider mb-6 border-b border-slate-800 pb-3">
                  {isCurrent ? 'Säsongens Matchrekord' : 'All-Time Matchrekord'}
              </h3>
              {recs.theMarathon.match ? (
                  <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-8 relative overflow-hidden flex items-center justify-between group">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--active-theme)] opacity-80 group-hover:opacity-100 group-hover:w-2 transition-all"></div>
                      <div>
                          <h4 className="font-black text-slate-100 text-base">The Marathon Match</h4>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                              {isCurrent ? 'Högst kombinerad poäng i år' : 'Högst kombinerad poäng någonsin'}
                          </p>
                      </div>
                      <div className="text-right">
                          <div className="font-black text-[var(--active-theme)] text-3xl drop-shadow-md">{recs.theMarathon.score} p</div>
                          <div className="text-[10px] font-bold text-slate-400 mt-1">{recs.theMarathon.match.teamA?.name} vs {recs.theMarathon.match.teamB?.name}</div>
                      </div>
                  </div>
              ) : <div className="bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed p-8 text-center text-sm font-bold text-slate-600">Inga matcher spelade</div>}
              
              {recs.theBlowout.match && (
                  <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-8 relative overflow-hidden flex items-center justify-between group">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--active-theme)] opacity-80 group-hover:opacity-100 group-hover:w-2 transition-all"></div>
                      <div>
                          <h4 className="font-black text-slate-100 text-base">Största Utklassningen</h4>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                              {isCurrent ? 'Största poängmarginal i år' : 'Största poängmarginal i vinst'}
                          </p>
                      </div>
                      <div className="text-right">
                          <div className="font-black text-[var(--active-theme)] text-3xl drop-shadow-md">+{recs.theBlowout.margin} p</div>
                          <div className="text-[10px] font-bold text-slate-400 mt-1">{recs.theBlowout.match.teamA?.name} vann mot {recs.theBlowout.match.teamB?.name}</div>
                      </div>
                  </div>
              )}
              
              {recs.offensiveJuggernaut.team && (
                  <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-8 relative overflow-hidden flex items-center justify-between group">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--active-theme)] opacity-80 group-hover:opacity-100 group-hover:w-2 transition-all"></div>
                      <div>
                          <h4 className="font-black text-slate-100 text-base">Offensivt Maskineri</h4>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                              {isCurrent ? 'Högst målsnitt per match i år' : 'Högst målsnitt per match (All-Time)'}
                          </p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                          <div className="font-black text-[var(--active-theme)] text-3xl drop-shadow-md">{recs.offensiveJuggernaut.avg}</div>
                          <div className="text-[10px] font-bold text-slate-100 bg-slate-800 px-3 py-1 rounded-full mt-2 shadow-inner border border-slate-700">{recs.offensiveJuggernaut.team?.name}</div>
                      </div>
                  </div>
              )}
          </div>
          
          <div className="space-y-6">
              <h3 className="text-xl font-black uppercase text-slate-100 tracking-wider mb-6 border-b border-slate-800 pb-3">Säsongsrekord</h3>
              {isLeague && recs.maxSeasonPoints.team && (
                  <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-8 relative overflow-hidden flex items-center justify-between group">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--active-theme)] opacity-80 group-hover:opacity-100 group-hover:w-2 transition-all"></div>
                      <div><h4 className="font-black text-slate-100 text-base">Poängrekord</h4><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Flest ligapoäng på en säsong</p></div>
                      <div className="text-right flex flex-col items-end">
                          <div className="font-black text-[var(--active-theme)] text-3xl drop-shadow-md">{recs.maxSeasonPoints.value} p</div>
                          <div className="text-[10px] font-bold text-slate-100 bg-slate-800 px-3 py-1 rounded-full mt-2 shadow-inner border border-slate-700">{recs.maxSeasonPoints.team?.name} ({recs.maxSeasonPoints.season?.name || 'Okänd'})</div>
                      </div>
                  </div>
              )}
              {recs.maxSeasonGoals.team ? (
                  <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-8 relative overflow-hidden flex items-center justify-between group">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--active-theme)] opacity-80 group-hover:opacity-100 group-hover:w-2 transition-all"></div>
                      <div><h4 className="font-black text-slate-100 text-base">Gjorda Bordspoäng</h4><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Flest BP på en säsong</p></div>
                      <div className="text-right flex flex-col items-end">
                          <div className="font-black text-[var(--active-theme)] text-3xl drop-shadow-md">{recs.maxSeasonGoals.value}</div>
                          <div className="text-[10px] font-bold text-slate-100 bg-slate-800 px-3 py-1 rounded-full mt-2 shadow-inner border border-slate-700">{recs.maxSeasonGoals.team?.name} ({recs.maxSeasonGoals.season?.name || 'Okänd'})</div>
                      </div>
                  </div>
              ) : <div className="bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed p-8 text-center text-sm font-bold text-slate-600">Inga säsonger spelade</div>}
              {recs.maxSeasonWins.team && (
                  <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-8 relative overflow-hidden flex items-center justify-between group">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--active-theme)] opacity-80 group-hover:opacity-100 group-hover:w-2 transition-all"></div>
                      <div><h4 className="font-black text-slate-100 text-base">Vinstrekord</h4><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Flest vinster på en säsong</p></div>
                      <div className="text-right flex flex-col items-end">
                          <div className="font-black text-[var(--active-theme)] text-3xl drop-shadow-md">{recs.maxSeasonWins.value}</div>
                          <div className="text-[10px] font-bold text-slate-100 bg-slate-800 px-3 py-1 rounded-full mt-2 shadow-inner border border-slate-700">{recs.maxSeasonWins.team?.name} ({recs.maxSeasonWins.season?.name || 'Okänd'})</div>
                      </div>
                  </div>
              )}
              {recs.maxSeasonCleanSheets.team && recs.maxSeasonCleanSheets.value > 0 && (
                  <div className="bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-8 relative overflow-hidden flex items-center justify-between group">
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--active-theme)] opacity-80 group-hover:opacity-100 group-hover:w-2 transition-all"></div>
                      <div><h4 className="font-black text-slate-100 text-base">Flest Hållna Nollor</h4><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Säsongens försvarsmur</p></div>
                      <div className="text-right flex flex-col items-end">
                          <div className="font-black text-[var(--active-theme)] text-3xl drop-shadow-md">{recs.maxSeasonCleanSheets.value}</div>
                          <div className="text-[10px] font-bold text-slate-100 bg-slate-800 px-3 py-1 rounded-full mt-2 shadow-inner border border-slate-700">{recs.maxSeasonCleanSheets.team?.name} ({recs.maxSeasonCleanSheets.season?.name || 'Okänd'})</div>
                      </div>
                  </div>
              )}
          </div>
      </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-[var(--active-theme)] selection:text-slate-900 transition-colors duration-500" style={{ '--active-theme': theme.color } as React.CSSProperties}>
      
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50 shadow-2xl">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                  <h1 className="text-3xl font-black text-white tracking-tighter uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">Tourna<span style={{color: theme.color}}>fy</span></h1>
              </div>
              <div className="flex flex-wrap gap-2">
                  <button onClick={() => setTab('spelschema')} className={`px-5 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${activeMainTab === 'spelschema' ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'}`}>Spelschema</button>
                  <button onClick={() => setTab('elitserien')} className={`px-5 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${activeMainTab === 'elitserien' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'}`}>Elitserien</button>
                  <button onClick={() => setTab('superettan')} className={`px-5 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${activeMainTab === 'superettan' ? 'bg-orange-600 text-white shadow-[0_0_15px_rgba(234,88,12,0.5)]' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'}`}>Superettan</button>
                  <button onClick={() => setTab('champions_league')} className={`px-5 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${activeMainTab === 'champions_league' ? 'bg-amber-400 text-slate-900 shadow-[0_0_15px_rgba(251,191,36,0.5)]' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'}`}>Champions League</button>
                  {activeSeason?.phase === 'PLAYOFFS' && ( <button onClick={() => setTab('slutspel')} className={`px-5 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${activeMainTab === 'slutspel' ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'}`}>Slutspel</button> )}
                  <button onClick={() => setTab('lagen_hof')} className={`px-5 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${activeMainTab === 'lagen_hof' ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800'}`}>Lagen & Hall of Fame</button>
                  <button onClick={() => setTab('admin')} className={`px-5 py-2 rounded-lg font-black text-xs uppercase tracking-widest transition-all ${activeMainTab === 'admin' ? 'bg-[#00ff41] text-black shadow-[0_0_15px_rgba(0,255,65,0.5)] font-mono' : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800 font-mono'}`}>The Ritual Room</button>
              </div>
          </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 pt-8 pb-20">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <h2 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">Nuvarande Fas</h2>
              <div className="flex items-center gap-4">
                  <h1 className="text-4xl font-black text-white tracking-tight uppercase" style={{ textShadow: `0 0 20px ${theme.glow}` }}>{activeSeason?.name || 'Säsong'}</h1>
                  <span className="bg-slate-900 border border-slate-700 text-white font-bold px-4 py-1.5 rounded-full text-xs uppercase tracking-widest shadow-inner relative overflow-hidden">
                      <div className="absolute inset-0 bg-[var(--active-theme)] opacity-10"></div>
                      <span className="relative z-10">{displayPhase}</span>
                  </span>
              </div>
            </div>
          </header>

          {activeMainTab === 'spelschema' && (
              <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-center justify-between mb-10 border-b border-slate-800 pb-4">
                      <h2 className="text-2xl font-black text-white uppercase tracking-widest drop-shadow-md">{activeTimelineHeader || 'Spelschema'}</h2>
                  </div>
                  {matchesToShow.length === 0 ? (
                      <div className="p-16 text-center bg-slate-900 rounded-3xl border border-slate-800 border-dashed shadow-2xl relative overflow-hidden">
                          <div className="absolute inset-0 bg-[var(--active-theme)] opacity-5"></div>
                          <p className="text-slate-400 font-bold uppercase tracking-widest text-sm relative z-10">Inga matcher att rapportera</p>
                      </div>
                  ) : (
                      <div className="flex flex-col gap-12">
                          {matchesToShow.filter(m => m.matchType === 'REGULAR' && initialTeams.find(t=>t.id===m.homeTeamId)?.division==='ELITSERIEN').length > 0 && ( <div><h3 className="text-lg font-black uppercase text-blue-500 tracking-widest mb-6 border-l-4 border-blue-500 pl-4">Elitserien</h3><div className="flex flex-col gap-4">{matchesToShow.filter(m => m.matchType === 'REGULAR' && initialTeams.find(t=>t.id===m.homeTeamId)?.division==='ELITSERIEN').map((m: any) => <EnhancedMatchCard key={m.id} match={m} />)}</div></div> )}
                          {matchesToShow.filter(m => m.matchType === 'REGULAR' && initialTeams.find(t=>t.id===m.homeTeamId)?.division==='SUPERETTAN').length > 0 && ( <div><h3 className="text-lg font-black uppercase text-orange-500 tracking-widest mb-6 border-l-4 border-orange-500 pl-4">Superettan</h3><div className="flex flex-col gap-4">{matchesToShow.filter(m => m.matchType === 'REGULAR' && initialTeams.find(t=>t.id===m.homeTeamId)?.division==='SUPERETTAN').map((m: any) => <EnhancedMatchCard key={m.id} match={m} />)}</div></div> )}
                          {matchesToShow.filter(m => m.matchType === 'PLAYOFF').length > 0 && ( <div><h3 className="text-lg font-black uppercase text-red-500 tracking-widest mb-6 border-l-4 border-red-500 pl-4">Elitserien Slutspel</h3><div className="flex flex-col gap-4">{matchesToShow.filter(m => m.matchType === 'PLAYOFF').map((m: any) => <EnhancedMatchCard key={m.id} match={m} />)}</div></div> )}
                          {matchesToShow.filter(m => m.matchType === 'QUALIFIER').length > 0 && ( <div><h3 className="text-lg font-black uppercase text-orange-400 tracking-widest mb-6 border-l-4 border-orange-400 pl-4">Kval till Elitserien</h3><div className="flex flex-col gap-4">{matchesToShow.filter(m => m.matchType === 'QUALIFIER').map((m: any) => <EnhancedMatchCard key={m.id} match={m} />)}</div></div> )}
                          {matchesToShow.filter(m => m.matchType === 'BOTTOM_BATTLE').length > 0 && ( <div><h3 className="text-lg font-black uppercase text-slate-500 tracking-widest mb-6 border-l-4 border-slate-500 pl-4">Bottenstriden</h3><div className="flex flex-col gap-4">{matchesToShow.filter(m => m.matchType === 'BOTTOM_BATTLE').map((m: any) => <EnhancedMatchCard key={m.id} match={m} />)}</div></div> )}
                          {matchesToShow.filter(m => m.matchType === 'CL').length > 0 && ( <div><h3 className="text-lg font-black uppercase text-amber-400 tracking-widest mb-6 border-l-4 border-amber-400 pl-4">Champions League</h3><div className="flex flex-col gap-4">{matchesToShow.filter(m => m.matchType === 'CL').map((m: any) => <EnhancedMatchCard key={m.id} match={m} />)}</div></div> )}
                      </div>
                  )}
              </section>
          )}

          {activeMainTab === 'elitserien' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex border-b border-slate-800 mb-10 overflow-x-auto gap-4">
                    <button onClick={() => setTab('elitserien', 'tabell')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeSubTab === 'tabell' ? 'border-[var(--active-theme)] text-white drop-shadow-[0_0_8px_var(--active-theme)]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Tabell</button>
                    <button onClick={() => setTab('elitserien', 'rekord')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeSubTab === 'rekord' ? 'border-[var(--active-theme)] text-white drop-shadow-[0_0_8px_var(--active-theme)]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Ligarekord</button>
                </div>
                {activeSubTab === 'tabell' && <LeagueTable title="Elitserien" teams={elitserien} />}
                {activeSubTab === 'rekord' && (
                    <div className="space-y-16">
                        <div><RecordsView recs={recordsObj.elit.current} isLeague={true} isCurrent={true} /></div>
                        <div><RecordsView recs={recordsObj.elit.hist} isLeague={true} isCurrent={false} /></div>
                    </div>
                )}
            </div>
          )}

          {activeMainTab === 'superettan' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex border-b border-slate-800 mb-10 overflow-x-auto gap-4">
                    <button onClick={() => setTab('superettan', 'tabell')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeSubTab === 'tabell' ? 'border-[var(--active-theme)] text-white drop-shadow-[0_0_8px_var(--active-theme)]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Tabell</button>
                    <button onClick={() => setTab('superettan', 'rekord')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeSubTab === 'rekord' ? 'border-[var(--active-theme)] text-white drop-shadow-[0_0_8px_var(--active-theme)]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Ligarekord</button>
                </div>
                {activeSubTab === 'tabell' && <LeagueTable title="Superettan" teams={superettan} />}
                {activeSubTab === 'rekord' && (
                    <div className="space-y-16">
                        <div><RecordsView recs={recordsObj.super.current} isLeague={true} isCurrent={true} /></div>
                        <div><RecordsView recs={recordsObj.super.hist} isLeague={true} isCurrent={false} /></div>
                    </div>
                )}
            </div>
          )}

          {activeMainTab === 'champions_league' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex border-b border-slate-800 mb-10 overflow-x-auto gap-4">
                    <button onClick={() => setTab('champions_league', 'bracket')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeSubTab === 'bracket' ? 'border-[var(--active-theme)] text-white drop-shadow-[0_0_8px_var(--active-theme)]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Slutspelsträd</button>
                    <button onClick={() => setTab('champions_league', 'rekord')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeSubTab === 'rekord' ? 'border-[var(--active-theme)] text-white drop-shadow-[0_0_8px_var(--active-theme)]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>CL Rekord</button>
                </div>
                {activeSubTab === 'bracket' && (
                    <div className="bg-slate-900 p-6 rounded-3xl shadow-2xl border border-slate-800 w-full overflow-x-auto pb-4">
                        <div className="flex min-w-max gap-6 p-2 justify-center">
                            {[ { id: 'RO32', name: '16-dels', slots: 16 }, { id: 'RO16', name: '8-dels', slots: 8 }, { id: 'QF', name: 'Kvartsfinal', slots: 4 }, { id: 'SF', name: 'Semifinal', slots: 2 }, { id: 'FINAL', name: 'Final', slots: 1 } ].map(round => {
                                const slotMatchesArray = Array.from({ length: round.slots }).map((_, i) => clMatches.filter(m => m.playoffRound === round.id && m.round === i + 1));
                                return <BracketNode key={round.id} matches={slotMatchesArray} title={round.name} matchType="CL" />
                            })}
                        </div>
                    </div>
                )}
                {activeSubTab === 'rekord' && (
                    <div className="space-y-16">
                        <div><RecordsView recs={recordsObj.cl.current} isLeague={false} isCurrent={true} /></div>
                        <div><RecordsView recs={recordsObj.cl.hist} isLeague={false} isCurrent={false} /></div>
                    </div>
                )}
            </div>
          )}

          {activeMainTab === 'slutspel' && (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="bg-slate-900 p-6 rounded-3xl shadow-2xl border border-slate-800 w-full overflow-x-auto pb-4 mb-12">
                    <h3 className="text-xl font-black uppercase text-red-500 tracking-widest mb-6 border-b border-slate-800 pb-3">Elitserien Slutspel</h3>
                    <div className="flex min-w-max gap-6 p-2 justify-center">
                        {[ { id: 'QF', name: 'Kvartsfinal', slots: 4 }, { id: 'SF', name: 'Semifinal', slots: 2 }, { id: 'FINAL', name: 'Final', slots: 1 } ].map(round => {
                            const slotMatchesArray = Array.from({ length: round.slots }).map((_, i) => playoffMatches.filter(m => m.playoffRound === round.id && m.round === i + 1));
                            return <BracketNode key={round.id} matches={slotMatchesArray} title={round.name} matchType="PLAYOFF" />
                        })}
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div className="bg-slate-900 p-6 rounded-3xl shadow-2xl border border-slate-800 overflow-x-auto">
                         <h3 className="text-xl font-black uppercase text-orange-500 tracking-widest mb-6 border-b border-slate-800 pb-3">Kval till Elitserien</h3>
                         {qualifierMatches.length > 0 ? (
                             <div className="flex min-w-max gap-6 justify-center">
                                {['KVAL_1', 'KVAL_2'].map((playoffRound, idx) => {
                                    const series = qualifierMatches.filter(m => m.playoffRound === playoffRound);
                                    if(series.length === 0) return null;
                                    return <BracketNode key={playoffRound} matches={[series]} title={`Kvalmatch ${idx + 1}`} matchType="QUALIFIER" />
                                })}
                             </div>
                         ) : <p className="text-sm text-slate-500 italic uppercase font-bold tracking-widest">Inga kvalmatcher genererade.</p>}
                    </div>
                    <div className="bg-slate-900 p-6 rounded-3xl shadow-2xl border border-slate-800 overflow-x-auto">
                         <h3 className="text-xl font-black uppercase text-slate-500 tracking-widest mb-6 border-b border-slate-800 pb-3">Bottenstriden</h3>
                         {bottomMatches.length > 0 ? (
                             <div className="flex min-w-max justify-center"><BracketNode matches={[bottomMatches]} title="Superettan Förlorarmöte" matchType="BOTTOM_BATTLE" /></div>
                         ) : <p className="text-sm text-slate-500 italic uppercase font-bold tracking-widest">Ingen bottenstrid genererad.</p>}
                    </div>
                </div>
            </div>
          )}

          {activeMainTab === 'lagen_hof' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex border-b border-slate-800 mb-10 overflow-x-auto gap-4">
                    <button onClick={() => setTab('lagen_hof', 'elo')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeSubTab === 'elo' ? 'border-[var(--active-theme)] text-white drop-shadow-[0_0_8px_var(--active-theme)]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Global Elo-ranking</button>
                    <button onClick={() => setTab('lagen_hof', 'hof')} className={`px-6 py-4 font-black text-xs uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeSubTab === 'hof' ? 'border-[var(--active-theme)] text-white drop-shadow-[0_0_8px_var(--active-theme)]' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Hall of Fame</button>
                </div>

                {activeSubTab === 'elo' && (
                    <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden mb-8">
                        <div className="bg-slate-950/50 px-8 py-6 border-b border-slate-800 flex justify-between items-center"><h2 className="text-xl font-bold text-white uppercase tracking-wider">Global Elo-Ranking</h2></div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="text-slate-500 uppercase tracking-wider bg-slate-900 border-b border-slate-800 text-xs">
                                        <th className="p-6 font-semibold"># Rank</th><th className="p-6 font-semibold">Land</th><th className="p-6 text-center font-semibold">Division</th><th className="p-6 text-center font-black text-white">Elo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {globalEloTeams.map((team, index) => {
                                        const onFire = team.stats?.form?.length === 5 && team.stats.form.every((f: string) => f === 'W' || f === 'OTW');
                                        return (
                                            <tr key={team.id} onClick={() => router.push(`/teams/${team.id}`)} className="cursor-pointer border-b border-slate-800 hover:bg-slate-800/50 transition-colors last:border-b-0 group">
                                                <td className="p-6 text-slate-500 font-bold group-hover:text-[var(--active-theme)] transition-colors">{index + 1}</td>
                                                <td className={`p-6 font-bold flex items-center gap-6 ${onFire ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'text-slate-200'}`}>
                                                    {team.logoPath ? ( <img src={team.logoPath} alt={team.name} className="w-14 h-14 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform" /> ) : ( <div className="w-14 h-14 rounded-full shadow-inner border border-slate-700" style={{ backgroundColor: team.primaryColor }}></div> )}
                                                    <span className="text-lg">{team.name}</span>
                                                </td>
                                                <td className="p-6 text-center"><span className={`text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest ${team.division === 'ELITSERIEN' ? 'bg-blue-900/30 text-blue-400 border border-blue-800' : 'bg-orange-900/30 text-orange-400 border border-orange-800'}`}>{team.division}</span></td>
                                                <td className="p-6 text-center font-black text-2xl text-[var(--active-theme)] flex items-center justify-center gap-3">
                                                    {Math.round(team.currentElo)}
                                                    <span className="opacity-0 group-hover:opacity-100 text-white text-lg transition-opacity">&rarr;</span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                
                {activeSubTab === 'hof' && (
                    <div className="space-y-16">
                        {sortedSeasonsForHof.map((seasonName: string) => (
                            <div key={seasonName} className="bg-slate-900 p-10 rounded-3xl shadow-2xl border border-slate-800 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--active-theme)]"></div>
                                <h3 className="text-3xl font-black uppercase text-white tracking-widest mb-10 drop-shadow-md">{seasonName}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
                                    {trophiesBySeason[seasonName].sort((a:any,b:any) => {
                                        let idxA = TROPHY_ORDER.indexOf(a.name); let idxB = TROPHY_ORDER.indexOf(b.name);
                                        if (idxA === -1) idxA = 99; if (idxB === -1) idxB = 99;
                                        return idxA - idxB;
                                    }).map((trophy: any) => {
                                        const winner = initialTeams.find(t => t.id === trophy.teamId);
                                        return (
                                            <div key={trophy.id} className="bg-slate-950/50 rounded-2xl border border-slate-800 p-8 flex flex-col items-center text-center hover:bg-slate-800/50 transition-all duration-300 group">
                                                {trophy.imageUrl.includes('/') ? (
                                                    <img src={trophy.imageUrl} alt={trophy.name} className="w-32 h-32 mb-8 object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform duration-500" />
                                                ) : (
                                                    <div className="text-7xl mb-8 drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform duration-500">{trophy.imageUrl}</div>
                                                )}
                                                <h4 className="font-black text-lg text-slate-100 uppercase tracking-tight leading-tight mb-4">{trophy.name}</h4>
                                                <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-xl border border-slate-700 shadow-inner w-full justify-center">
                                                    {winner?.logoPath && <img src={winner.logoPath} alt="Winner" className="w-8 h-8 object-contain" />}
                                                    <span className="font-bold text-slate-300 text-sm">{winner?.name}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                        {sortedSeasonsForHof.length === 0 && <p className="text-slate-500 uppercase font-bold tracking-widest p-16 text-center bg-slate-900 rounded-3xl border border-dashed border-slate-800">Inga pokaler har delats ut ännu.</p>}
                    </div>
                )}
            </div>
          )}

          {activeMainTab === 'admin' && (
            <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="bg-slate-950/50 px-8 py-6 border-b border-slate-800 flex space-x-8 overflow-x-auto">
                    <button onClick={() => setTab('admin', 'ceremonies')} className={`font-black text-xs tracking-widest uppercase transition-colors whitespace-nowrap ${activeSubTab === 'ceremonies' ? 'text-[var(--active-theme)] drop-shadow-[0_0_8px_var(--active-theme)]' : 'text-slate-500 hover:text-slate-300'}`}>Ceremonier</button>
                    <button onClick={() => setTab('admin', 'teams')} className={`font-black text-xs tracking-widest uppercase transition-colors whitespace-nowrap ${activeSubTab === 'teams' ? 'text-[var(--active-theme)] drop-shadow-[0_0_8px_var(--active-theme)]' : 'text-slate-500 hover:text-slate-300'}`}>Laghantering</button>
                    {activeSeason?.phase === 'OFF_SEASON' && (
                        <button onClick={() => setTab('admin', 'awards')} className={`font-bold text-xs tracking-widest uppercase transition-colors whitespace-nowrap ${activeSubTab === 'awards' ? 'text-[var(--active-theme)] drop-shadow-[0_0_8px_var(--active-theme)]' : 'text-slate-500 hover:text-slate-300'}`}>Prisutdelning</button>
                    )}
                </div>
                
                <div className="p-8 md:p-12 min-h-[500px]">
                    {activeSubTab === 'ceremonies' && (
                        <div className="max-w-3xl">
                            <h2 className="text-3xl font-black text-white mb-10 border-b border-slate-800 pb-4 uppercase tracking-widest">Ritualer & Faser</h2>
                            <div className="p-8 bg-slate-950/50 border border-slate-800 rounded-2xl shadow-inner space-y-8">
                                {activeSeason?.phase === 'PRE_SEASON' && (
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
                                        <div>
                                            <h3 className="font-black text-xl text-slate-100 uppercase tracking-widest mb-2">1. Skapa Spelschema</h3>
                                            <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">Genererar ligan och lottar Champions League.</p>
                                        </div>
                                        <button onClick={handleGenerateSchedule} disabled={loading} className="shrink-0 bg-[var(--active-theme)] hover:opacity-80 text-black font-black uppercase tracking-widest py-4 px-8 rounded-xl shadow-[0_0_20px_var(--active-theme)] transition-all">Skapa Omgångar</button>
                                    </div>
                                )}
                                {activeSeason?.phase === 'REGULAR_SEASON' && (
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
                                        <div>
                                            <h3 className="font-bold text-xl text-slate-100 uppercase tracking-widest mb-2">2. Initiera Slutspel</h3>
                                            <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">Bygger slutspelsträdet, Kvalet och Bottenstriden.</p>
                                        </div>
                                        {isRegularSeasonDone ? ( <button onClick={handleInitiatePlayoffs} disabled={loading} className="shrink-0 bg-[var(--active-theme)] hover:opacity-80 text-black font-black uppercase tracking-widest py-4 px-8 rounded-xl shadow-[0_0_20px_var(--active-theme)] animate-pulse transition-all">Initiera Slutspel</button> ) : ( <div className="shrink-0 text-xs font-black uppercase tracking-widest text-[var(--active-theme)] bg-[var(--active-theme)]/10 px-6 py-4 rounded-xl border border-[var(--active-theme)]/30">Spela klart grundserien först</div> )}
                                    </div>
                                )}
                                {activeSeason?.phase === 'PLAYOFFS' && (
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                        <div>
                                            <h3 className="font-bold text-xl text-slate-100 uppercase tracking-widest mb-2">3. Prisutdelning</h3>
                                            <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">Avslutar matchspelet och delar ut säsongens pokaler.</p>
                                        </div>
                                        {isPlayoffsDone ? ( <button onClick={handleAwardCeremony} disabled={loading} className="shrink-0 bg-[var(--active-theme)] hover:opacity-80 text-black font-black uppercase tracking-widest py-4 px-8 rounded-xl shadow-[0_0_20px_var(--active-theme)] animate-pulse transition-all">Starta Ceremoni</button> ) : ( <div className="shrink-0 text-xs font-black uppercase tracking-widest text-[var(--active-theme)] bg-[var(--active-theme)]/10 px-6 py-4 rounded-xl border border-[var(--active-theme)]/30">Spela klart slutspelet först</div> )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeSubTab === 'teams' && (
                        <div className="max-w-5xl mx-auto">
                            <div className="mb-12 border-b border-slate-800 pb-6 flex items-center justify-between">
                                <h2 className="text-3xl font-black text-white uppercase tracking-widest">Nationernas Identitet</h2>
                                <p className="text-xs font-black text-slate-500 uppercase tracking-widest bg-slate-950 px-4 py-2 rounded-lg border border-slate-800">Databas Redigerare</p>
                            </div>

                            {editingTeam ? (
                                <form onSubmit={handleUpdateTeam} className="bg-slate-950/50 p-10 rounded-3xl border border-slate-800 shadow-2xl mb-12 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-[var(--active-theme)]"></div>
                                    <h3 className="text-2xl font-black text-white mb-8 flex items-center gap-6 uppercase tracking-widest">
                                        {editingTeam.logoPath ? ( <img src={editingTeam.logoPath} alt="logo" className="w-12 h-12 object-contain" /> ) : ( <div className="w-12 h-12 rounded" style={{backgroundColor: editingTeam.primaryColor}}></div> )}
                                        Redigera {editingTeam.name}
                                    </h3>
                                    <div className="space-y-8">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--active-theme)] mb-3">Logotyp (Lokal fil eller URL)</label>
                                            <input type="text" name="logoPath" defaultValue={editingTeam.logoPath || ''} placeholder="/logos/sweden.png" className="w-full px-6 py-4 rounded-xl border border-slate-700 focus:ring-2 focus:ring-[var(--active-theme)] focus:border-[var(--active-theme)] font-medium bg-slate-900 text-white" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--active-theme)] mb-3">Primär Färg</label>
                                                <input type="color" name="primaryColor" defaultValue={editingTeam.primaryColor} className="w-full h-16 p-1 rounded-xl cursor-pointer border border-slate-700 bg-slate-900" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--active-theme)] mb-3">Sekundär Färg</label>
                                                <input type="color" name="secondaryColor" defaultValue={editingTeam.secondaryColor || '#ffffff'} className="w-full h-16 p-1 rounded-xl cursor-pointer border border-slate-700 bg-slate-900" />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-[var(--active-theme)] mb-3">Tertiär Färg</label>
                                                <input type="color" name="tertiaryColor" defaultValue={editingTeam.tertiaryColor || '#ffffff'} className="w-full h-16 p-1 rounded-xl cursor-pointer border border-slate-700 bg-slate-900" />
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest border-l-2 border-slate-700 pl-4 py-1">Dessa tre färger används för att generera ländernas roterande The Heritage-Aura på deras respektive Lagsida.</p>
                                    </div>
                                    <div className="flex gap-4 mt-10 pt-8 border-t border-slate-800">
                                        <button type="submit" disabled={loading} className="bg-[var(--active-theme)] hover:opacity-80 text-black font-black uppercase tracking-widest py-4 px-10 rounded-xl shadow-[0_0_20px_var(--active-theme)] transition-all">Spara Ändringar</button>
                                        <button type="button" onClick={() => setEditingTeam(null)} disabled={loading} className="bg-transparent hover:bg-slate-800 text-slate-300 font-black uppercase tracking-widest py-4 px-8 rounded-xl border border-slate-700 transition-colors">Avbryt</button>
                                    </div>
                                </form>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                                    {globalEloTeams.map(team => (
                                        <div key={team.id} onClick={() => setEditingTeam(team)} className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 shadow-sm hover:shadow-[0_0_15px_var(--active-theme)] hover:border-[var(--active-theme)] cursor-pointer transition-all text-center flex flex-col items-center group">
                                            <div className="w-16 h-16 rounded-full shadow-inner border border-slate-800 mb-4 flex items-center justify-center p-3 relative overflow-hidden group-hover:scale-110 transition-transform" style={{ backgroundColor: team.primaryColor }}>
                                                {team.logoPath && <img src={team.logoPath} alt={team.name} className="w-full h-full object-contain drop-shadow-md" />}
                                                {!team.logoPath && <div className="absolute inset-0 bg-black/20"></div>}
                                            </div>
                                            <span className="font-bold text-sm text-slate-200 truncate w-full group-hover:text-[var(--active-theme)] transition-colors">{team.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeSubTab === 'awards' && (
                        <div className="max-w-5xl mx-auto space-y-24">
                            <div className="text-center">
                                <h2 className="text-5xl font-black text-white uppercase tracking-widest drop-shadow-[0_0_15px_var(--active-theme)] mb-4">The Heritage Ceremony</h2>
                                <p className="text-[var(--active-theme)] font-black uppercase tracking-widest bg-[var(--active-theme)]/10 border border-[var(--active-theme)]/30 px-6 py-2 rounded-full inline-block">{activeSeason?.name}</p>
                            </div>
                            
                            {/* SEKTION 1: HUVUDPOKALERNA (Sorteras via TROPHY_ORDER) */}
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-8 border-b border-slate-800 pb-3">Säsongens Triumfer</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                                    {sortedCurrentSeasonTrophies.map((trophy: any) => {
                                        const winner = initialTeams.find(t => t.id === trophy.teamId);
                                        return (
                                            <div key={trophy.id} className="bg-slate-950/50 rounded-3xl shadow-xl border border-slate-800 p-8 flex flex-col items-center text-center relative overflow-hidden group hover:border-[var(--active-theme)] transition-colors">
                                                <div className="absolute inset-0 bg-gradient-to-br from-[var(--active-theme)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                                {trophy.imageUrl.includes('/') ? (
                                                    <img src={trophy.imageUrl} alt={trophy.name} className="w-32 h-32 mb-6 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform duration-500" />
                                                ) : (
                                                    <div className="text-7xl mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform duration-500">{trophy.imageUrl}</div>
                                                )}
                                                <h3 className="font-black text-sm text-white uppercase tracking-wider mb-6 h-10 flex items-center justify-center relative z-10">{trophy.name}</h3>
                                                <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 rounded-xl border border-slate-700 shadow-inner relative z-10 w-full justify-center">
                                                    {winner?.logoPath && <img src={winner.logoPath} alt="Winner" className="w-8 h-8 object-contain" />}
                                                    <span className="font-bold text-slate-200 text-sm truncate">{winner?.name}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* SEKTION 2: EXTRAORDINÄRA INSATSER */}
                            {seasonAwardsStats && (
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-8 border-b border-slate-800 pb-3">Extraordinära Insatser</h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center">
                                            <span className="text-3xl mb-3 drop-shadow-md">🌟</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Flest Achievements</span>
                                            <span className="text-2xl font-black text-white">{seasonAwardsStats.mostAchievements.count}</span>
                                            <span className="text-xs font-bold text-[var(--active-theme)] mt-2">{seasonAwardsStats.mostAchievements.team?.name}</span>
                                        </div>
                                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center">
                                            <span className="text-3xl mb-3 drop-shadow-md">🚀</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Längst Win-Streak</span>
                                            <span className="text-2xl font-black text-white">{seasonAwardsStats.longestStreak.count} V</span>
                                            <span className="text-xs font-bold text-[var(--active-theme)] mt-2">{seasonAwardsStats.longestStreak.team?.name}</span>
                                        </div>
                                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center">
                                            <span className="text-3xl mb-3 drop-shadow-md">⚔️</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Flest Gjorda Mål</span>
                                            <span className="text-2xl font-black text-white">{seasonAwardsStats.mostGoals.count} p</span>
                                            <span className="text-xs font-bold text-[var(--active-theme)] mt-2">{seasonAwardsStats.mostGoals.team?.name}</span>
                                        </div>
                                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center">
                                            <span className="text-3xl mb-3 drop-shadow-md">🛡️</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Minst Insläppta Mål</span>
                                            <span className="text-2xl font-black text-white">{seasonAwardsStats.leastGoals.count < 9999 ? seasonAwardsStats.leastGoals.count : '-'} p</span>
                                            <span className="text-xs font-bold text-[var(--active-theme)] mt-2">{seasonAwardsStats.leastGoals.team?.name || '-'}</span>
                                        </div>
                                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center">
                                            <span className="text-3xl mb-3 drop-shadow-md">🔥</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Flest 50's Club</span>
                                            <span className="text-2xl font-black text-white">{seasonAwardsStats.most50s.count}</span>
                                            <span className="text-xs font-bold text-[var(--active-theme)] mt-2">{seasonAwardsStats.most50s.team?.name}</span>
                                        </div>
                                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center">
                                            <span className="text-3xl mb-3 drop-shadow-md">🧱</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Flest Lockdowns</span>
                                            <span className="text-2xl font-black text-white">{seasonAwardsStats.mostLockdowns.count}</span>
                                            <span className="text-xs font-bold text-[var(--active-theme)] mt-2">{seasonAwardsStats.mostLockdowns.team?.name}</span>
                                        </div>
                                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center">
                                            <span className="text-3xl mb-3 drop-shadow-md">🧹</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Flest Clean Sheets</span>
                                            <span className="text-2xl font-black text-white">{seasonAwardsStats.mostCleanSheets.count}</span>
                                            <span className="text-xs font-bold text-[var(--active-theme)] mt-2">{seasonAwardsStats.mostCleanSheets.team?.name}</span>
                                        </div>
                                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center">
                                            <span className="text-3xl mb-3 drop-shadow-md">😬</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Flest Nail-Biters</span>
                                            <span className="text-2xl font-black text-white">{seasonAwardsStats.mostNailbiters.count}</span>
                                            <span className="text-xs font-bold text-[var(--active-theme)] mt-2">{seasonAwardsStats.mostNailbiters.team?.name}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* SEKTION 3: KVALET (UPP & NED) */}
                            {relegationData && (
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-8 border-b border-slate-800 pb-3">Kval & Uppflyttning</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="bg-emerald-950/30 border border-emerald-900/50 p-8 rounded-3xl relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
                                            <h4 className="text-emerald-500 font-black uppercase tracking-widest mb-6 text-sm">Välkommen till Elitserien</h4>
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                                                    {relegationData.promotedDirect?.logoPath && <img src={relegationData.promotedDirect.logoPath} className="w-10 h-10 object-contain" />}
                                                    <div>
                                                        <div className="font-bold text-slate-200 text-lg">{relegationData.promotedDirect?.name}</div>
                                                        <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Direktuppflyttad</div>
                                                    </div>
                                                </div>
                                                {relegationData.k1Winner && (
                                                    <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                                                        {relegationData.k1Winner.logoPath && <img src={relegationData.k1Winner.logoPath} className="w-10 h-10 object-contain" />}
                                                        <div>
                                                            <div className="font-bold text-slate-200 text-lg">{relegationData.k1Winner.name}</div>
                                                            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Vann Kval 1</div>
                                                        </div>
                                                    </div>
                                                )}
                                                {relegationData.k2Winner && (
                                                    <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                                                        {relegationData.k2Winner.logoPath && <img src={relegationData.k2Winner.logoPath} className="w-10 h-10 object-contain" />}
                                                        <div>
                                                            <div className="font-bold text-slate-200 text-lg">{relegationData.k2Winner.name}</div>
                                                            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Vann Kval 2</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-red-950/30 border border-red-900/50 p-8 rounded-3xl relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-2 h-full bg-red-500"></div>
                                            <h4 className="text-red-500 font-black uppercase tracking-widest mb-6 text-sm">Degraderade till Superettan</h4>
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                                                    {relegationData.relegatedDirect?.logoPath && <img src={relegationData.relegatedDirect.logoPath} className="w-10 h-10 object-contain" />}
                                                    <div>
                                                        <div className="font-bold text-slate-200 text-lg">{relegationData.relegatedDirect?.name}</div>
                                                        <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">Direktnedflyttad</div>
                                                    </div>
                                                </div>
                                                {relegationData.k1Loser && (
                                                    <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                                                        {relegationData.k1Loser.logoPath && <img src={relegationData.k1Loser.logoPath} className="w-10 h-10 object-contain" />}
                                                        <div>
                                                            <div className="font-bold text-slate-200 text-lg">{relegationData.k1Loser.name}</div>
                                                            <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">Förlorade Kval 1</div>
                                                        </div>
                                                    </div>
                                                )}
                                                {relegationData.k2Loser && (
                                                    <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                                                        {relegationData.k2Loser.logoPath && <img src={relegationData.k2Loser.logoPath} className="w-10 h-10 object-contain" />}
                                                        <div>
                                                            <div className="font-bold text-slate-200 text-lg">{relegationData.k2Loser.name}</div>
                                                            <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">Förlorade Kval 2</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-slate-950 p-12 rounded-3xl shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-slate-800 text-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-amber-500"></div>
                                <h3 className="text-3xl font-black text-white uppercase tracking-widest mb-4">Starta Nästa Kapitel</h3>
                                <p className="text-slate-500 mb-10 font-bold uppercase tracking-widest text-xs max-w-2xl mx-auto">Genom att fortsätta kommer upp- och nedflyttning från Kval och Bottenstriden att genomföras. Denna säsong arkiveras permanent till The Heritage, och ett blankt blad skapas för nästa säsong.</p>
                                <button onClick={handleStartNextSeason} disabled={loading} className="w-full py-5 text-2xl font-black bg-gradient-to-r from-[var(--active-theme)] to-emerald-400 hover:opacity-80 text-black rounded-2xl shadow-[0_0_30px_var(--active-theme)] transition-all uppercase tracking-widest animate-pulse">
                                    Genomför Flytt & Starta Ny Säsong
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  )
}