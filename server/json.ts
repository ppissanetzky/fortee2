import _ from 'lodash';
import { Bid, Trump, Bone } from './core';

/**
 * For JSON.stringify
 */

function replacer(key: string, value: any): any {
    if (value instanceof Bid) {
        return `#bid:${value.name}`;
    }
    if (value instanceof Trump) {
        return `#trump:${value.name}`
    }
    if (value instanceof Bone) {
        return `#bone:${value.name}`;
    }
    return value;
}

export function stringify(value: any): string {
    return JSON.stringify(value, replacer);
}

function reviver(key: string, value: any): any {
    if (_.isString(value)) {
        if (value.startsWith('#bid:')) {
            return Bid.find(value.substring(5));
        }
        if (value.startsWith('#trump:')) {
            return Trump.find(value.substring(7));
        }
        if (value.startsWith('#bone:')) {
            return Bone.find(value.substring(6))
        }
    }
    return value;
}

export function parse(text: string): any {
    return JSON.parse(text, reviver);
}

