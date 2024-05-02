function normalize(strArray: string[]) {
    if (strArray.length === 0) return '';

    // Combine array into a single string
    let str = strArray.join('/');

    // Replace multiple slashes with a single slash
    str = str.replace(/\/{2,}/g, '/');

    // Remove trailing slashes if the string has characters other than slashes
    if (str.replace(/\//g, '').length > 0) {
        str = str.replace(/\/+$/, '');
    }

    return str;
}

function isString(value: unknown): value is string {
    return typeof value === 'string';
}

export default function pathJoin(...args: unknown[]) {
    const parts = args.filter(isString);
    return normalize(parts);
}
