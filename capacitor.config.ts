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
      // Use generated splash screens
      layoutName: 'launch_screen',
      useDialog: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#ef4444',
      sound: 'alert.wav',
    },
    Geolocation: {
      // iOS: Required for background location
    },
    BackgroundGeolocation: {
      // Background location tracking configuration
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1a1a2e',
    },
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#1a1a2e',
    // Icon source - Capacitor will auto-generate all sizes from 1024x1024
    // Place app-icon-1024.png in ios/App/App/Assets.xcassets/AppIcon.appiconset
  },
  android: {
    backgroundColor: '#1a1a2e',
    allowMixedContent: true,
    // Icon source - Use Android Studio Asset Studio to generate from app-icon-1024.png
    // Splash: Place splash-portrait.png in android/app/src/main/res/drawable
  },
};

export default config;
