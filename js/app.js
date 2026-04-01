import { start, startSingleDeviceMode, addLocalPlayer, renameLocalPlayer, closeRenamePlayerModal, submitRenamePlayer, applyLocalCommanderDamage, dealDamage, dealCommanderDamage, changeLife, changeLocalLife } from "./features/game.js";
import { initLobby, selectPlayerColor } from "./features/lobby.js";
import { closeDeathModal, closeNewsModal, openNewsModal, syncNewsBadge } from "./features/modals.js";
import { state } from "./core/state.js";
import { generateCode, normalizePlayerName } from "./core/utils.js";

window.closeDeathModal = closeDeathModal;
window.openNewsModal = openNewsModal;
window.closeNewsModal = closeNewsModal;
window.selectPlayerColor = selectPlayerColor;
window.dealDamage = dealDamage;
window.dealCommanderDamage = dealCommanderDamage;
window.changeLife = changeLife;
window.startSingleDeviceMode = startSingleDeviceMode;
window.addLocalPlayer = addLocalPlayer;
window.renameLocalPlayer = renameLocalPlayer;
window.closeRenamePlayerModal = closeRenamePlayerModal;
window.submitRenamePlayer = submitRenamePlayer;
window.applyLocalCommanderDamage = applyLocalCommanderDamage;
window.changeLocalLife = changeLocalLife;

window.createRoom = function () {
  const name = normalizePlayerName(document.getElementById("name").value);
  if (!name) return;

  state.roomId = generateCode();
  start(name);
};

window.joinRoom = function () {
  const name = normalizePlayerName(document.getElementById("name").value);
  const room = document.getElementById("room").value.trim().toUpperCase();
  if (!name || !room) return;

  state.roomId = room;
  start(name);
};

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDeathModal();
    closeNewsModal();
    closeRenamePlayerModal();
  }

  if (event.key === "Enter") {
    const renamePlayerModal = document.getElementById("renamePlayerModal");
    const renamePlayerInput = document.getElementById("renamePlayerInput");
    const isRenameOpen = renamePlayerModal && !renamePlayerModal.classList.contains("hidden");
    const isTypingName = document.activeElement === renamePlayerInput;

    if (isRenameOpen && isTypingName) {
      submitRenamePlayer();
    }
  }
});

syncNewsBadge();
initLobby();
