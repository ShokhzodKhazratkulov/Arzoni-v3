importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
  apiKey: "AIzaSyAAkjZQ5vE4T19SVaOvG7p67DgzDYYjn74",
  authDomain: "gen-lang-client-0792523954.firebaseapp.com",
  projectId: "gen-lang-client-0792523954",
  storageBucket: "gen-lang-client-0792523954.firebasestorage.app",
  messagingSenderId: "400534976518",
  appId: "1:400534976518:web:862b1d2584116f6674ab87"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
