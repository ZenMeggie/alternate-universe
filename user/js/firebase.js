import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getFirestore } from './data/fsdk.js';

const firebaseConfig = {
  apiKey: "AIzaSyAJwQxERkwFibzvsKGpmjw6aziJxhJFk1E",
  authDomain: "zenlinmeggie.firebaseapp.com",
  projectId: "zenlinmeggie",
  storageBucket: "zenlinmeggie.firebasestorage.app",
  messagingSenderId: "63141407272",
  appId: "1:63141407272:web:6baacba41265db05d5a31d",
  measurementId: "G-GJPLRD8P2L"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);