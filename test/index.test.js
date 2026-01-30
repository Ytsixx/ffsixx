import { strict as assert } from 'node:assert';
import pkg from '../index.js';

describe('ffsixx package', () => {
  it('deve exportar algo válido', () => {
    assert.ok(pkg);
  });
});