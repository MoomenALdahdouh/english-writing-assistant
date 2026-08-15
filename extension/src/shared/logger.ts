const PREFIX = 'ewa';

export function createLogger(scope: string) {
  const tag = `[${PREFIX}:${scope}]`;
  return {
    debug: (...args: unknown[]) => {
      if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
      // eslint-disable-next-line no-console
      console.debug(tag, ...args);
    },
    info: (...args: unknown[]) => {
      if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return;
      // eslint-disable-next-line no-console
      console.info(tag, ...args);
    },
    warn: (...args: unknown[]) => console.warn(tag, ...args),
    error: (...args: unknown[]) => console.error(tag, ...args),
  };
}
