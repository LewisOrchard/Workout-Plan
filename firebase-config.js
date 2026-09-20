// Paste the config object from your Firebase project here.
// Firebase console → Project settings → General → Your apps → Web app → SDK setup and configuration.
// These values are safe to commit: they identify your project, they are not secrets.
// Access control is enforced by the Firestore security rules (see README.md), not by hiding this file.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

firebase.initializeApp(firebaseConfig);
