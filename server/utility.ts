import crypto from 'node:crypto';
import assert from 'node:assert';
import _ from 'lodash';
import debug from 'debug';
import prettyMilliseconds from 'pretty-ms';

type Debugger = debug.Debugger;

export { Debugger };

export function makeToken(length = 32, encoding: BufferEncoding = 'base64'): string {
    return crypto.randomBytes(length).toString(encoding);
}

export function makeDebug(area: string): Debugger {
    return debug('42').extend(area);
}

export function hashString(data: string, hash = 'md5'): string {
    return crypto
        .createHash(hash)
        .update(Buffer.from(data, 'utf-8'))
        .digest('hex');
}

export function expected<T>(value: T): NonNullable<T> {
    assert(value);
    return value;
}

export function last<T>(array: T[]): T | void {
    const length = array.length;
    if (length > 0) {
        return array[length - 1];
    }
}

export function random<T>(from: T[]): T {
    assert(from.length > 0);
    return expected(_.sample(from));
}

export function formatDuration(ms: number): string {
    if (ms < 0) {
        return `${ms}ms`;
    }
    return prettyMilliseconds(ms, {
        separateMilliseconds: true
    });
    /*
    const time = {
      d: Math.floor(ms / 86400000),
      h: Math.floor(ms / 3600000) % 24,
      m: Math.floor(ms / 60000) % 60,
      s: Math.floor(ms / 1000) % 60,
      ms: Math.floor(ms) % 1000
    };
    return Object.entries(time)
      .filter(val => val[1] !== 0)
      .map(([key, val]) => `${val}${key}`)
      .join('');
    */
}
