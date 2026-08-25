import { createApp } from 'vue';
import App from './App.vue';
import keycloak from './auth/keycloak';
import './style.css';

async function startApp() {
  try {
    const authenticated = await keycloak.init({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    });

    if (!authenticated) {
      await keycloak.login();
      return;
    }

    createApp(App)
      .provide('keycloak', keycloak)
      .mount('#app');
  } catch (error) {
    console.error('ไม่สามารถเริ่มต้น Keycloak ได้:', error);

    document.querySelector('#app').innerHTML = `
      <div style="padding: 24px; color: #b91c1c;">
        ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้
      </div>
    `;
  }
}

startApp();