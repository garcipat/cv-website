import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import { levelWritePlugin } from './vite/levelWritePlugin';
import { blueprintWritePlugin } from './vite/blueprintWritePlugin';

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss(), levelWritePlugin(), blueprintWritePlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
