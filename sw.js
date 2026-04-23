// Firebase Messaging 서비스 워커
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ⚠️ Firebase 설정 (index.html의 값과 동일하게)
firebase.initializeApp({
  apiKey:            "AIzaSyBrARQuuYF3jYp4J3myWA-26Ya58uRz8Y4",
  authDomain:        "todotoday-b0b9a.firebaseapp.com",
  projectId:         "todotoday-b0b9a",
  messagingSenderId: "971814444647",
  appId:             "1:971814444647:web:9cd620bff206b5622a3ec2"
});

const messaging = firebase.messaging();

// 백그라운드 푸시 수신
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification ?? {};
  const data = payload.data ?? {};
  self.registration.showNotification(title ?? '오늘하자제발', {
    body: body ?? '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data,
    requireInteraction: false,
    vibrate: [200, 100, 200]
  });
});

// 알림 클릭 → 앱 열기
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    if (list.length) return list[0].focus();
    return clients.openWindow('/');
  }));
});
