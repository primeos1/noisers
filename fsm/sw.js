const STATIC_CACHE = 'fsm-static-v2';
const DYNAMIC_CACHE = 'fsm-dynamic-v2';

const ASSETS_TO_CACHE = [
    './',
    './index.php',
    './offline.html',
    './assets/css/style.css',
    './assets/css/responsive.css',
    './football.png'
];

// 1. Install Event: Cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            console.log('Caching static shell...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 2. Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map(key => caches.delete(key))
            );
        })
    );
});

// 3. Fetch Event: Network First for PHP, Cache First for assets
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Ensure we are matching our own domain
    if (url.origin === location.origin) {
        // Improved detection for pages vs assets
        const isNavigation = event.request.mode === 'navigate';
        const isPHP = url.pathname.includes('.php');

        if (isNavigation || isPHP) {
            event.respondWith(
                fetch(event.request)
                    .then((networkResponse) => {
                        return caches.open(DYNAMIC_CACHE).then((cache) => {
                            // Save a fresh copy to the dynamic cache
                            cache.put(event.request, networkResponse.clone());
                            return networkResponse;
                        });
                    })
                    .catch(() => {
                        // Fallback logic
                        return caches.match(event.request).then((cachedResponse) => {
                            return cachedResponse || caches.match('./offline.html');
                        });
                    })
            );
        } else {
            // Static assets: Cache First
            event.respondWith(
                caches.match(event.request).then((res) => res || fetch(event.request))
            );
        }
    }
});