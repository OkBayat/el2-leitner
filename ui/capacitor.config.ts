/// <reference types="@capacitor/app" />
/// <reference types="@capacitor/keyboard" />
/// <reference types="@capgo/capacitor-updater" />

import type { CapacitorConfig } from '@capacitor/cli';

const allowedChannels = new Set(['development', 'staging', 'production']);
const liveUpdatesEnabled = process.env['VOCORA_LIVE_UPDATES_ENABLED'] === 'true';
const requestedChannel = process.env['VOCORA_LIVE_UPDATE_CHANNEL'] || 'production';

if (!allowedChannels.has(requestedChannel)) {
  throw new Error('VOCORA_LIVE_UPDATE_CHANNEL must be development, staging, or production.');
}

const config: CapacitorConfig = {
  appId: 'ir.vocora',
  appName: 'Vocora',
  webDir: 'dist/browser',
  backgroundColor: '#ffffff',
  loggingBehavior: 'none',
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
    iosScheme: 'capacitor',
    cleartext: false,
  },
  plugins: {
    App: {
      disableBackButtonHandler: true,
    },
    CapacitorHttp: {
      enabled: true,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
      autoBackdropColor: 'dom',
    },
    SystemBars: {
      insetsHandling: 'css',
      style: 'DEFAULT',
      hidden: false,
      animation: 'NONE',
    },
    CapacitorUpdater: {
      appId: 'ir.vocora',
      appReadyTimeout: 10_000,
      responseTimeout: 20,
      autoUpdate: liveUpdatesEnabled ? 'onlyDownload' : 'off',
      defaultChannel: liveUpdatesEnabled ? requestedChannel : undefined,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      resetWhenUpdate: true,
      allowShakeMenu: false,
      allowShakeChannelSelector: false,
    },
  },
};

export default config;
