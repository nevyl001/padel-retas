import React, { useState, useEffect, useMemo } from "react";
import {
  getPairs,
  getMatches,
  getGames,
  Match,
  Game,
  Pair,
} from "../lib/database";
import "./ModernStandingsTable.css";

interface PairWithStats {
  id: string;
  tournament_id: string;
  player1_id: string;
  player2_id: string;
  player1_name: string;
  player2_name: string;
  created_at: string;
  // Estadísticas calculadas en tiempo real
  gamesWon: number;
  setsWon: number;
  points: number;
  matchesPlayed: number;
  player1?: {
    id: string;
    name: string;
  };
  player2?: {
    id: string;
    name: string;
  };
}

interface RealTimeStandingsTableProps {
  tournamentId: string;
  forceRefresh: number;
}

const RealTimeStandingsTable: React.FC<RealTimeStandingsTableProps> = ({
  tournamentId,
  forceRefresh,
}) => {
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (tournamentId) {
      loadTournamentData();
    }
  }, [tournamentId, forceRefresh]);

  const loadTournamentData = async () => {
    if (!tournamentId) return;

    try {
      setLoading(true);
      setError("");

      const [pairsData, matchesData] = await Promise.all([
        getPairs(tournamentId),
        getMatches(tournamentId),
      ]);

      setPairs(pairsData);
      setMatches(matchesData);

      // Cargar todos los juegos de todos los partidos
      const gamesPromises = matchesData.map((match) => getGames(match.id));
      const gamesArrays = await Promise.all(gamesPromises);
      const allGamesData = gamesArrays.flat();
      setAllGames(allGamesData);
    } catch (error) {
      console.error("Error cargando datos:", error);
      setError("Error al cargar los datos de la reta");
    } finally {
      setLoading(false);
    }
  };

  // Función para calcular estadísticas de un partido
  const calculateMatchStats = (match: Match, games: Game[]) => {
    let pair1GamesWon = 0;
    let pair2GamesWon = 0;
    let pair1SetsWon = 0;
    let pair2SetsWon = 0;
    let pair1TotalPoints = 0;
    let pair2TotalPoints = 0;

    games.forEach((game) => {
      if (game.is_tie_break) {
        // Para tie-breaks
        if (game.tie_break_pair1_points > game.tie_break_pair2_points) {
          pair1GamesWon++;
        } else if (game.tie_break_pair2_points > game.tie_break_pair1_points) {
          pair2GamesWon++;
        }
        pair1TotalPoints += game.tie_break_pair1_points || 0;
        pair2TotalPoints += game.tie_break_pair2_points || 0;
      } else {
        // Para juegos normales
        if (game.pair1_games > game.pair2_games) {
          pair1GamesWon++;
        } else if (game.pair2_games > game.pair1_games) {
          pair2GamesWon++;
        }
        pair1TotalPoints += game.pair1_games;
        pair2TotalPoints += game.pair2_games;

        // Verificar si alguna pareja llegó a 6 puntos en este juego (gana 1 set)
        if (game.pair1_games >= 6) {
          pair1SetsWon++;
        }
        if (game.pair2_games >= 6) {
          pair2SetsWon++;
        }
      }
    });

    return {
      pair1GamesWon,
      pair2GamesWon,
      pair1SetsWon,
      pair2SetsWon,
      pair1TotalPoints,
      pair2TotalPoints,
    };
  };

  // Calcular estadísticas en tiempo real
  const pairsWithStats = useMemo((): PairWithStats[] => {
    if (!pairs.length || !matches.length) {
      return pairs.map((pair) => ({
        ...pair,
        gamesWon: 0,
        setsWon: 0,
        points: 0,
        matchesPlayed: 0,
      }));
    }

    // Crear mapa de estadísticas por pareja
    const pairStats = new Map<
      string,
      {
        gamesWon: number;
        setsWon: number;
        points: number;
        matchesPlayed: number;
      }
    >();

    // Inicializar estadísticas para todas las parejas
    pairs.forEach((pair) => {
      pairStats.set(pair.id, {
        gamesWon: 0,
        setsWon: 0,
        points: 0,
        matchesPlayed: 0,
      });
    });

    // Procesar partidos finalizados
    matches.forEach((match) => {
      if (match.status === "finished") {
        // Obtener juegos de este partido específico
        const matchGames = allGames.filter(
          (game) => game.match_id === match.id
        );

        if (matchGames.length > 0) {
          // Calcular estadísticas del partido
          const matchStats = calculateMatchStats(match, matchGames);

          // Acumular estadísticas
          const pair1Stats = pairStats.get(match.pair1_id);
          const pair2Stats = pairStats.get(match.pair2_id);

          if (pair1Stats && pair2Stats) {
            // Incrementar partidos jugados
            pair1Stats.matchesPlayed += 1;
            pair2Stats.matchesPlayed += 1;

            // Acumular estadísticas del partido
            pair1Stats.gamesWon += matchStats.pair1GamesWon;
            pair1Stats.setsWon += matchStats.pair1SetsWon;
            pair1Stats.points += matchStats.pair1TotalPoints;

            pair2Stats.gamesWon += matchStats.pair2GamesWon;
            pair2Stats.setsWon += matchStats.pair2SetsWon;
            pair2Stats.points += matchStats.pair2TotalPoints;
          }
        }
      }
    });

    // Convertir a array con estadísticas
    return pairs.map((pair) => {
      const stats = pairStats.get(pair.id) || {
        gamesWon: 0,
        setsWon: 0,
        points: 0,
        matchesPlayed: 0,
      };

      return {
        ...pair,
        ...stats,
      };
    });
  }, [pairs, matches, allGames]);

  // Ordenar parejas por ranking
  const sortedPairs = useMemo(() => {
    return [...pairsWithStats].sort((a, b) => {
      // Primero por puntos (descendente)
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      // Luego por sets ganados (descendente)
      if (b.setsWon !== a.setsWon) {
        return b.setsWon - a.setsWon;
      }
      // Finalmente por juegos ganados (descendente)
      if (b.gamesWon !== a.gamesWon) {
        return b.gamesWon - a.gamesWon;
      }
      // Si todo es igual, ordenar alfabéticamente
      const nameA = `${a.player1_name}/${a.player2_name}`;
      const nameB = `${b.player1_name}/${b.player2_name}`;
      return nameA.localeCompare(nameB);
    });
  }, [pairsWithStats]);

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return "";
    }
  };

  const recalculateStatistics = async () => {
    await loadTournamentData();
  };

  if (loading) {
    return (
      <div className="new-standings-container">
        <div className="new-standings-header">
          <h2>📊 Clasificación</h2>
        </div>
        <div className="new-loading-state">
          <div className="new-loading-spinner"></div>
          <p>Cargando clasificación...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="new-standings-container">
      <div className="new-standings-header">
        <h2>📊 Clasificación</h2>
        <button
          onClick={recalculateStatistics}
          className="new-recalculate-button"
          disabled={loading}
        >
          🔄 Recalcular
        </button>
      </div>

      <div className="new-standings-table-wrapper">
        <table className="new-standings-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Pareja</th>
              <th>Sets</th>
              <th>Partidos</th>
              <th>Puntos</th>
            </tr>
          </thead>
          <tbody>
            {sortedPairs.map((pair, index) => (
              <tr
                key={pair.id}
                className={
                  index === 0
                    ? "new-first-place"
                    : index === 1
                    ? "new-second-place"
                    : index === 2
                    ? "new-third-place"
                    : "new-normal-place"
                }
              >
                <td className="new-position-cell">
                  <span className="new-position-number">{index + 1}</span>
                  <span className="new-position-icon">
                    {getPositionIcon(index + 1)}
                  </span>
                </td>
                <td className="new-team-cell">
                  {pair.player1_name} / {pair.player2_name}
                </td>
                <td className="new-stats-cell">{pair.setsWon}</td>
                <td className="new-stats-cell">{pair.matchesPlayed}</td>
                <td className="new-points-cell">{pair.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedPairs.length === 0 && (
        <div className="new-empty-state">
          <p>📝 No hay parejas registradas en esta reta</p>
        </div>
      )}

      {error && (
        <div className="new-error-state">
          <p>❌ {error}</p>
        </div>
      )}
    </div>
  );
};

export default RealTimeStandingsTable;
