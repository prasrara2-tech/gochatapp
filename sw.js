const CACHE_NAME = 'gochat-v7'; // Versi dinaikkan agar browser mengupdate SW lama

// Daftar aset yang harus disimpan agar aplikasi bisa dibuka offline
// PASTIKAN SEMUA FILE INI ADA DI FOLDER PROYEK ANDA!
const ASSETS_TO_CACHE = [
  '/',                      // Root directory (akan menuju index.html otomatis)
  '/index.html',            // Halaman Utama Chat (SAMA dengan file HTML yang Anda pakai)
  '/manifest.json',
  
  // Halaman Profil (Jika Anda memisahkannya)
  '/profile.html',          
  '/user-profile.html',     
  '/group-profile.html',    

  // Aset Lokal (Pastikan folder 'image' dan file ada)
  '/image/genre/20.png',    // Icon aplikasi
  
  // External Libs (CDN) - Wajib dicachekan untuk performa & offline
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
  'https://meet.jit.si/external_api.js' // Tambahkan Jitsi agar tampilan call tetap bisa dimuat
];

// 1. Tahap Install: Simpan aset ke Cache
self.addEventListener('install', (event) => {
  console.log('[SW] Sedang menginstall Service Worker v7...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Mengunduh aset ke cache...');
      return cache.addAll(ASSETS_TO_CACHE).catch((error) => {
        console.error('[SW] Gagal mengunduh aset:', error);
        // Jangan throw error disini, agar SW tetap jalan meskipun ada file yang tidak ketemu
      });
    })
  );
  
  // Force aktivasi SW baru segera
  self.skipWaiting();
});

// 2. Tahap Aktivasi: Bersihkan cache lama (v1-v6)
self.addEventListener('activate', (event) => {
  console.log('[SW] Mengaktifkan service worker baru v7...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          // Hapus cache dengan nama lama
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

// 3. Strategi Fetch: Network First untuk Firebase, Cache First untuk yang lain
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // --- PENTING: JANGAN CACHE DATABASE & API EKSTERNAL ---
  // Firebase Database, Cloudinary, dan Jitsi harus selalu diambil dari Network 
  // agar data chat selalu up-to-date.
  if (url.hostname.includes('firebasedatabase.app') || 
      url.hostname.includes('cloudinary.com') ||
      url.hostname.includes('jit.si')) { // Tambahkan Jitsi ke exception
    event.respondWith(fetch(event.request));
    return;
  }

  // --- STRATEGI STALE-WHILE-REVALIDATE UNTUK FILE HTML/CSS/JS/IMG ---
  // 1. Cek Cache dulu (Cepat)
  // 2. Ambil dari Network di background (Update)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Ambil data dari network
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

// 4. Menangani Pesan dari Client (Untuk Trigger Notifikasi Internal)
// Ini menangani pesan "postMessage" yang dikirim dari index.html
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NOTIFICATION') {
    const data = event.data.data;
    
    const options = {
      body: data.body,
      icon: data.icon || '/image/genre/20.png',
      badge: data.icon || '/image/genre/20.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'default', // PENTING: Tag berbeda agar notifikasi pisah (VN, Audio, Video)
      data: {
        url: data.url || '/',
        click_action: data.url || '/' 
      },
      requireInteraction: true
    };

    // Tampilkan notifikasi
    self.registration.showNotification(data.title, options);
  }
});

// 5. Menangani Push Notification dari FCM (Jika nanti Anda setup Server Key FCM)
self.addEventListener('push', (event) => {
  let data = { title: 'GoChat Pro', body: 'Ada pesan baru masuk!' };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if(event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: '/image/genre/20.png',
    badge: '/image/genre/20.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'push_message', // PENTING: Tag berbeda
    data: {
      url: data.url || '/',
      click_action: data.url || '/'
    },
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 6. Menangani Klik pada Notifikasi
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Cek apakah aplikasi sudah terbuka
      for (const client of clientList) {
        // Cek apakah URL client sesuai target URL dari notifikasi
        if (client.url.includes(event.notification.data.url) && 'focus' in client) {
          return client.focus();
        }
      }
      // Jika belum terbuka, buka baru
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
