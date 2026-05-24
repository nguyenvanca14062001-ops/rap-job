import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  // Boss dán cái API Key chuẩn (mã AIzaSy...) của project có khách cũ vào đây nhé
  apiKey: "AIzaSyDZsrN_ZM9YAzPnCTZHafOKhcsIZ--ll2g", 
  authDomain: "mmo-pro-6f133.firebaseapp.com",
  projectId: "mmo-pro-6f133",
  storageBucket: "mmo-pro-6f133.firebasestorage.app",
  messagingSenderId: "797198646244",
  appId: "1:797198646244:web:3be673461006b0896ea5f1"
};

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);

// Xuất các dịch vụ để sử dụng ở các file khác
export const db = getFirestore(app);
export const auth = getAuth(app);