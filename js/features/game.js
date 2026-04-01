import { LOCAL_PLAYER_LIMIT, PLAYER_COLORS } from "../core/constants.js";
import { db, onValue, ref, set, update } from "../services/firebase.js";
import { state } from "../core/state.js";
import { showDeathModal, showDeathModalForEvent } from "./modals.js";
import { getCommanderDeath, getPlayerColor, isPlayerDead, normalizePlayerName } from "../core/utils.js";

function updatePlayerLife(targetId, nextLife, extraData = {}) {
  const targetIsDead = nextLife <= 0;

  update(ref(db, `rooms/${state.roomId}/players/${targetId}`), {
    life: Math.max(nextLife, 0),
    dead: targetIsDead,
    ...extraData
  });

  return targetIsDead;
}

function buildDeathEvent(target, reason) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    killerId: state.player?.id || null,
    killerName: state.player?.name || "Desconhecido",
    victimId: target.id,
    victimName: target.name,
    reason,
    createdAt: Date.now()
  };
}

function publishDeathEvent(target, reason) {
  const deathEvent = buildDeathEvent(target, reason);

  state.lastSeenDeathEventId = deathEvent.id;
  set(ref(db, `rooms/${state.roomId}/events/lastDeath`), deathEvent);
  showDeathModalForEvent(deathEvent);
}

function listenRoom() {
  onValue(ref(db, `rooms/${state.roomId}/players`), (snap) => {
    const data = snap.val();
    if (!data) return;

    state.players = data;
    if (state.player?.id && state.players[state.player.id]) {
      state.player = {
        ...state.player,
        ...state.players[state.player.id]
      };
    }
    renderAllPlayers();
  });
}

function listenDeathEvents() {
  state.deathEventReady = false;
  state.lastSeenDeathEventId = null;

  onValue(ref(db, `rooms/${state.roomId}/events/lastDeath`), (snap) => {
    const deathEvent = snap.val();

    if (!state.deathEventReady) {
      state.deathEventReady = true;
      state.lastSeenDeathEventId = deathEvent?.id || null;
      return;
    }

    if (!deathEvent?.id || deathEvent.id === state.lastSeenDeathEventId) return;

    state.lastSeenDeathEventId = deathEvent.id;
    showDeathModalForEvent(deathEvent);
  });
}

export function start(name) {
  state.mode = "online";
  state.players = {};
  state.localPlayerSequence = 1;
  state.deathEventReady = false;
  state.lastSeenDeathEventId = null;
  state.player = {
    id: Math.random().toString(36).substring(2),
    name,
    colorId: state.selectedColorId,
    life: 40,
    dead: false,
    commanderDamageDealt: {},
    commanderDamageReceived: {}
  };

  document.getElementById("roomCode").innerText = state.roomId;
  document.getElementById("lobby").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");
  document.body.classList.add("is-in-game");

  set(ref(db, `rooms/${state.roomId}/players/${state.player.id}`), state.player);

  listenRoom();
  listenDeathEvents();
}

export function startSingleDeviceMode() {
  state.mode = "local";
  state.roomId = "LOCAL";
  state.player = null;
  state.players = {};
  state.localPlayerSequence = 1;
  state.editingLocalPlayerId = null;
  state.deathEventReady = false;
  state.lastSeenDeathEventId = null;

  document.getElementById("lobby").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");
  document.body.classList.add("is-in-game");

  renderAllPlayers();
}

export function renderAllPlayers() {
  if (state.mode === "local") {
    renderLocalBoard();
    return;
  }

  const container = document.getElementById("game");
  const allPlayers = Object.values(state.players).sort((a, b) => a.name.localeCompare(b.name));
  const currentPlayer = allPlayers.find((p) => p.id === state.player.id) || state.player;
  const opponents = allPlayers.filter((p) => p.id !== state.player.id);
  const opponentLayoutClass = `opponents-grid--${Math.min(Math.max(opponents.length, 1), 4)}`;

  container.innerHTML = `
    <div class="board">
      <div class="board__hud">
        <div>
          <p class="eyebrow">Sala ativa</p>
          <h2 class="room-code">${state.roomId}</h2>
        </div>
        <div class="room-pill">${allPlayers.length} players</div>
      </div>

      ${renderPlayerCard(currentPlayer, true)}

      <div class="opponents-grid ${opponentLayoutClass}">
        ${opponents.map((opponent) => renderPlayerCard(opponent, false)).join("")}
      </div>
    </div>
  `;
}

