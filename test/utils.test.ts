import { expect } from "chai";
import pathJoin from "../src/utils.js";

describe('pathJoin', () => {
    it('should join parts into a single URL string', (done) => {
        const input = ['path', 'to', 'resource'];
        const expected = 'path/to/resource';
        expect(pathJoin(...input)).to.eq(expected);
        done();
    });

    it('should replace double slashes with a single slash', (done) => {
        const input = ['path//to', 'resource'];
        const expected = 'path/to/resource';
        expect(pathJoin(...input)).to.eq(expected);
        done();
    });

    it('should remove trailing slashes', (done) => {
        const input = ['path/to/resource//'];
        const expected = 'path/to/resource';
        expect(pathJoin(...input)).to.eq(expected);
        done();
    });

    it('should handle input with non-string parts', (done) => {
        const input = ['path', null, 'to', undefined, 'resource'];
        const expected = 'path/to/resource';
        expect(pathJoin(...input)).to.eq(expected);
        done();
    });

    it('should handle input with only slashes', (done) => {
        const input = ['/', '/', '/'];
        const expected = '/';
        expect(pathJoin(...input)).to.eq(expected);
        done();
    });

    it('should handle input with only double slashes', (done) => {
        const input = ['//', '//', '//'];
        const expected = '/';
        expect(pathJoin(...input)).to.eq(expected);
        done();
    });

    it('should keep one leading slash', (done) => {
        const input = ['/', 'path', 'to', 'resource'];
        const expected = '/path/to/resource';
        expect(pathJoin(...input)).to.eq(expected);
        done();
    });

    it('should return a single slash for empty inputs', (done) => {
        const input = ['', ''];
        const expected = '/';
        expect(pathJoin(...input)).to.eq(expected);
        done();
    });
});
