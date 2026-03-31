import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB9aR-DN52jxIPNYgfy-tEYLx9bQ-yGCfQ",
  authDomain: "livecountermtg.firebaseapp.com",
  projectId: "livecountermtg",
  storageBucket: "livecountermtg.firebasestorage.app",
  messagingSenderId: "582361959146",
  appId: "1:582361959146:web:a92f7294e370f9aa7fe593",
  databaseURL: "https://livecountermtg-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, set, onValue, update };