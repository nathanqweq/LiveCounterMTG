import { db, ref, set, onValue, update } from "./firebase.js";

let player = null;
let roomId = null;
let players = {};
let deathEventReady = false;
let lastSeenDeathEventId = null;

const deathModal = document.getElementById("deathModal");
const deathModalTitle = document.getElementById("deathModalTitle");
const deathModalMessage = document.getElementById("deathModalMessage");
const MAX_NAME_LENGTH = 24;

function normalizePlayerName(value) {
  return value.trim().slice(0, MAX_NAME_LENGTH);
}

function updateLobbyButtons() {
  const nameInput = document.getElementById("name");
  const normalizedName = normalizePlayerName(nameInput?.value || "");
  const room = document.getElementById("room")?.value.trim() || "";
  const createRoomButton = document.getElementById("createRoomButton");
  const joinRoomButton = document.getElementById("joinRoomButton");

  if (nameInput && nameInput.value !== normalizedName) {
    nameInput.value = normalizedName;
  }

  if (!createRoomButton || !joinRoomButton) return;

  const canCreate = Boolean(normalizedName);
  const canJoin = Boolean(normalizedName && room);

  createRoomButton.disabled = !canCreate;
  joinRoomButton.disabled = !canJoin;

  createRoomButton.classList.toggle("button-ready", canCreate);
  createRoomButton.classList.toggle("button-blocked", !canCreate);
  joinRoomButton.classList.toggle("button-ready", canJoin);
  joinRoomButton.classList.toggle("button-blocked", !canJoin);
}

function isPlayerDead(target) {
  return Boolean(target?.dead);
}

function getCommanderDeath(target, attackerId, amount) {
  const current = target.commanderDamageReceived || {};
  const totalDamage = (current[attackerId] || 0) + amount;

  return {
    current,
    totalDamage,
    diedFromCommander: totalDamage >= 21
  };
}

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function updatePlayerLife(targetId, nextLife, extraData = {}) {
  const targetIsDead = nextLife <= 0;

  update(ref(db, `rooms/${roomId}/players/${targetId}`), {
    life: Math.max(nextLife, 0),
    dead: targetIsDead,
    ...extraData
  });

  return targetIsDead;
}

function buildDeathEvent(target, reason) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    killerId: player?.id || null,
    killerName: player?.name || "Desconhecido",
    victimId: target.id,
    victimName: target.name,
    reason,
    createdAt: Date.now()
  };
}

function publishDeathEvent(target, reason) {
  const deathEvent = buildDeathEvent(target, reason);

  lastSeenDeathEventId = deathEvent.id;
  set(ref(db, `rooms/${roomId}/events/lastDeath`), deathEvent);
  showDeathModalForEvent(deathEvent);
}

function showDeathModal(title, message) {
  if (!deathModal || !deathModalTitle || !deathModalMessage) return;

  deathModalTitle.textContent = title;
  deathModalMessage.textContent = message;
  deathModal.classList.remove("hidden");
  deathModal.setAttribute("aria-hidden", "false");
}

function showDeathModalForEvent(deathEvent) {
  if (!player || !deathEvent) return;

  if (deathEvent.victimId === player.id) {
    const message = deathEvent.killerId && deathEvent.killerId !== player.id
      ? `${deathEvent.killerName} te matou${deathEvent.reason === "commander" ? " com dano de comandante." : "."}`
      : "Voce foi eliminado.";

    showDeathModal("Voce morreu", message);
    return;
  }

  if (deathEvent.killerId === player.id) {
    const message = deathEvent.reason === "commander"
      ? `Voce matou ${deathEvent.victimName} com dano de comandante.`
      : `Voce matou ${deathEvent.victimName}.`;

    showDeathModal("Eliminacao confirmada", message);
  }
}

window.closeDeathModal = function () {
  if (!deathModal) return;

  deathModal.classList.add("hidden");
  deathModal.setAttribute("aria-hidden", "true");
};

function initLobby() {
  const nameInput = document.getElementById("name");
  const roomInput = document.getElementById("room");

  if (!nameInput || !roomInput) return;

  nameInput.addEventListener("input", updateLobbyButtons);
  roomInput.addEventListener("input", updateLobbyButtons);
  updateLobbyButtons();
}

window.createRoom = function () {
  const name = normalizePlayerName(document.getElementById("name").value);
  if (!name) return;

  roomId = generateCode();
  start(name);
};

window.joinRoom = function () {
  const name = normalizePlayerName(document.getElementById("name").value);
  const room = document.getElementById("room").value.trim().toUpperCase();
  if (!name || !room) return;

  roomId = room;
  start(name);
};

