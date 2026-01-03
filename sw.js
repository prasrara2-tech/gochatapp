const CACHE_NAME = 'gochat-v9'; // Naikkan versi ke v9

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/profile.html',
  '/user-profile.html',
  '/group-profile.html',
  '/image/genre/20.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
  'https://meet.jit.si/external_api.js'
];

// --- 1. INSTALL ---
self.addEventListener('install', (event) => {
  console.log('[SW v9] Install mulai...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW v9] Cache dibuka, mulai download aset...');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.error('[SW v9] GAGAL download aset:', err);
        // Tidak throw error, biarkan SW tetap aktif walau aset gagal
      });
    }).then(() => {
      console.log('[SW v9] Selesai install, skipping waiting...');
      self.skipWaiting();
    })
  );
});

// --- 2. ACTIVATE ---
self.addEventListener('activate', (event) => {
  console.log('[SW v9] Activate mulai...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW v9] Menghapus cache lama:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('[SW v9] Selesai activate, claiming clients...');
      return self.clients.claim();
    })
  );
});

// --- 3. STRATEGI FETCH: Network First untuk Firebase, Cache First untuk yang lain ---
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // --- PENTING: JANGAN CACHE DATABASE & API EKSTERNAL ---
  // Firebase Database, Cloudinary, dan Jitsi harus selalu diambil dari Network 
  // agar data chat selalu up-to-date.
  if (url.hostname.includes('firebasedatabase.app') || 
      url.hostname.includes('cloudinary.com') ||
      url.hostname.includes('jit.si')) {
    
    // Cukup fetch saja, jangan cache (mencegah error clone)
    event.respondWith(fetch(event.request));
    return;
  }

  // --- STRATEGI STALE-WHILE-REVALIDATE UNTUK FILE HTML/CSS/JS/IMG ---
  // 1. Cek Cache dulu (Cepat)
  // 2. Ambil dari Network di background (Update)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Simpan request object di variabel agar bisa dipakai lagi
      const requestToCache = event.request;

      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Jika network sukses, simpan update ke cache
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            // --- PERBAIKAN: GUNAKAN requestToCache KETIMBAL networkResponse.clone() ---
            cache.put(requestToCache, networkResponse.clone());
          });
        }
        return networkResponse;
      });

      // Kembalikan cache yang ada dulu (jika ada), jika tidak ada tunggu network
      return cachedResponse || fetchPromise;
    })
  );
});;


// --- 4. HANDLE MESSAGE (POSTMESSAGE DARI JS) ---
self.addEventListener('message', (event) => {
  console.log('[SW v9] Pesan diterima dari client:', event.data);

  if (event.data && event.data.type === 'NOTIFICATION') {
    const data = event.data.data;
    
    // Gambar 1x1 pixel Hitam Pekat untuk Dark Mode
    const blackBg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

    const options = {
      body: data.body,
      icon: data.icon || '/image/genre/20.png',
      badge: '/image/genre/20.png', // Badge Putih di BG Hitam
      
      // --- PENTING: DARK MODE HACK ---
      // Pada Android/Mobile, 'image' ini akan menjadi background di belakang icon
      image: blackBg, 
      
      vibrate: [200, 100, 200],
      tag: data.tag || 'default',
      data: { url: data.url || '/' },
      requireInteraction: true
    };

    console.log('[SW v9] Menampilkan notifikasi:', data.title);
    self.registration.showNotification(data.title, options);
  }
});

// --- 5. PUSH EVENT (OPSIONAL FCM) ---
self.addEventListener('push', (event) => {
  console.log('[SW v9] Push event terima');
  let data = { title: 'GoChat Pro', body: 'Ada pesan baru' };
  
  try {
    if (event.data) data = event.data.json();
  } catch (e) {}

  const blackBg = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  const options = {
    body: data.body,
    icon: '/image/genre/20.png',
    badge: '/image/genre/20.png',
    image: blackBg,
    vibrate: [200, 100, 200],
    tag: data.tag || 'push',
    data: { url: data.url || '/' },
    requireInteraction: True
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// --- 6. CLICK ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(event.notification.data.url) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});



