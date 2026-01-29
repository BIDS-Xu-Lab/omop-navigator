import { fileURLToPath, URL } from 'node:url'
import * as app_config from 'config'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'
import Components from 'unplugin-vue-components/vite'
import tailwindcss from '@tailwindcss/vite'
import * as toolbox from './src/utils/toolbox.js'

export default ({ mode }) => {
  process.env = {...process.env, ...loadEnv(mode, process.cwd())};
  console.log(`* NODE_ENV: ${process.env.NODE_ENV}`);

  // base url
  let VITE_BASE_URL = process.env.VITE_BASE_URL ?? './';
  console.log(`  BASE_URL: ${toolbox.truncate(process.env.VITE_BASE_URL ?? '', -1)}`);

  // read the text content from system_prompt.md and update patient_helper.SYSTEM_PROMPT
  return defineConfig({
    base: VITE_BASE_URL,

    server: {
      host: '0.0.0.0',
      port: 8168,
      watch: {
        usePolling: true,
      },
    },

    define: {
      app_config: app_config.default,
    },

    plugins: [
      vue(),
      // vueDevTools(),
      tailwindcss(),

      Components({
        resolvers: [
          PrimeVueResolver()
        ]
      }),
    ],

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },

    build: {
      outDir: 'dist',
      target: ['es2022', 'chrome89', 'firefox89', 'safari15'],
    },
  })
}