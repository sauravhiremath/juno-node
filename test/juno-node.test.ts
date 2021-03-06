import sinonChai from 'sinon-chai';
import chai, { expect, assert } from 'chai';
import chaiExclude from 'chai-exclude';
import chaiAsPromised from 'chai-as-promised';
import { sleep, makeConnectionTests } from './helpers';
import sinon from 'sinon';

chai.use(chaiExclude);
chai.use(sinonChai);
chai.use(chaiAsPromised);

makeConnectionTests('Initalize Tests', function () {
	it('initalize request constructed correctly', async function () {
		this.test.module.initialize('test-module', '1.0.0');
		await sleep(0);
		const message = this.test.getLatestSent();
		expect(message).excluding('requestId').to.deep.equal({
			type: 1,
			moduleId: 'test-module',
			version: '1.0.0',
			dependencies: {}
		});
	});

	it('initialize with deps constructed correctly', async function () {
		this.test.module.initialize('test-module', '1.0.0', {
			'test-module2': '1.0.1',
			'test-module3': '1.0.2'
		});
		await sleep(0);
		const message = this.test.getLatestSent();
		expect(message).excluding('requestId').to.deep.equal({
			type: 1,
			moduleId: 'test-module',
			version: '1.0.0',
			dependencies: {
				'test-module2': '1.0.1',
				'test-module3': '1.0.2'
			}
		});
	});

	it('Initialize resolves correctly/Cannot initalize twice', async function () {
		const p = this.test.module.initialize('test-module1', '1.0.0', {});
		await sleep(0);
		const requestId = this.test.getLatestSent().requestId;
		this.test.conn.sendResponse({
			requestId,
			type: 2,
		});
		this.test.conn.sendResponse({
			requestId: '123',
			hook: 'juno.activated',
			type: 8
		});
		expect(p).to.eventually.equal(true);
		return expect(
			this.test.module.initialize('test-module2', '1.0.0', {})
		).to.be.rejectedWith(Error);
	});
}, false);

makeConnectionTests('Test if requests constructed correctly', function () {
	it('declareFunction', function () {
		this.test.module.declareFunction('test_fn', () => { });
		const message = this.test.getLatestSent();
		expect(message).excluding('requestId').to.deep.equal({
			function: 'test_fn',
			type: 9
		});
	});


	it('functionCall with empty args', function () {
		this.test.module.callFunction('module.test_fn');
		const message = this.test.getLatestSent();
		expect(message).excluding('requestId').to.deep.equal({
			function: 'module.test_fn',
			type: 3,
			arguments: {}
		});
	});

	it('functionCall with args', function () {
		this.test.module.callFunction('module.test_fn', {
			a: 1,
			b: 2
		});
		const message = this.test.getLatestSent();
		expect(message).excluding('requestId').to.deep.equal({
			function: 'module.test_fn',
			type: 3,
			arguments: {
				a: 1,
				b: 2
			}
		});
	});

	it('registerHook', function () {
		this.test.module.registerHook('test_hook', () => { });
		const message = this.test.getLatestSent();
		expect(message).excluding('requestId').to.deep.equal({
			hook: 'test_hook',
			type: 5,
		});
	});

	it('triggerHook', function () {
		this.test.module.triggerHook('test_hook');
		const message = this.test.getLatestSent();
		expect(message).excluding('requestId').to.deep.equal({
			type: 7,
			hook: 'test_hook',
		});
	});
});


makeConnectionTests(
	'Test if responses from juno parsed correctly',
	async function () {
		it('declareFunction', async function () {
			const p = this.test.module.declareFunction('test_fn', () => { });
			const requestId = this.test.getLatestSent().requestId;
			await sleep(0);
			this.test.conn.sendResponse({
				requestId,
				type: 10,
				function: 'test_fn'
			});
			return expect(p).to.eventually.equal(true);
		});
		it('hookRegistered', async function () {
			const p = this.test.module.registerHook('test_hook', () => { });
			await sleep(0);
			const requestId = this.test.getLatestSent().requestId;
			this.test.conn.sendResponse({
				requestId,
				type: 6,
			});

			return expect(p).to.eventually.equal(true);
		});

		it('hookTriggered', async function () {
			const fn = sinon.fake();
			const p = this.test.module.registerHook('test_hook', fn);
			await sleep(0);
			this.test.conn.sendResponse({
				requestId: '12345',
				type: 8,
				hook: 'test_hook'
			});
			// await sleep(0);
			assert(fn.calledOnce);
		});

		it('functionCall', async function () {
			const fn = sinon.fake();
			const p = this.test.module.declareFunction('test_fn', fn);
			await sleep(0);

			this.test.conn.sendResponse({
				requestId: '12345',
				type: 3,
				function: 'test_fn'
			});

			assert(fn.calledOnce);

			this.test.conn.sendResponse({
				requestId: '12345',
				type: 3,
				function: 'test_fn',
				arguments: { a: 1, b: 2 }
			});

			expect(fn.getCall(1).args[0]).to.deep.equal({ a: 1, b: 2 });
		});

		it('functionResponse', async function () {
			const p = this.test.module.callFunction('module.test_fn');
			await sleep(0);
			const requestId = this.test.getLatestSent().requestId;

			this.test.conn.sendResponse({
				requestId,
				type: 4,
				data: {
					a: 1,
					b: 2
				}
			});

			return expect(p).to.eventually.deep.equal({
				a: 1,
				b: 2
			});
		});
	}
);
