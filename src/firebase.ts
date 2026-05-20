import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = { 
  apiKey: "AIzaSyCQz9VulU2k-7O5JZhQxEHD1C5oz6HNO2w", // Dán cái chuỗi Key thật vào đây, giữ nguyên ngoặc kép nhé
  authDomain: "mmo-pro-6f133.firebaseapp.com", 
  projectId: "mmo-pro-6f133", 
  storageBucket: "mmo-pro-6f133.firebasestorage.app", 
  messagingSenderId: "797198646244", 
  appId: "1:797198646244:web:3be673461006b0896ea5f1" 
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
