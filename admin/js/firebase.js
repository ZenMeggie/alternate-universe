// Satu pintu untuk semua import Firebase. Modul lain cukup: import { db, getDocs } from "./firebase.js"
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

export { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
export {
  collection, collectionGroup, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
