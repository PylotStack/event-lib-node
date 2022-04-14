// https://github.com/lodash/lodash/blob/master/last.js

export function last<T>(array: T[]) : T | undefined {
    const length = array == null ? 0 : array.length;
    return length ? array[length - 1] : undefined;
}

export function uniq<T>(array: T[]) : T[]{
    return Array.from(new Set(array));
}
