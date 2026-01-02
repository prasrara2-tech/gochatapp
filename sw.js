const CACHE_NAME = 'gochat-v6';

// Daftar aset yang harus disimpan agar aplikasi bisa dibuka offline
// PASTIKAN SEMUA FILE INI ADA DI FOLDER PROYEK ANDA!
const ASSETS_TO_CACHE = [
  '/',                      // Root directory
  '/index.html',            // Halaman Login
  '/mobile.html',           // Halaman Chat Utama (Sesuaikan jika namanya beda)
  '/manifest.json',
  '/profile.html',          // Tambahkan jika file ini ada
  '/user-profile.html',     // Tambahkan jika file ini ada
  '/group-profile.html',    // Tambahkan jika file ini ada
  '/image/genre/20.png',    // Icon aplikasi
  '/note.mp3',              // Suara notifikasi
  '/night-owl.mp3',         // Suara ringtone
  
  // External Libs (CDN)
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js'
];

// 1. Tahap Install: Simpan aset ke Cache
self.addEventListener('install', (event) => {
  console.log('[SW] Sedang menginstall...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Mengunduh aset ke cache...');
      return cache.addAll(ASSETS_TO_CACHE).catch((error) => {
        console.error('[SW] Gagal mengunduh aset:', error);
        throw error; // Melempar error agar kita tahu file mana yang 404
      });
    })
  );
  
  // Force aktivasi SW baru segera
  self.skipWaiting();
});

// 2. Tahap Aktivasi: Bersihkan cache lama
self.addEventListener('activate', (event) => {
  console.log('[SW] Mengaktifkan service worker baru...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          // Hapus cache dengan nama lama (misal: gochat-v1)
          if (cache !== CACHE_NAME) {
            console.log('[SW] Menghapus cache lama:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  
  // Menguasai halaman yang terbuka segera
  return self.clients.claim();
});

// 3. Strategi Fetch: Cache First (Statis), Network Only (Dinamis)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // --- PENTING: JANGAN CACHE DATABASE & API EKSTERNAL ---
  // Firebase Database dan Cloudinary harus selalu diambil dari Network 
  // agar data chat selalu up-to-date.
  if (url.hostname.includes('firebasedatabase.app') || 
      url.hostname.includes('cloudinary.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // --- STRATEGI STALE-WHILE-REVALIDATE UNTUK FILE HTML/CSS/JS/IMG ---
  // 1. Cek Cache dulu (Cepat)
  // 2. Ambil dari Network di background (Update)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Jika network sukses, simpan update ke cache
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      });

      // Kembalikan cache yang ada dulu (jika ada), jika tidak ada tunggu network
      return cachedResponse || fetchPromise;
    })
  );
});

// 4. Menangani Push Notification
self.addEventListener('push', (event) => {
  let data = { title: 'GoChat Pro', body: 'Ada pesan baru masuk!' };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    // Fallback jika data bukan JSON
    if(event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: '/image/genre/20.png', // Pastikan path sesuai
    badge: '/image/genre/20.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/mobile.html',
      click_action: '/mobile.html' // Kadang diperlukan oleh Android lama
    },
    requireInteraction: true // Membuat notifikasi tetap ada sampai diklik
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 5. Menangani Klik pada Notifikasi
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Cek apakah aplikasi sudah terbuka
      for (const client of clientList) {
        if (client.url.includes('mobile.html') && 'focus' in client) {
          return client.focus();
        }
      }
      // Jika belum terbuka, buka baru
      if (clients.openWindow) {
        return clients.openWindow('/mobile.html');
      }
    })
  );
});