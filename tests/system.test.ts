import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Container } from '../dist/core/Container.js';

describe('Systems pattern', () => {
  let container: InstanceType<typeof Container>;

  beforeEach(() => {
    container = Container.getInstance();
    container.clear();
  });

  describe('register', () => {
    it('accepts service registrations', () => {
      container.registerSingleton('MockService', () => ({ name: 'mock' }));
      assert.strictEqual(container.has('MockService'), true);
    });

    it('registers both singleton and transient services', () => {
      container.registerSingleton('SingletonService', () => ({ type: 'singleton' }));
      container.registerTransient('TransientService', () => ({ type: 'transient' }));
      assert.strictEqual(container.has('SingletonService'), true);
      assert.strictEqual(container.has('TransientService'), true);
    });
  });

  describe('list (getRegisteredServices)', () => {
    it('returns all registered service names', () => {
      container.registerSingleton('ServiceA', () => ({}));
      container.registerSingleton('ServiceB', () => ({}));
      const services = container.getRegisteredServices();
      assert.ok(services.includes('ServiceA'));
      assert.ok(services.includes('ServiceB'));
    });

    it('returns an empty array when no services registered', () => {
      container.clear();
      assert.strictEqual(container.getRegisteredServices().length, 0);
    });
  });

  describe('get (resolve)', () => {
    it('resolves registered services', async () => {
      const value = { data: 42 };
      container.registerSingleton('DataSvc', () => value);
      const resolved = await container.resolve('DataSvc');
      assert.strictEqual(resolved, value);
    });

    it('throws for unregistered services', async () => {
      await assert.rejects(
        () => container.resolve('NonExistent'),
        /not found in container/
      );
    });
  });
});