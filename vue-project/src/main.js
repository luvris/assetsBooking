import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import keycloak from './auth/keycloak';

async function bootstrap() {
  try {
    const authenticated = await keycloak.init({
      onLoad: 'login-required',
      checkLoginIframe: false,
      pkceMethod: 'S256',
    });

    if (!authenticated) {
      await keycloak.login();
      return;
    }

    createApp(App).mount('#app');
  } catch (error) {
    console.error('Keycloak initialization failed:', error);

    document.querySelector('#app').innerHTML = `
      <div style="padding: 24px; font-family: sans-serif; color: #b91c1c;">
        ไม่สามารถเชื่อมต่อ Keycloak ได้ กรุณาตรวจสอบ URL, Realm และ Client ID
      </div>
    `;
  }
}

bootstrap();