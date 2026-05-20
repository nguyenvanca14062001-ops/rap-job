import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = { 
<<<<<<< HEAD
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, // Sửa thành dòng này
=======
  apiKey: "AIzaSy...HNO2w", // DÁN TRỰC TIẾP CÁI KEY CỦA BOSS VÀO ĐÂY
>>>>>>> 75f9b7172a3e6f157e2f86a1af0d427946b878be
  authDomain: "mmo-pro-6f133.firebaseapp.com", 
  projectId: "mmo-pro-6f133", 
  storageBucket: "mmo-pro-6f133.firebasestorage.app", 
  messagingSenderId: "797198646244", 
  appId: "1:797198646244:web:3be673461006b0896ea5f1" 
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
