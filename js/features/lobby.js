import { PLAYER_COLORS } from "../core/constants.js";
import { state } from "../core/state.js";
import { getPlayerColor, normalizePlayerName } from "../core/utils.js";

const colorOptions = document.getElementById("colorOptions");

export function renderColorOptions() {
  if (!colorOptions) return;

  colorOptions.innerHTML = PLAYER_COLORS.map((color) => `
    <button
      type="button"
      class="color-swatch${state.selectedColorId === color.id ? " is-selected" : ""}"
      style="--swatch-color: ${color.card}; --swatch-color-strong: ${color.strong};"
      title="${color.label}"
      aria-label="Escolher cor ${color.label}"
      aria-pressed="${state.selectedColorId === color.id}"
      onclick="selectPlayerColor('${color.id}')"
    ></button>
  `).join("");
}

export function updateLobbyButtons() {
  const nameInput = document.getElementById("name");
  const normalizedName = normalizePlayerName(nameInput?.value || "");
  const room = document.getElementById("room")?.value.trim() || "";
  const createRoomButton = document.getElementById("createRoomButton");
  const joinRoomButton = document.getElementById("joinRoomButton");
  const singleDeviceModeButton = document.getElementById("singleDeviceModeButton");

  if (nameInput && nameInput.value !== normalizedName) {
    nameInput.value = normalizedName;
  }

  if (!createRoomButton || !joinRoomButton || !singleDeviceModeButton) return;

  const canCreate = Boolean(normalizedName);
  const canJoin = Boolean(normalizedName && room);

  createRoomButton.disabled = !canCreate;
  joinRoomButton.disabled = !canJoin;

  createRoomButton.classList.toggle("button-ready", canCreate);
  createRoomButton.classList.toggle("button-blocked", !canCreate);
  joinRoomButton.classList.toggle("button-ready", canJoin);
  joinRoomButton.classList.toggle("button-blocked", !canJoin);
  singleDeviceModeButton.classList.add("button-ready");
}

export function selectPlayerColor(colorId) {
  state.selectedColorId = getPlayerColor(colorId).id;
  renderColorOptions();
}

export function initLobby() {
  const nameInput = document.getElementById("name");
  const roomInput = document.getElementById("room");

  if (!nameInput || !roomInput) return;

  nameInput.addEventListener("input", updateLobbyButtons);
  roomInput.addEventListener("input", updateLobbyButtons);
  renderColorOptions();
  updateLobbyButtons();
}
