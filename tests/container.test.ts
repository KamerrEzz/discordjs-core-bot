import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Container } from '../dist/core/Container.js';

describe('DI Container', () => {
  describe('instantiation', () => {
    it('returns the same instance on repeated calls', () => {
      const c1 = Container.getInstance();
      const c2 = Container.getInstance();
      assert.strictEqual(c1, c2);
    });

    it('creates a fresh container after clear()', () => {
      Container.getInstance().registerSingleton('TestService', () => ({ test: true }));
      assert.strictEqual(Container.getInstance().has('TestService'), true);
      Container.getInstance().clear();
      assert.strictEqual(Container.getInstance().has('TestService'), false);
    });
  });

  describe('register and resolve', () => {
    it('registers and resolves singletons', async () => {
      const c = Container.getInstance();
      c.registerSingleton('StringService', () => 'hello');
      const a = await c.resolve('StringService');
      const b = await c.resolve('StringService');
      assert.strictEqual(typeof a, 'string');
      assert.strictEqual(a, b); // same instance (singleton)
    });

    it('creates new instances for transient services', async () => {
      const c = Container.getInstance();
      let counter = 0;
      c.registerTransient('CounterService', () => (counter++));
      const a = await c.resolve<number>('CounterService');
      const b = await c.resolve<number>('CounterService');
      assert.notStrictEqual(a, b); // different instances
    });
  });
});