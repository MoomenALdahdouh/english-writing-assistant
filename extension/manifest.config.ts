import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'English Writing Assistant',
  version: '1.3.13',
  description: 'Inline English spelling and grammar corrections while you type on the web.',
  homepage_url: 'https://writing.zaixos.com',
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'English Writing Assistant',
    default_icon: {
      '16': 'public/icons/icon-16.png',
      '32': 'public/icons/icon-32.png',
      '48': 'public/icons/icon-48.png',
      '128': 'public/icons/icon-128.png',
    },
  },
  icons: {
    '16': 'public/icons/icon-16.png',
    '32': 'public/icons/icon-32.png',
    '48': 'public/icons/icon-48.png',
    '128': 'public/icons/icon-128.png',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: ['storage'],
  host_permissions: [
    'https://api.groq.com/*',
    'https://writing-api.zaixos.com/*',
    'https://writing-api.test/*',
    'http://127.0.0.1:8787/*',
    'http://localhost:8787/*',
  ],
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
      all_frames: true,
    },
  ],
});
