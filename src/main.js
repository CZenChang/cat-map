import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Service worker registration is optional
    });
  });
}

createApp(App).mount('#app');
