import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      GROQ_API_KEY: '',
      PORT: '8787',
    },
  },
});
