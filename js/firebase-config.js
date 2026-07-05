import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// TODO: Replace the following with your app's Firebase project configuration
// 1. Go to Project Settings in Firebase Console
// 2. Scroll down to "Your apps" and select the Web app (</>)
// 3. Copy the firebaseConfig object and paste it here
const firebaseConfig = {
  apiKey: "AIzaSyC5j6a9p2EgurNnnoX97oB3-1DCyhCF11o",
  authDomain: "sigmaflowai-n04.firebaseapp.com",
  projectId: "sigmaflowai-n04",
  storageBucket: "sigmaflowai-n04.firebasestorage.app",
  messagingSenderId: "937461715906",
  appId: "1:937461715906:web:f58baae1d1704fb5b47c5b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
