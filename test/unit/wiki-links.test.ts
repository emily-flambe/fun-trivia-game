import { describe, it, expect } from 'vitest';
import { WikiLinks } from '../../src/app/components/WikiLinks';

// WikiLinks returns a React element tree or null.
// We call the function directly and inspect the returned structure.

describe('WikiLinks', () => {
	it('returns null when links is undefined', () => {
		const result = WikiLinks({ links: undefined });
		expect(result).toBeNull();
	});

	it('returns null when links is empty array', () => {
		const result = WikiLinks({ links: [] });
		expect(result).toBeNull();
	});

	it('renders correct number of links', () => {
		const links = [
			{ text: 'Link A', url: 'https://example.com/a' },
			{ text: 'Link B', url: 'https://example.com/b' },
			{ text: 'Link C', url: 'https://example.com/c' },
		];
		const result = WikiLinks({ links });
		// The outer div contains: a "Read more: " span + one span per link
		const children = result?.props.children;
		// children[0] is "Read more:" span, children[1] is the mapped array
		const linkSpans = children[1];
		expect(linkSpans).toHaveLength(3);
	});

	it('links have correct text and href', () => {
		const links = [
			{ text: 'Wikipedia Article', url: 'https://en.wikipedia.org/wiki/Test' },
		];
		const result = WikiLinks({ links });
		const children = result?.props.children;
		const linkSpans = children[1];
		// linkSpans[0] is a <span> wrapping the <a>
		const anchor = linkSpans[0].props.children[1];
		expect(anchor.props.href).toBe('https://en.wikipedia.org/wiki/Test');
		expect(anchor.props.children).toBe('Wikipedia Article');
	});

	it('links have target="_blank" and rel="noopener noreferrer"', () => {
		const links = [
			{ text: 'Test', url: 'https://example.com' },
		];
		const result = WikiLinks({ links });
		const children = result?.props.children;
		const linkSpans = children[1];
		const anchor = linkSpans[0].props.children[1];
		expect(anchor.props.target).toBe('_blank');
		expect(anchor.props.rel).toBe('noopener noreferrer');
	});

	it('no comma before first link', () => {
		const links = [
			{ text: 'First', url: 'https://example.com/1' },
			{ text: 'Second', url: 'https://example.com/2' },
		];
		const result = WikiLinks({ links });
		const children = result?.props.children;
		const linkSpans = children[1];
		// First span: children[0] is the comma conditional (false for i=0), children[1] is the anchor
		const firstComma = linkSpans[0].props.children[0];
		expect(firstComma).toBeFalsy();
	});

	it('commas between multiple links', () => {
		const links = [
			{ text: 'First', url: 'https://example.com/1' },
			{ text: 'Second', url: 'https://example.com/2' },
			{ text: 'Third', url: 'https://example.com/3' },
		];
		const result = WikiLinks({ links });
		const children = result?.props.children;
		const linkSpans = children[1];
		// Second and third spans should have a comma element
		const secondComma = linkSpans[1].props.children[0];
		const thirdComma = linkSpans[2].props.children[0];
		expect(secondComma).toBeTruthy();
		expect(secondComma.props.children).toBe(', ');
		expect(thirdComma).toBeTruthy();
		expect(thirdComma.props.children).toBe(', ');
	});
});
