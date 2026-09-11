import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyC00MvY-I4rAoLUdrG-bm4_btC0zgq8Tsk",
  authDomain: "hyakunin-isshu-74acf.firebaseapp.com",
  databaseURL: "https://hyakunin-isshu-74acf-default-rtdb.firebaseio.com",
  projectId: "hyakunin-isshu-74acf",
  storageBucket: "hyakunin-isshu-74acf.firebasestorage.app",
  messagingSenderId: "648898167935",
  appId: "1:648898167935:web:97e1c54db4b429a0456b4a",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getDatabase(app);
