import { MAX_NAME_LENGTH, PLAYER_COLORS } from "./constants.js";

export function normalizePlayerName(value) {
  return value.trim().slice(0, MAX_NAME_LENGTH);
}

export function getPlayerColor(colorId) {
  return PLAYER_COLORS.find((color) => color.id === colorId) || PLAYER_COLORS[0];
}

export function isPlayerDead(target) {
  return Boolean(target?.dead);
}

export function getCommanderDeath(target, attackerId, amount) {
  const current = target.commanderDamageReceived || {};
  const totalDamage = (current[attackerId] || 0) + amount;

  return {
    current,
    totalDamage,
    diedFromCommander: totalDamage >= 21
  };
}

export function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}
