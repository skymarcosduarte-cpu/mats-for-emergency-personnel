import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d9e2fc1183ac4ac8afca2eafa7a26069',
  appName: 'MATS',
  webDir: 'dist',
  server: {
    // Hot reload from sandbox during development
    url: 'https://d9e2fc11-83ac-4ac8-afca-2eafa7a26069.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1a1a2e',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#ef4444',
      sound: 'alert.wav',
    },
    Geolocation: {
      // iOS specific config
    },
    BackgroundGeolocation: {
      // Background location tracking configuration
    },
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#1a1a2e',
  },
  android: {
    backgroundColor: '#1a1a2e',
    allowMixedContent: true,
  },
};

export default config;
