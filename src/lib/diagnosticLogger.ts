// Diagnostic Logger for UI debugging
// Captures device info, user actions, and component states

const MAX_LOGS = 100;
const STORAGE_KEY = 'mats_diagnostic_logs';

interface DiagnosticEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'action';
  category: string;
  message: string;
  data?: Record<string, unknown>;
  device?: DeviceInfo;
}

interface DeviceInfo {
  userAgent: string;
  platform: string;
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  pixelRatio: number;
  standalone: boolean;
  online: boolean;
  memory?: number;
  connection?: string;
}

// Get device information
export const getDeviceInfo = (): DeviceInfo => {
  const nav = navigator as any;
  
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenWidth: screen.width,
    screenHeight: screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio,
    standalone: window.matchMedia('(display-mode: standalone)').matches || (nav.standalone === true),
    online: navigator.onLine,
    memory: nav.deviceMemory,
    connection: nav.connection?.effectiveType,
  };
};

// Parse user agent for readable device name
export const getDeviceName = (): string => {
  const ua = navigator.userAgent;
  
  if (/iPhone/.test(ua)) {
    const match = ua.match(/iPhone OS (\d+)/);
    return `iPhone (iOS ${match?.[1] || '?'})`;
  }
  if (/iPad/.test(ua)) {
    return 'iPad';
  }
  if (/Android/.test(ua)) {
    const match = ua.match(/Android (\d+\.?.?\d*)/);
    return `Android ${match?.[1] || ''}`;
  }
  if (/Windows/.test(ua)) {
    return 'Windows PC';
  }
  if (/Mac/.test(ua)) {
    return 'Mac';
  }
  if (/Linux/.test(ua)) {
    return 'Linux';
  }
  return 'Unknown Device';
};

// Get stored logs
const getStoredLogs = (): DiagnosticEntry[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save logs to storage
const saveLogs = (logs: DiagnosticEntry[]) => {
  try {
    // Keep only last MAX_LOGS entries
    const trimmed = logs.slice(-MAX_LOGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('[DiagnosticLogger] Failed to save logs:', e);
  }
};

// Main logging function
const log = (
  level: DiagnosticEntry['level'],
  category: string,
  message: string,
  data?: Record<string, unknown>,
  includeDevice = false
) => {
  const entry: DiagnosticEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    data,
    ...(includeDevice && { device: getDeviceInfo() }),
  };

  // Also log to console with prefix
  const prefix = `[${category}]`;
  const consoleData = data ? { ...data, ...(includeDevice && { device: entry.device }) } : undefined;
  
  switch (level) {
    case 'error':
      console.error(prefix, message, consoleData || '');
      break;
    case 'warn':
      console.warn(prefix, message, consoleData || '');
      break;
    case 'action':
      console.log(`🎯 ${prefix}`, message, consoleData || '');
      break;
    default:
      console.log(prefix, message, consoleData || '');
  }

  // Store in localStorage
  const logs = getStoredLogs();
  logs.push(entry);
  saveLogs(logs);
};

// Diagnostic logger API
export const diagLog = {
  // Information logs
  info: (category: string, message: string, data?: Record<string, unknown>) => {
    log('info', category, message, data);
  },

  // Warning logs
  warn: (category: string, message: string, data?: Record<string, unknown>) => {
    log('warn', category, message, data);
  },

  // Error logs (always include device info)
  error: (category: string, message: string, data?: Record<string, unknown>) => {
    log('error', category, message, data, true);
  },

  // User action logs (button clicks, navigation, etc.)
  action: (category: string, action: string, data?: Record<string, unknown>) => {
    log('action', category, action, data);
  },

  // Component lifecycle logs
  mount: (componentName: string, props?: Record<string, unknown>) => {
    log('info', componentName, 'Component mounted', props);
  },

  unmount: (componentName: string) => {
    log('info', componentName, 'Component unmounted');
  },

  // State change logs
  stateChange: (componentName: string, stateName: string, oldValue: unknown, newValue: unknown) => {
    log('info', componentName, `State changed: ${stateName}`, {
      from: oldValue,
      to: newValue,
    });
  },

  // Dialog/Modal logs
  dialogOpen: (dialogName: string, data?: Record<string, unknown>) => {
    log('action', 'Dialog', `Opened: ${dialogName}`, data);
  },

  dialogClose: (dialogName: string, reason?: string) => {
    log('action', 'Dialog', `Closed: ${dialogName}`, { reason });
  },

  // Button click logs
  buttonClick: (buttonName: string, location: string, data?: Record<string, unknown>) => {
    log('action', 'Button', `Clicked: ${buttonName} in ${location}`, data);
  },

  // Get all logs for export/debugging
  getLogs: (): DiagnosticEntry[] => {
    return getStoredLogs();
  },

  // Get logs as formatted string
  getLogsAsText: (): string => {
    const logs = getStoredLogs();
    const device = getDeviceInfo();
    const deviceName = getDeviceName();

    let text = `=== M.A.T.S. Diagnostic Report ===\n`;
    text += `Generated: ${new Date().toISOString()}\n`;
    text += `Device: ${deviceName}\n`;
    text += `Screen: ${device.screenWidth}x${device.screenHeight}\n`;
    text += `Viewport: ${device.viewportWidth}x${device.viewportHeight}\n`;
    text += `Standalone: ${device.standalone}\n`;
    text += `Online: ${device.online}\n`;
    text += `User Agent: ${device.userAgent}\n`;
    text += `\n=== Recent Logs (${logs.length}) ===\n\n`;

    logs.forEach(entry => {
      const icon = {
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
        action: '🎯',
      }[entry.level];

      text += `${icon} [${entry.timestamp}] [${entry.category}] ${entry.message}`;
      if (entry.data) {
        text += ` | ${JSON.stringify(entry.data)}`;
      }
      text += '\n';
    });

    return text;
  },

  // Clear all logs
  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[DiagnosticLogger] Logs cleared');
  },

  // Log session start (with device info)
  sessionStart: () => {
    const device = getDeviceInfo();
    const deviceName = getDeviceName();
    log('info', 'Session', `App started on ${deviceName}`, {
      standalone: device.standalone,
      viewport: `${device.viewportWidth}x${device.viewportHeight}`,
      connection: device.connection,
    }, true);
  },
};

// Export types
export type { DiagnosticEntry, DeviceInfo };
