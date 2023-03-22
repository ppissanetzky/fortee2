
import crypto from 'node:crypto';
import debug from 'debug';

type Debugger = debug.Debugger;

export { Debugger };

export function makeToken(length = 32, encoding: BufferEncoding = 'base64'): string {
    return crypto.randomBytes(length).toString(encoding);
}

export function makeDebug(area: string): Debugger {
    return debug(`42:${area}`);
}

export function hashString(data: string, hash = 'md5'): string {
    return crypto
        .createHash(hash)
        .update(Buffer.from(data, 'utf-8'))
        .digest('hex');
}
