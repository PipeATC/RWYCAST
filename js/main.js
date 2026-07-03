// Bootstrap — monta la aplicación React y registra el service worker (PWA)
ReactDOM.createRoot(document.getElementById('root')).render(h(App));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .catch(err => console.warn('[RWYCAST] Service worker no registrado:', err));
  });
}
