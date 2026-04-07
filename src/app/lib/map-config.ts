export interface MapConfig {
	center: [number, number];
	scale: number;
}

export function getMapConfig(exerciseId: string): MapConfig {
	if (exerciseId.includes('europe')) return { center: [15, 54], scale: 700 };
	if (exerciseId.includes('south-america')) return { center: [-58, -18], scale: 450 };
	if (exerciseId.includes('africa')) return { center: [20, 2], scale: 350 };
	if (exerciseId.includes('asia')) return { center: [85, 35], scale: 300 };
	if (exerciseId.includes('north-america')) return { center: [-95, 45], scale: 350 };
	return { center: [0, 20], scale: 147 };
}

export function getMapProjectionKey(exerciseId: string): string {
	return `map-projection:${exerciseId}`;
}
