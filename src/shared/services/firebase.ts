// ============================================================
// FIREBASE CONFIG — PENDIENTE DE CONFIGURACIÓN
// Este módulo está deshabilitado temporalmente (modo mock).
// Para activar Firebase:
// 1. Crea un proyecto en https://console.firebase.google.com
// 2. Copia las credenciales a .env.local
// 3. Descomenta el código de abajo
// ============================================================

// import { initializeApp } from 'firebase/app';
// import { getAuth } from 'firebase/auth';
// import { getFirestore } from 'firebase/firestore';
//
// const firebaseConfig = {
//   apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
//   authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
//   projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
//   storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
//   appId:             import.meta.env.VITE_FIREBASE_APP_ID,
// };
//
// const app = initializeApp(firebaseConfig);
// export const auth = getAuth(app);
// export const db   = getFirestore(app);

// Stubs vacíos para modo mock
export const auth = null;
export const db   = null;
