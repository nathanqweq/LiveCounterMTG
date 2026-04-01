import { PLAYER_COLORS } from "./constants.js";

export const state = {
  mode: null,
  player: null,
  roomId: null,
  players: {},
  deathEventReady: false,
  lastSeenDeathEventId: null,
  selectedColorId: PLAYER_COLORS[0].id,
  localPlayerSequence: 1,
  editingLocalPlayerId: null
};