function renderLocalBoard() {
  const container = document.getElementById("game");
  const localPlayers = Object.values(state.players).sort((a, b) => a.order - b.order);
  const slots = Array.from({ length: LOCAL_PLAYER_LIMIT }, (_, index) => localPlayers[index] || null);

  container.innerHTML = `
    <div class="board board--local">
      <div class="board__hud">
        <div>
          <p class="eyebrow">Modo local</p>
          <h2 class="room-code">Um celular</h2>
        </div>
        <div class="room-pill">${localPlayers.length}/${LOCAL_PLAYER_LIMIT} players</div>
      </div>

      <div class="opponents-grid opponents-grid--4 local-grid">
        ${slots.map((player, index) => player ? renderLocalPlayerCard(player) : renderAddPlayerSlot(index)).join("")}
      </div>
    </div>
  `;
}

function renderAddPlayerSlot(index) {
  return `
    <button class="add-player-slot" type="button" onclick="addLocalPlayer(${index})" aria-label="Adicionar jogador">
      <span class="add-player-slot__plus">+</span>
      <span class="add-player-slot__label">Adicionar jogador</span>
    </button>
  `;
}

function renderLocalPlayerCard(target) {
  const dead = isPlayerDead(target);
  const playerColor = getPlayerColor(target.colorId);
  const commanderButtons = Object.values(state.players)
    .filter((player) => player.id !== target.id && !isPlayerDead(player))
    .sort((a, b) => a.order - b.order)
    .map((attacker) => `
      <button class="counter-button counter-button--accent counter-button--commander" onclick="applyLocalCommanderDamage('${target.id}', '${attacker.id}')">
        Com. -1 ${attacker.name}
      </button>
    `)
    .join("");
  const commanderDamageSummary = Object.entries(target.commanderDamageReceived || {})
    .filter(([, damage]) => damage > 0)
    .map(([attackerId, damage]) => {
      const attackerName = state.players[attackerId]?.name || "Desconhecido";
      return `<span class="commander-chip">${attackerName}: ${damage}</span>`;
    })
    .join("");
  const actions = dead
    ? `
      <div class="counter-card__actions">
        <span class="counter-card__empty">Eliminado</span>
      </div>
    `
    : `
      <div class="counter-card__actions counter-card__actions--local">
        <button class="counter-button" onclick="changeLocalLife('${target.id}', -1)">-1</button>
        <button class="counter-button counter-button--positive" onclick="changeLocalLife('${target.id}', 1)">+1</button>
      </div>
      <div class="local-commander-actions">
        ${commanderButtons || '<span class="counter-card__empty">Adicione outro jogador para dano de comandante</span>'}
      </div>
    `;

  return `
    <section
      class="counter-card local-player-card${dead ? " counter-card--dead" : ""}"
      style="${dead ? "" : `--player-card-color: ${playerColor.card};`}"
    >
      <div class="counter-card__top">
        <button class="counter-card__name counter-card__name-button" type="button" onclick="renameLocalPlayer('${target.id}')">${target.name}</button>
        <span class="counter-card__status">${dead ? "Morto" : "Ativo"}</span>
      </div>

      <div class="counter-card__body">
        <div class="counter-card__life">${target.life}</div>
        <div class="counter-card__meta">
          <span>Dano Com. recebido:</span>
          <div class="commander-chip-list">
            ${commanderDamageSummary || '<span class="commander-chip">Nenhum</span>'}
          </div>
        </div>
      </div>

      ${actions}
    </section>
  `;
}

function getNextLocalColor() {
  const usedPlayers = Object.values(state.players).length;
  return PLAYER_COLORS[usedPlayers % PLAYER_COLORS.length].id;
}

