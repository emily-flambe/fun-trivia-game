import type { DisplayType } from '../../data/types';

export function shouldRenderMapDisplay(displayType: DisplayType | undefined, mode: string): boolean {
	return displayType === 'map' && (mode === 'learn' || mode === 'quiz');
}
