import 'primeicons/primeicons.css';
import './assets/style.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import Aura from '@primevue/themes/aura';
import { definePreset } from '@primevue/themes';
import { library } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { far } from '@fortawesome/free-regular-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';

import App from './App.vue';
import router from './router';
import { theme } from './theme';
import { useDataStore } from './stores/DataStore';
import { useSettingStore } from './stores/SettingStore';
import packageJson from '../package.json';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(ToastService);

const myTheme = definePreset(Aura, theme);
app.use(PrimeVue, {
  theme: {
    preset: myTheme,
    options: {},
  },
});

app.directive('tooltip', Tooltip);

library.add(fas, far, fab);
app.component('font-awesome-icon', FontAwesomeIcon);

const settingStore = useSettingStore();
settingStore.loadSettingsFromLocalStorage();

const dataStore = useDataStore();
dataStore.app_config = app_config;
dataStore.version = packageJson.version;
void dataStore.init();

app.mount('#app');