export function addLocalPlayer() {
  if (state.mode !== "local") return;

  const currentCount = Object.keys(state.players).length;
  if (currentCount >= LOCAL_PLAYER_LIMIT) return;

  const id = `local-${state.localPlayerSequence}`;
  const nextOrder = state.localPlayerSequence;

  state.players[id] = {
    id,
    name: `Jogador ${nextOrder}`,
    colorId: getNextLocalColor(),
    life: 40,
    dead: false,
    order: nextOrder,
    commanderDamageReceived: {}
  };
  state.localPlayerSequence += 1;

  renderAllPlayers();
}

export function renameLocalPlayer(targetId) {
  if (state.mode !== "local") return;

  const target = state.players[targetId];
  if (!target) return;

  const renamePlayerModal = document.getElementById("renamePlayerModal");
  const renamePlayerInput = document.getElementById("renamePlayerInput");
  if (!renamePlayerModal || !renamePlayerInput) return;

  state.editingLocalPlayerId = targetId;
  renamePlayerInput.value = target.name;
  renamePlayerModal.classList.remove("hidden");
  renamePlayerModal.setAttribute("aria-hidden", "false");
  window.requestAnimationFrame(() => {
    renamePlayerInput.focus();
    renamePlayerInput.select();
  });
}

export function closeRenamePlayerModal() {
  const renamePlayerModal = document.getElementById("renamePlayerModal");
  const renamePlayerInput = document.getElementById("renamePlayerInput");
  if (!renamePlayerModal || !renamePlayerInput) return;

  state.editingLocalPlayerId = null;
  renamePlayerInput.value = "";
  renamePlayerModal.classList.add("hidden");
  renamePlayerModal.setAttribute("aria-hidden", "true");
}

export function submitRenamePlayer() {
  if (state.mode !== "local" || !state.editingLocalPlayerId) return;

  const renamePlayerInput = document.getElementById("renamePlayerInput");
  const target = state.players[state.editingLocalPlayerId];
  if (!renamePlayerInput || !target) {
    closeRenamePlayerModal();
    return;
  }

  const nextName = normalizePlayerName(renamePlayerInput.value || "");
  if (!nextName) {
    renamePlayerInput.focus();
    return;
  }

  state.players[state.editingLocalPlayerId] = {
    ...target,
    name: nextName
  };

  closeRenamePlayerModal();
  renderAllPlayers();
}

export function applyLocalCommanderDamage(targetId, attackerId) {
  if (state.mode !== "local") return;

  const target = state.players[targetId];
  const attacker = state.players[attackerId];
  if (!target || !attacker || target.id === attacker.id || isPlayerDead(target) || isPlayerDead(attacker)) return;

  const newLife = Math.max((target.life || 0) - 1, 0);
  const commanderResult = getCommanderDeath(target, attacker.id, 1);

  commanderResult.current[attacker.id] = commanderResult.totalDamage;
  const targetIsDead = newLife <= 0 || commanderResult.diedFromCommander;

  state.players[target.id] = {
    ...target,
    life: newLife,
    dead: targetIsDead,
    commanderDamageReceived: commanderResult.current
  };

  renderAllPlayers();

  if (targetIsDead) {
    const reason = commanderResult.diedFromCommander
      ? `${attacker.name} eliminou ${target.name} com dano de comandante.`
      : `${target.name} foi eliminado.`;

    showDeathModal(`${target.name} morreu`, reason);
  }
}

