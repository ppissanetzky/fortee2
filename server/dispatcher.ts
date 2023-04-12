
import EventEmitter from 'node:events';

export default class Dispatcher<T extends object> {

    private readonly emitter: EventEmitter;

    constructor() {
        this.emitter = new EventEmitter();
    }

    on<K extends keyof T>(
        type: K, listener: (event: T[K]) => void) {
        this.emitter.on(type as string, listener);
        return this;
    }

    once<K extends keyof T>(
        type: K, listener: (event: T[K]) => void) {
        this.emitter.once(type as string, listener);
    }

    protected emit<K extends keyof T>(type: K, event: T[K]): void {
        this.emitter.emit(type as string, event);
    }
}
