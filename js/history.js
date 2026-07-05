import { db, auth } from './firebase-config.js';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

let unsubscribeHistory = null;

/**
 * Saves a sentence to the user's history in Firestore
 * @param {string} text The sentence/text to save
 * @param {string} source Where it was saved from (e.g., 'live', 't2s')
 */
export async function saveToHistory(text, source = 'live') {
  if (!text || text.trim() === '') {
    if (typeof toast !== 'undefined') toast('No text to save!', '⚠️');
    return;
  }
  
  const user = auth.currentUser;
  if (!user) {
    if (typeof toast !== 'undefined') toast('Please log in to save history', '🔒');
    return;
  }

  try {
    const historyRef = collection(db, "users", user.uid, "history");
    await addDoc(historyRef, {
      text: text,
      source: source,
      createdAt: serverTimestamp()
    });
    if (typeof toast !== 'undefined') toast('Saved to history', '💾');
  } catch (error) {
    console.error("Error saving to history: ", error);
    if (typeof toast !== 'undefined') toast('Failed to save (check Firestore Rules)', '❌');
    alert("Save failed. Make sure your Firestore Database is enabled and security rules allow read/write. Error: " + error.message);
  }
}

/**
 * Listens to the user's history and updates the sidebar
 */
export function loadHistory(uid) {
  const historyRef = collection(db, "users", uid, "history");
  const q = query(historyRef, orderBy("createdAt", "desc"));
  
  // Unsubscribe from previous listener if any
  if (unsubscribeHistory) {
    unsubscribeHistory();
  }

  unsubscribeHistory = onSnapshot(q, (snapshot) => {
    const historyList = document.getElementById('sidebarHistoryList');
    if (!historyList) return;
    
    historyList.innerHTML = ''; // Clear current
    
    if (snapshot.empty) {
      historyList.innerHTML = '<div style="padding: 1rem; color: var(--t3); font-size: 0.9rem; text-align: center;">No history yet. Start generating!</div>';
      return;
    }
    
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const item = document.createElement('div');
      item.className = 'history-item';
      
      const textSpan = document.createElement('span');
      textSpan.className = 'h-text';
      textSpan.textContent = data.text;
      
      const sourceIcon = document.createElement('span');
      sourceIcon.className = 'h-icon';
      sourceIcon.textContent = data.source === 'live' ? '🎥' : '✍️';
      
      const delBtn = document.createElement('button');
      delBtn.className = 'history-del-btn';
      delBtn.innerHTML = '🗑️';
      delBtn.title = 'Delete history';
      delBtn.onclick = async (e) => {
        e.stopPropagation(); // prevent clicking the item itself
        if (confirm("Delete this history item?")) {
          try {
            // Using doc function from firestore, and docSnapshot.id
            await deleteDoc(doc(db, "users", uid, "history", docSnapshot.id));
            if (typeof toast !== 'undefined') toast('Deleted', '🗑️');
          } catch (err) {
            console.error("Error deleting history:", err);
            if (typeof toast !== 'undefined') toast('Failed to delete', '❌');
          }
        }
      };
      
      item.appendChild(sourceIcon);
      item.appendChild(textSpan);
      item.appendChild(delBtn);
      
      // Allow clicking a history item to speak it or copy it
      item.onclick = () => {
        if (typeof speak === 'function') {
          speak(data.text);
          if (typeof toast !== 'undefined') toast('Speaking…', '🔊');
        }
      };
      
      historyList.appendChild(item);
    });
  }, (error) => {
    console.error("Error loading history:", error);
    const historyList = document.getElementById('sidebarHistoryList');
    if(historyList) historyList.innerHTML = '<div style="color:red; padding:1rem;">Failed to load history</div>';
  });
}

/**
 * Clears the history UI when logged out
 */
export function clearHistoryUI() {
  if (unsubscribeHistory) {
    unsubscribeHistory();
    unsubscribeHistory = null;
  }
  const historyList = document.getElementById('sidebarHistoryList');
  if (historyList) {
    historyList.innerHTML = '<div style="padding: 1rem; color: var(--t3); font-size: 0.9rem; text-align: center;">Log in to view history</div>';
  }
}

// Attach a global reference so HTML buttons can call it easily without module conflicts
window.saveSentenceToHistory = function(text, source) {
  saveToHistory(text, source);
};
