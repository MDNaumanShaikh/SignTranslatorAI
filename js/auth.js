import { auth } from './firebase-config.js';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { loadHistory, clearHistoryUI } from './history.js';

const provider = new GoogleAuthProvider();

// DOM Elements (We'll grab these after DOM loads)
let loginBtn, profileDiv, profileImg, userNameSpan;

document.addEventListener("DOMContentLoaded", () => {
  loginBtn = document.getElementById('loginBtn');
  profileDiv = document.getElementById('userProfile');
  profileImg = document.getElementById('profileImg');
  userNameSpan = document.getElementById('userName');
  
  if(loginBtn) loginBtn.addEventListener('click', handleLogin);
  if(profileDiv) profileDiv.addEventListener('click', handleLogout); // simple logout on profile click
});

function handleLogin() {
  signInWithPopup(auth, provider)
    .then((result) => {
      // The signed-in user info.
      const user = result.user;
      toast(`Welcome, ${user.displayName}!`, '👋');
    }).catch((error) => {
      console.error(error);
      toast('Login failed: ' + error.message, '❌');
    });
}

function handleLogout() {
  if (confirm("Are you sure you want to log out?")) {
    signOut(auth).then(() => {
      toast('Logged out successfully', '👋');
    }).catch((error) => {
      toast('Logout failed', '❌');
    });
  }
}

// Track authentication state
onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is signed in.
    if(loginBtn) loginBtn.style.display = 'none';
    if(profileDiv) {
      profileDiv.style.display = 'flex';
      profileImg.src = user.photoURL || 'https://via.placeholder.com/32';
      userNameSpan.textContent = user.displayName?.split(' ')[0] || 'User';
    }
    
    // Load the user's history from Firestore
    loadHistory(user.uid);
  } else {
    // User is signed out.
    if(loginBtn) loginBtn.style.display = 'block';
    if(profileDiv) profileDiv.style.display = 'none';
    
    // Clear history UI
    clearHistoryUI();
  }
});