function start(name) {
  player = {
    id: Math.random().toString(36).substring(2),
    name,
    life: 40,
    dead: false,
    commanderDamageDealt: {},
    commanderDamageReceived: {}
  };

  document.getElementById("roomCode").innerText = roomId;
  document.getElementById("lobby").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");

  set(ref(db, `rooms/${roomId}/players/${player.id}`), player);

  listenRoom();
  listenDeathEvents();
}

// Escuta todos os players da sala.
function listenRoom() {
  onValue(ref(db, `rooms/${roomId}/players`), (snap) => {
    const data = snap.val();
    if (!data) return;

    players = data;
    if (player?.id && players[player.id]) {
      player = {
        ...player,
        ...players[player.id]
      };
    }
    renderAllPlayers();
  });
}

function listenDeathEvents() {
  deathEventReady = false;
  lastSeenDeathEventId = null;

  onValue(ref(db, `rooms/${roomId}/events/lastDeath`), (snap) => {
    const deathEvent = snap.val();

    if (!deathEventReady) {
      deathEventReady = true;
      lastSeenDeathEventId = deathEvent?.id || null;
      return;
    }

    if (!deathEvent?.id || deathEvent.id === lastSeenDeathEventId) return;

    lastSeenDeathEventId = deathEvent.id;
    showDeathModalForEvent(deathEvent);
  });
}

// Renderiza todos os players.
function renderAllPlayers() {
  const container = document.getElementById("game");
  const allPlayers = Object.values(players).sort((a, b) => a.name.localeCompare(b.name));
  const currentPlayer = allPlayers.find((p) => p.id === player.id) || player;
  const opponents = allPlayers.filter((p) => p.id !== player.id);
  const opponentLayoutClass = `opponents-grid--${Math.min(Math.max(opponents.length, 1), 4)}`;

  container.innerHTML = `
    <div class="board">
      <div class="board__hud">
        <div>
          <p class="eyebrow">Sala ativa</p>
          <h2 class="room-code">${roomId}</h2>
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

function renderPlayerCard(target, isCurrentPlayer) {
  const dead = isPlayerDead(target);
  const commanderDamageFromMe = target.commanderDamageReceived?.[player.id] || 0;
  const commanderDamageSummary = isCurrentPlayer
    ? Object.entries(target.commanderDamageReceived || {})
      .filter(([, damage]) => damage > 0)
      .map(([attackerId, damage]) => {
        const attackerName = players[attackerId]?.name || "Desconhecido";
        return `<span class="commander-chip">${attackerName}: ${damage}</span>`;
      })
      .join("")
    : "";
  let actions = `
    <div class="counter-card__actions">
      <span class="counter-card__empty">${dead ? "Eliminado" : "Sem acoes"}</span>
    </div>
  `;

  if (!dead && !isPlayerDead(player)) {
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
    <section class="counter-card${isCurrentPlayer ? " counter-card--me" : ""}${dead ? " counter-card--dead" : ""}">
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

// Da dano normal em outro player.
window.dealDamage = function (targetId, amount) {
  const target = players[targetId];
  if (!target || isPlayerDead(target) || isPlayerDead(player)) return;

  const targetIsDead = updatePlayerLife(targetId, target.life - amount);

  if (targetIsDead) {
    publishDeathEvent(target, "normal");
  }
};

// Da dano de comandante em outro player.
window.dealCommanderDamage = function (targetId, amount) {
  const target = players[targetId];
  if (targetId === player.id) return;
  if (!target || isPlayerDead(target) || isPlayerDead(player)) return;

  const newLife = Math.max(target.life - amount, 0);
  const commanderResult = getCommanderDeath(target, player.id, amount);

  commanderResult.current[player.id] = commanderResult.totalDamage;
  const targetIsDead = updatePlayerLife(targetId, newLife, {
    commanderDamageReceived: commanderResult.current
  }) || commanderResult.diedFromCommander;

  if (targetIsDead) {
    publishDeathEvent(target, "commander");
  }

  if (commanderResult.diedFromCommander) {
    update(ref(db, `rooms/${roomId}/players/${targetId}`), {
      dead: true
    });
  }
};

// Atualiza so o seu player.
window.changeLife = function (val) {
  const currentPlayer = players[player.id] || player;
  if (isPlayerDead(currentPlayer)) return;

  const currentLife = Math.max((currentPlayer.life || 0) + val, 0);
  const playerIsDead = currentLife <= 0;

  player.life = currentLife;
  player.dead = playerIsDead;

  update(ref(db, `rooms/${roomId}/players/${player.id}`), {
    life: currentLife,
    dead: playerIsDead
  });

  if (playerIsDead) {
    showDeathModal("Voce morreu", "Voce foi eliminado.");
  }
};

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    window.closeDeathModal();
  }
});

initLobby();
