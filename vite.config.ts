import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: { object: 'object.html' },
    },
  },
});
