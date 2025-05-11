// utils/logger.ts
// Logging utility wrapping loguru

/**
 * Logger class for consistent logging throughout the extension
 */
export class Logger {
  constructor(private module: string) {}
  
  /**
   * Log debug message
   */
  debug(message: string, data?: any): void {
    console.debug(`[${this.module}] ${message}`, data !== undefined ? data : '');
  }
  
  /**
   * Log info message
   */
  info(message: string, data?: any): void {
    console.info(`[${this.module}] ${message}`, data !== undefined ? data : '');
  }
  
  /**
   * Log warning message
   */
  warning(message: string, data?: any): void {
    console.warn(`[${this.module}] ${message}`, data !== undefined ? data : '');
  }

  /**
   * Alias for warning method (to match loguru API)
   */
  warn(message: string, data?: any): void {
    this.warning(message, data);
  }
  
  /**
   * Log error message
   */
  error(message: string, data?: any): void {
    console.error(`[${this.module}] ${message}`, data !== undefined ? data : '');
  }
}

/**
 * Loguru mock for browser extension use
 */
class LoguruMock {
  /**
   * Get logger for a module
   */
  getLogger(module: string): Logger {
    return new Logger(module);
  }
}

// Export singleton instance
export const loguru = new LoguruMock();
