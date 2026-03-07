import pino from 'pino';

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

type LogFn = {
  (msg: string, ...args: any[]): void;
  (obj: object, msg?: string, ...args: any[]): void;
};

function createSmartLogger(method: any): LogFn {
  return (arg1: any, ...args: any[]) => {
    if (typeof arg1 === 'string') {
      const obj = args[0];
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        return method(obj, arg1, ...args.slice(1));
      }
      return method({} as any, arg1, ...args);
    }
    return method(arg1, ...args);
  };
}

const logger = {
  info: createSmartLogger(pinoLogger.info.bind(pinoLogger)),
  error: createSmartLogger(pinoLogger.error.bind(pinoLogger)),
  warn: createSmartLogger(pinoLogger.warn.bind(pinoLogger)),
  debug: createSmartLogger(pinoLogger.debug.bind(pinoLogger)),
  fatal: createSmartLogger(pinoLogger.fatal.bind(pinoLogger)),
  trace: createSmartLogger(pinoLogger.trace.bind(pinoLogger)),
};

export default logger;
