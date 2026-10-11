/* Deixa o app abrir sem internet. Para publicar uma versão nova do app,
   troque o número em VERSAO (ex.: v2). Os aparelhos pegam a versão nova
   na próxima vez que abrirem o app com internet. */
const VERSAO = 'v1';
const CACHE = 'meus-gastos-' + VERSAO;
const BASE = new URL('./', self.location.href).href;
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil((async function () {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    const chaves = await caches.keys();
    await Promise.all(chaves.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // A sincronização com a planilha nunca passa pelo cache.
  if (url.hostname === 'script.google.com' || url.hostname.endsWith('googleusercontent.com')) return;
  if (req.mode === 'navigate') { e.respondWith(paginaPrimeiro(req)); return; }
  e.respondWith(cacheERevalida(req));
});

async function paginaPrimeiro(req) {
  const c = await caches.open(CACHE);
  const chave = BASE + 'index.html';
  const guardada = await c.match(chave);
  const rede = fetch(req).then(function (r) {
    if (r && r.ok) c.put(chave, r.clone());
    return r;
  });
  if (!guardada) { try { return await rede; } catch (err) { return Response.error(); } }
  // Com sinal fraco, não espera a rede por mais de 3 segundos.
  const limite = new Promise(function (res) { setTimeout(function () { res(guardada); }, 3000); });
  try { return await Promise.race([rede.catch(function () { return guardada; }), limite]); }
  catch (err) { return guardada; }
}

async function cacheERevalida(req) {
  const c = await caches.open(CACHE);
  const guardada = await c.match(req);
  const rede = fetch(req).then(function (r) {
    if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
    return r;
  }).catch(function () { return null; });
  if (guardada) return guardada;
  const r = await rede;
  return r || Response.error();
}