function renderPlayerCard(target, isCurrentPlayer) {
  const dead = isPlayerDead(target);
  const playerColor = getPlayerColor(target.colorId);
  const commanderDamageFromMe = target.commanderDamageReceived?.[state.player.id] || 0;
  const commanderDamageSummary = isCurrentPlayer
    ? Object.entries(target.commanderDamageReceived || {})
      .filter(([, damage]) => damage > 0)
      .map(([attackerId, damage]) => {
        const attackerName = state.players[attackerId]?.name || "Desconhecido";
        return `<span class="commander-chip">${attackerName}: ${damage}</span>`;
      })
      .join("")
    : "";
  let actions = `
    <div class="counter-card__actions">
      <span class="counter-card__empty">${dead ? "Eliminado" : "Sem acoes"}</span>
    </div>
  `;

  if (!dead && !isPlayerDead(state.player)) {
    actions = isCurrentPlayer
      ? `
        <div class="counter-card__actions counter-card__actions--self">
          <button class="counter-button" onclick="dealDamage('${target.id}', 1)">-1</button>
          <button class="counter-button counter-button--positive" onclick="changeLife(1)">+1</button>
        </div>
      `
      : `
        <div class="counter-card__actions">
          <button class="counter-button" onclick="dealDamage('${target.id}', 1)">-1</button>
          <button class="counter-button counter-button--accent" onclick="dealCommanderDamage('${target.id}', 1)">Com. -1</button>
        </div>
      `;
  }

  return `
    <section
      class="counter-card${isCurrentPlayer ? " counter-card--me" : ""}${dead ? " counter-card--dead" : ""}"
      style="${dead ? "" : `--player-card-color: ${playerColor.card};`}"
    >
      <div class="counter-card__top">
        <span class="counter-card__name">${target.name}</span>
        <span class="counter-card__status">${dead ? "Morto" : isCurrentPlayer ? "Voce" : "Ativo"}</span>
      </div>

      <div class="counter-card__body">
        <div class="counter-card__life">${target.life}</div>
        <div class="counter-card__meta">
          ${isCurrentPlayer
            ? `
              <span>Dano Com. recebido:</span>
              <div class="commander-chip-list">
                ${commanderDamageSummary || '<span class="commander-chip">Nenhum</span>'}
              </div>
            `
            : `<span>Dano Com.: ${commanderDamageFromMe}</span>`}
        </div>
      </div>

      ${actions}
    </section>
  `;
}

export function dealDamage(targetId, amount) {
  if (state.mode === "local") {
    changeLocalLife(targetId, -amount);
    return;
  }

  const target = state.players[targetId];
  if (!target || isPlayerDead(target) || isPlayerDead(state.player)) return;

  const targetIsDead = updatePlayerLife(targetId, target.life - amount);

  if (targetIsDead) {
    publishDeathEvent(target, "normal");
  }
}

export function dealCommanderDamage(targetId, amount) {
  if (state.mode !== "online" || !state.player) return;

  const target = state.players[targetId];
  if (targetId === state.player.id) return;
  if (!target || isPlayerDead(target) || isPlayerDead(state.player)) return;

  const newLife = Math.max(target.life - amount, 0);
  const commanderResult = getCommanderDeath(target, state.player.id, amount);

  commanderResult.current[state.player.id] = commanderResult.totalDamage;
  const targetIsDead = updatePlayerLife(targetId, newLife, {
    commanderDamageReceived: commanderResult.current
  }) || commanderResult.diedFromCommander;

  if (targetIsDead) {
    publishDeathEvent(target, "commander");
  }

  if (commanderResult.diedFromCommander) {
    update(ref(db, `rooms/${state.roomId}/players/${targetId}`), {
      dead: true
    });
  }
}

export function changeLife(val) {
  if (state.mode === "local") return;

  const currentPlayer = state.players[state.player.id] || state.player;
  if (isPlayerDead(currentPlayer)) return;

  const currentLife = Math.max((currentPlayer.life || 0) + val, 0);
  const playerIsDead = currentLife <= 0;

  state.player.life = currentLife;
  state.player.dead = playerIsDead;

  update(ref(db, `rooms/${state.roomId}/players/${state.player.id}`), {
    life: currentLife,
    dead: playerIsDead
  });

  if (playerIsDead) {
    showDeathModal("Voce morreu", "Voce foi eliminado.");
  }
}

export function changeLocalLife(targetId, delta) {
  if (state.mode !== "local") return;

  const target = state.players[targetId];
  if (!target || isPlayerDead(target)) return;

  const nextLife = Math.max((target.life || 0) + delta, 0);
  const playerIsDead = nextLife <= 0;

  state.players[targetId] = {
    ...target,
    life: nextLife,
    dead: playerIsDead
  };

  renderAllPlayers();

  if (playerIsDead) {
    showDeathModal(`${target.name} morreu`, "Esse jogador foi eliminado no modo um celular.");
  }
}
