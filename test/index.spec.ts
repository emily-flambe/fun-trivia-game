import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

describe('Trivia API', () => {
	it('serves HTML at root', async () => {
		const request = new Request('http://localhost/');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.headers.get('Content-Type')).toContain('text/html');
		const text = await response.text();
		expect(text).toContain('Fun Trivia');
	});

	it('returns a question from /api/question', async () => {
		const request = new Request('http://localhost/api/question');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const data = await response.json<{ id: number; question: string; options: string[] }>();
		expect(data.id).toBeGreaterThan(0);
		expect(data.question).toBeTruthy();
		expect(data.options).toHaveLength(4);
	});

	it('checks a correct answer', async () => {
		const request = new Request('http://localhost/api/answer', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ questionId: 1, answer: 1 }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const data = await response.json<{ correct: boolean; message: string }>();
		expect(data.correct).toBe(true);
	});

	it('checks a wrong answer', async () => {
		const request = new Request('http://localhost/api/answer', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ questionId: 1, answer: 0 }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		const data = await response.json<{ correct: boolean; message: string }>();
		expect(data.correct).toBe(false);
		expect(data.message).toContain('Mars');
	});
});
