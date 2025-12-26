/**
 * Development Logger - Captures console logs and sends to backend
 * Only active in development mode
 */

interface LogEntry {
  timestamp: string;
  level: 'log' | 'error' | 'warn' | 'info' | 'debug';
  message: string;
  data?: any[];
}

class DevLogger {
  private logBuffer: LogEntry[] = [];
  private flushInterval: number = 5000; // Flush every 5 seconds
  private maxBufferSize: number = 50;
  private flushTimer: NodeJS.Timeout | null = null;
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
    debug: typeof console.debug;
  };

  constructor() {
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
    };
  }

  init() {
    if (!import.meta.env.DEV) {
      console.warn('[DevLogger] Not in development mode, logger disabled');
      return;
    }

    console.log('[DevLogger] Initializing development logger...');

    // Intercept console methods
    console.log = (...args: any[]) => {
      this.originalConsole.log(...args);
      this.capture('log', args);
    };

    console.error = (...args: any[]) => {
      this.originalConsole.error(...args);
      this.capture('error', args);
    };

    console.warn = (...args: any[]) => {
      this.originalConsole.warn(...args);
      this.capture('warn', args);
    };

    console.info = (...args: any[]) => {
      this.originalConsole.info(...args);
      this.capture('info', args);
    };

    console.debug = (...args: any[]) => {
      this.originalConsole.debug(...args);
      this.capture('debug', args);
    };

    // Start flush timer
    this.startFlushTimer();

    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });

    this.originalConsole.log('[DevLogger] ✅ Console interceptor active');
  }

  private capture(level: LogEntry['level'], args: any[]) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: this.formatMessage(args),
      data: args.length > 0 ? args : undefined,
    };

    this.logBuffer.push(entry);

    // Auto-flush if buffer is full
    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  private formatMessage(args: any[]): string {
    return args
      .map((arg) => {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(' ');
  }

  private startFlushTimer() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = setInterval(() => {
      if (this.logBuffer.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  private async flush() {
    if (this.logBuffer.length === 0) return;

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Send logs to backend endpoint
      await fetch('/api/dev-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: logsToSend }),
      });
    } catch (error) {
      // Silent fail - don't spam console if logging endpoint is down
      // Use original console to avoid recursion
      this.originalConsole.warn('[DevLogger] Failed to send logs:', error);
    }
  }

  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();

    // Restore original console
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
    console.debug = this.originalConsole.debug;
  }
}

// Create singleton instance
export const devLogger = new DevLogger();

// Auto-init in development mode (DISABLED - endpoint not implemented)
// if (import.meta.env.DEV) {
//   devLogger.init();
// }
