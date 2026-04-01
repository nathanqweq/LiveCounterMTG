import { NEWS_STORAGE_KEY } from "../core/constants.js";
import { state } from "../core/state.js";

const deathModal = document.getElementById("deathModal");
const deathModalTitle = document.getElementById("deathModalTitle");
const deathModalMessage = document.getElementById("deathModalMessage");
const newsModal = document.getElementById("newsModal");
const newsButton = document.getElementById("newsButton");
const newsBadge = document.getElementById("newsBadge");

function hasSeenNews() {
  return window.localStorage.getItem(NEWS_STORAGE_KEY) === "true";
}

function markNewsAsSeen() {
  window.localStorage.setItem(NEWS_STORAGE_KEY, "true");
  syncNewsBadge();
}

export function syncNewsBadge() {
  if (!newsBadge || !newsButton) return;

  const unread = !hasSeenNews();
  newsBadge.classList.toggle("hidden", !unread);
  newsButton.classList.toggle("footer-news-button--unread", unread);
}

export function showDeathModal(title, message) {
  if (!deathModal || !deathModalTitle || !deathModalMessage) return;

  deathModalTitle.textContent = title;
  deathModalMessage.textContent = message;
  deathModal.classList.remove("hidden");
  deathModal.setAttribute("aria-hidden", "false");
}

export function showDeathModalForEvent(deathEvent) {
  if (!state.player || !deathEvent) return;

  if (deathEvent.victimId === state.player.id) {
    const message = deathEvent.killerId && deathEvent.killerId !== state.player.id
      ? `${deathEvent.killerName} te matou${deathEvent.reason === "commander" ? " com dano de comandante." : "."}`
      : "Voce foi eliminado.";

    showDeathModal("Voce morreu", message);
    return;
  }

  if (deathEvent.killerId === state.player.id) {
    const message = deathEvent.reason === "commander"
      ? `Voce matou ${deathEvent.victimName} com dano de comandante.`
      : `Voce matou ${deathEvent.victimName}.`;

    showDeathModal("Eliminacao confirmada", message);
  }
}

export function closeDeathModal() {
  if (!deathModal) return;

  deathModal.classList.add("hidden");
  deathModal.setAttribute("aria-hidden", "true");
}

export function openNewsModal() {
  if (!newsModal || !newsButton) return;

  newsModal.classList.remove("hidden");
  newsModal.setAttribute("aria-hidden", "false");
  newsButton.setAttribute("aria-expanded", "true");
  markNewsAsSeen();
}

export function closeNewsModal() {
  if (!newsModal || !newsButton) return;

  newsModal.classList.add("hidden");
  newsModal.setAttribute("aria-hidden", "true");
  newsButton.setAttribute("aria-expanded", "false");
}
