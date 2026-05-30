const level = process.env.LOG_LEVEL ?? 'info';
const levels: Record<string, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const currentLevel = levels[level] ?? 20;

function log(lvl: string, msg: string, meta?: object): void {
  if ((levels[lvl] ?? 0) < currentLevel) return;
  process.stderr.write(
    JSON.stringify({ level: lvl, msg, ...meta, time: new Date().toISOString() }) + '\n'
  );
}

export const logger = {
  debug: (msg: string, meta?: object) => log('debug', msg, meta),
  info: (msg: string, meta?: object) => log('info', msg, meta),
  warn: (msg: string, meta?: object) => log('warn', msg, meta),
  error: (msg: string, meta?: object) => log('error', msg, meta),
};
