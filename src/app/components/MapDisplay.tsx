import { useState, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from '@vnedyalk0v/react19-simple-maps';
import type { PublicItem } from '../lib/api';
import { getMapConfig } from '../lib/map-config';
import { WikiLinks } from './WikiLinks';
import geoData from '../../../public/countries-110m.json';

// Name mapping: item answer -> TopoJSON name (Natural Earth)
// Only entries where names differ need to be listed
const NAME_ALIASES: Record<string, string[]> = {
	'Czech Republic': ['Czechia'],
	'Czechia': ['Czech Republic'],
	'Bosnia and Herzegovina': ['Bosnia and Herz.'],
	'North Macedonia': ['Macedonia'],
	'Dominican Republic': ['Dominican Rep.'],
	'Central African Republic': ['Central African Rep.'],
	'South Sudan': ['S. Sudan'],
	'Democratic Republic of the Congo': ['Dem. Rep. Congo', 'DR Congo'],
	'Republic of the Congo': ['Congo'],
	'Ivory Coast': ["Côte d'Ivoire", "Cote d'Ivoire"],
	'East Timor': ['Timor-Leste'],
	'Eswatini': ['eSwatini', 'Swaziland'],
	'United States': ['United States of America'],
	'Trinidad and Tobago': ['Trinidad and Tobago'],
};

// Reverse mapping: TopoJSON name -> all item names it could match
function buildGeoToItemMap(items: PublicItem[]): Map<string, PublicItem> {
	const byName = new Map<string, PublicItem>();
	for (const item of items) {
		const name = item.data?.cardBack || '';
		byName.set(name.toLowerCase(), item);
		// Also index aliases
		const aliases = NAME_ALIASES[name];
		if (aliases) {
			for (const alias of aliases) {
				byName.set(alias.toLowerCase(), item);
			}
		}
	}
	return byName;
}

interface Props {
	items: PublicItem[];
	exerciseId: string;
}

export function MapDisplay({ items, exerciseId }: Props) {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const config = getMapConfig(exerciseId);

	const itemLookup = useMemo(() => buildGeoToItemMap(items), [items]);

	const selectedItem = selectedId ? items.find((i) => i.id === selectedId) : null;

	function findItem(geoName: string): PublicItem | undefined {
		return itemLookup.get(geoName.toLowerCase());
	}

	return (
		<div>
			{/* Map */}
			<div className="rounded-xl overflow-hidden border border-border-subtle" style={{ background: '#c8dae8' }}>
				<ComposableMap
					projection="geoMercator"
					projectionConfig={{ center: config.center, scale: config.scale }}
					width={800}
					height={500}
					style={{ width: '100%', height: 'auto' }}
				>
					<ZoomableGroup>
						<Geographies geography={geoData}>
							{({ geographies }: { geographies: any[] }) =>
								geographies.map((geo) => {
									const geoName = geo.properties?.name || '';
									const item = findItem(geoName);
									const isInExercise = !!item;
									const isSelected = item?.id === selectedId;

									return (
										<Geography
											key={geo.rsmKey}
											geography={geo}
											onClick={() => {
												if (item) setSelectedId(isSelected ? null : item.id);
											}}
											style={{
												default: {
													fill: isSelected
														? '#c07830'
														: isInExercise
															? '#e8ddd0'
															: '#d0cbc4',
													stroke: isInExercise ? '#8a7a6a' : '#b0a898',
													strokeWidth: isInExercise ? 0.8 : 0.3,
													outline: 'none',
													cursor: isInExercise ? 'pointer' : 'default',
												},
												hover: {
													fill: isSelected
														? '#c07830'
														: isInExercise
															? '#4a7c6f'
															: '#d0cbc4',
													stroke: isInExercise ? '#8a7a6a' : '#b0a898',
													strokeWidth: isInExercise ? 0.8 : 0.3,
													outline: 'none',
													cursor: isInExercise ? 'pointer' : 'default',
												},
												pressed: {
													fill: isInExercise ? '#c07830' : '#d0cbc4',
													stroke: '#8a7a6a',
													strokeWidth: 0.8,
													outline: 'none',
												},
												focused: {
													fill: isSelected
														? '#c07830'
														: isInExercise
															? '#e8ddd0'
															: '#d0cbc4',
													stroke: isInExercise ? '#8a7a6a' : '#b0a898',
													strokeWidth: isInExercise ? 0.8 : 0.3,
													outline: 'none',
													cursor: isInExercise ? 'pointer' : 'default',
												},
											}}
										/>
									);
								})
							}
						</Geographies>
					</ZoomableGroup>
				</ComposableMap>
			</div>

			{/* Detail panel */}
			<div className={`mt-4 bg-surface-raised rounded-xl p-5 min-h-[80px] transition-all duration-200 ${selectedItem ? '' : 'opacity-50'}`}>
				{selectedItem ? (
					<div>
						<div className="flex items-baseline gap-2 mb-2">
							<span className="text-xl font-bold text-accent">
								{selectedItem.data?.cardBack || selectedItem.id}
							</span>
						</div>
						{selectedItem.explanation && (
							<ul className="text-sm text-text-secondary leading-relaxed space-y-1 list-disc list-outside ml-4">
								{selectedItem.explanation.split('\\n').map((line, i) => (
									<li key={i}>{line}</li>
								))}
							</ul>
						)}
						<WikiLinks links={selectedItem.data?.links} />
					</div>
				) : (
					<div className="text-text-tertiary text-sm">Click a country to see details</div>
				)}
			</div>
		</div>
	);
}
