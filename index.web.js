import { registerRootComponent } from 'expo';

async function boot() {
  const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/commonjs/web');
  await LoadSkiaWeb({ locateFile: (file) => `/${file}` });
  const App = (await import('./App')).default;
  registerRootComponent(App);
}

boot().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[Ashen Dominion] boot failed:', err);
  if (typeof document !== 'undefined') {
    document.body.innerHTML =
      '<pre style="color:#fff;background:#0d0d0f;padding:20px;white-space:pre-wrap;font:14px monospace">' +
      'BOOT ERROR:\n' +
      (err && err.stack ? err.stack : String(err)) +
      '</pre>';
  }
});
