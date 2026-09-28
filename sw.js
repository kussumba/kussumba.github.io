// Service worker da KUSSUMBA: guarda os ficheiros da aplicação para funcionar sem internet (§32).
// Os dados do utilizador não passam por aqui; ficam no IndexedDB do telefone.
//
// Ao publicar uma versão nova, mudar VERSAO. Os telefones descarregam os ficheiros novos
// em segundo plano e passam a usá-los na abertura seguinte.

const VERSAO = 'kussumba-2026-09-28-6';

const FICHEIROS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/base.css',
  './css/componentes.css',
  './css/ecras.css',
  './fontes/dm-sans-latin-wght-normal.woff2',
  './icones/favicon.svg',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/icone-maskable-512.png',
  './js/app.js',
  './js/nucleo/alertas.js',
  './js/nucleo/calculos.js',
  './js/nucleo/datas.js',
  './js/nucleo/estados.js',
  './js/nucleo/formatos.js',
  './js/nucleo/unidades.js',
  './js/dados/catalogo-inicial.js',
  './js/dados/db.js',
  './js/dados/ids.js',
  './js/servicos/comum.js',
  './js/servicos/compras.js',
  './js/servicos/copia.js',
  './js/servicos/lista.js',
  './js/servicos/meses.js',
  './js/servicos/precos.js',
  './js/servicos/produtos.js',
  './js/servicos/relatorio.js',
  './js/ui/componentes.js',
  './js/ui/copia.js',
  './js/ui/html.js',
  './js/ui/icones.js',
  './js/ui/router.js',
  './js/ui/ecras/boas-vindas.js',
  './js/ui/ecras/catalogo.js',
  './js/ui/ecras/compra.js',
  './js/ui/ecras/dados.js',
  './js/ui/ecras/comprar.js',
  './js/ui/ecras/lista.js',
  './js/ui/ecras/mes.js',
  './js/ui/ecras/novo-mes.js',
  './js/ui/ecras/primeira-lista.js',
  './js/ui/ecras/relatorio.js',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSAO).then((cache) => cache.addAll(FICHEIROS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n.startsWith('kussumba-') && n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// Primeiro a cópia guardada (abre depressa e sem rede); a rede só para o que não estiver guardado.
// Lê só da cache desta versão, nunca de caches de outras aplicações do mesmo domínio (SEC-001).
// Se a cópia tiver desaparecido, vai à rede em vez de falhar (SEC-006).
async function responder(pedido) {
  const cache = await caches.open(VERSAO);
  const guardado = await cache.match(pedido, { ignoreSearch: true });
  if (guardado) return guardado;
  if (pedido.mode === 'navigate') {
    const pagina = await cache.match('./index.html');
    if (pagina) return pagina;
  }
  return fetch(pedido);
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET' || new URL(pedido.url).origin !== self.location.origin) return;
  if (new URL(pedido.url).pathname.includes('/testes/')) return;
  evento.respondWith(responder(pedido));
});
