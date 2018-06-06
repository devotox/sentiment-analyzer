const assert = require('assert');

const { expect } = require('chai');

const { describe, it } = require('mocha');

const index = require('../../src/lib/index');

describe('Unit | Index', () => {
	it('exists', () => {
		void expect(index).to.be.ok;
	});

	it('Index should be an object', () => {
		assert.equal(typeof index, 'object');
	});
});
