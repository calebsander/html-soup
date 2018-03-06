const util = require('util');

const assert = {
	instanceOf(instance, constructors) {
		if (!(constructors instanceof Array)) constructors = [constructors];
		let constructorMatched = false;
		for (let constructor of constructors) {
			if (instance instanceof constructor || (instance !== undefined && instance !== null && instance.constructor === constructor)) { //second case is necessary for primitives
				constructorMatched = true;
				break;
			}
		}
		if (!constructorMatched) throw new TypeError(util.inspect(instance) + ' is not an instance of ' + constructors.map((constructor) => constructor.name).join(' or '));
	},
	equal(actual, expected) {
		const error = new RangeError('Expected ' + util.inspect(expected) + ' but got ' + util.inspect(actual));
		if (expected && expected.constructor === Object) {
			let expectedKeyCount = 0;
			for (let key in expected) {
				if (expected.hasOwnProperty(key)) {
					try { assert.equal(actual[key], expected[key]) } //eslint-disable-line semi
					catch (e) { throw error } //eslint-disable-line semi
				}
				expectedKeyCount++;
			}
			let actualKeyCount = 0;
			for (let key in actual) actualKeyCount++;
			assert.equal(actualKeyCount, expectedKeyCount);
		}
		else if (expected && expected.constructor === Array) {
			if (!(actual && actual.constructor === Array)) throw error;
			try { assert.equal(actual.length, expected.length) } //eslint-disable-line semi
			catch (e) { throw error } //eslint-disable-line semi
			for (let i = 0; i < expected.length; i++) {
				try { assert.equal(actual[i], expected[i]) } //eslint-disable-line semi
				catch (e) { throw error } //eslint-disable-line semi
			}
		}
		else if (expected && expected.constructor === Map) {
			if (!(actual && actual.constructor === Map)) throw error;
			try { assert.equal(actual.size, expected.size) } //eslint-disable-line semi
			catch (e) { throw error } //eslint-disable-line semi
			const expectedIterator = expected.entries();
			const actualIterator = actual.entries();
			let entry;
			while (!(entry = expectedIterator.next()).done) {
				try { assert.equal(entry.value, actualIterator.next().value) } //eslint-disable-line semi
				catch (e) { throw error } //eslint-disable-line semi
			}
		}
		else if (expected && expected.constructor === Set) {
			if (!(actual && actual.constructor === Set)) throw error;
			try { assert.equal(actual.size, expected.size) } //eslint-disable-line semi
			catch (e) { throw error } //eslint-disable-line semi
			const expectedIterator = expected.values();
			const actualIterator = actual.values();
			let entry;
			while (!(entry = expectedIterator.next()).done) {
				try { assert.equal(entry.value, actualIterator.next().value) } //eslint-disable-line semi
				catch (e) { throw error } //eslint-disable-line semi
			}
		}
		else {
			if (expected !== actual) throw error;
		}
	}
};
module.exports = assert;