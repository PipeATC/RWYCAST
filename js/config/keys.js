// Firebase config and storage keys
// 👉 CONFIGURA AQUÍ tu proyecto Firebase
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCHzfEjS4xWeM2EWWaP5OR6a2AZEWdUG58",
  authDomain:        "atcbrief.firebaseapp.com",
  databaseURL:       "https://atcbrief-default-rtdb.firebaseio.com",
  projectId:         "atcbrief",
  storageBucket:     "atcbrief.firebasestorage.app",
  messagingSenderId: "394162283361",
  appId:             "1:394162283361:web:1ecbebce83c4ada8745b20",
};

const SKEY='runcast:state:v1';            // clave en modo local (window.storage)
const DBPATH='runcast/state/v1';          // ruta del estado compartido en Firebase
const BKEY='runcast:briefing:v1';
const BPATH='runcast/briefing/current';
const UPATH='runcast/users';
const SESSION_KEY='runcast:session';   // sesión recordada ("mantener sesión iniciada")
