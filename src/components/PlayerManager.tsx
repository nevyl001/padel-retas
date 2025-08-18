import React, { useState, useEffect } from "react";
import {
  createPlayer,
  getPlayers,
  deletePlayer,
  Player,
} from "../lib/database";

interface PlayerManagerProps {
  onPlayerSelect?: (players: Player[]) => void;
  selectedPlayers?: Player[];
  allowMultipleSelection?: boolean;
  playersInPairs?: string[]; // IDs de jugadores que ya están en parejas
}

export const PlayerManager: React.FC<PlayerManagerProps> = ({
  onPlayerSelect,
  selectedPlayers = [],
  allowMultipleSelection = false,
  playersInPairs = [],
}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      const data = await getPlayers();
      setPlayers(data);
    } catch (err) {
      setError("Error al cargar los jugadores");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    try {
      setError("");
      const player = await createPlayer(newPlayerName.trim());
      setPlayers([...players, player]);
      setNewPlayerName("");
      setShowCreateForm(false);
    } catch (err) {
      setError("Error al crear el jugador");
      console.error(err);
    }
  };

  const handleDeletePlayer = async (id: string) => {
    if (
      !window.confirm(
        "¿Estás seguro de que quieres eliminar este jugador? Esta acción no se puede deshacer."
      )
    ) {
      return;
    }

    try {
      setError("");
      await deletePlayer(id);
      setPlayers(players.filter((p) => p.id !== id));
    } catch (err) {
      setError("Error al eliminar el jugador");
      console.error(err);
    }
  };

  const handlePlayerSelect = (player: Player) => {
    // Verificar si el jugador ya está en una pareja
    if (playersInPairs.includes(player.id)) {
      console.log(`🚨 JUGADOR BLOQUEADO: ${player.name} ya está en una pareja`);
      alert(
        `No puedes seleccionar a ${player.name} porque ya está en una pareja. Debes eliminar su pareja actual primero.`
      );
      return;
    }

    if (onPlayerSelect) {
      if (allowMultipleSelection) {
        const isSelected = selectedPlayers.some((p) => p.id === player.id);
        if (isSelected) {
          // Deseleccionar el jugador si ya está seleccionado
          onPlayerSelect(selectedPlayers.filter((p) => p.id !== player.id));
        } else {
          onPlayerSelect([...selectedPlayers, player]);
        }
      } else {
        onPlayerSelect([player]);
      }
    }
  };

  if (loading) {
    return <div className="loading">Cargando jugadores...</div>;
  }

  return (
    <div className="player-manager">
      <div className="player-header">
        <h3>👥 Jugadores ({players.length})</h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="create-player-btn"
        >
          {showCreateForm ? "❌ Cancelar" : "➕ Agregar"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {showCreateForm && (
        <div className="create-player-form">
          <h4>Agregar Nuevo Jugador</h4>
          <form onSubmit={handleCreatePlayer}>
            <div className="form-group">
              <label htmlFor="player-name">Nombre del Jugador:</label>
              <input
                id="player-name"
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                required
                autoFocus
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="submit-btn">
                ✅ Agregar Jugador
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewPlayerName("");
                }}
                className="cancel-btn"
              >
                ❌ Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {players.length === 0 ? (
        <div className="no-players">
          <p>📝 No hay jugadores registrados aún</p>
          <p>Agrega jugadores para poder crear parejas</p>
        </div>
      ) : (
        <div className="jugadores-grid">
          {players.map((player) => {
            const isSelected = selectedPlayers.some((p) => p.id === player.id);
            const isInPair = playersInPairs.includes(player.id);

            return (
              <div
                key={player.id}
                className={`jugador-card ${isSelected ? "seleccionado" : ""} ${
                  isInPair ? "en-pareja" : ""
                }`}
                onClick={() => handlePlayerSelect(player)}
              >
                <div className="jugador-info">
                  <span className="jugador-nombre">{player.name}</span>
                  {isInPair && <span className="indicador-pareja">👥</span>}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePlayer(player.id);
                  }}
                  className="eliminar-jugador-btn"
                  title="Eliminar jugador"
                >
                  🗑️
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
