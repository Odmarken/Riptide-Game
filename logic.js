/* Riptide Legion — cloud account vault.
   Runs inside the platform's room kernel: each account name is one room,
   the room's persistent state holds that account's save data.
   The playerId is a hash of (account name + password) computed in the
   player's browser — whoever presents the owner's hash owns the vault;
   everyone else is a spectator who sees nothing. */

export const meta = { game: "riptide-legion", minPlayers: 1, maxPlayers: 1 };

export function setup(players) {
  /* First joiner claims the vault — that IS account creation. */
  return { owner: players[0], data: null, updated: 0 };
}

export function validateAction(state, playerId, action) {
  if (playerId !== state.owner) {
    return { ok: false, error: "Wrong account name or password." };
  }
  if (!action || action.type !== "save") {
    return { ok: false, error: "Unknown action." };
  }
  let s;
  try { s = JSON.stringify(action.data); }
  catch (e) { return { ok: false, error: "Unreadable save data." }; }
  if (!s || s.length > 400000) {
    return { ok: false, error: "Save data too large." };
  }
  return { ok: true };
}

export function applyAction(state, playerId, action) {
  return { ...state, data: action.data, updated: Date.now() };
}

export function isGameOver() {
  return { over: false }; /* a vault never ends */
}

export function viewFor(state, playerId) {
  if (playerId === state.owner) {
    return { owner: true, data: state.data, updated: state.updated };
  }
  return { owner: false };
}
