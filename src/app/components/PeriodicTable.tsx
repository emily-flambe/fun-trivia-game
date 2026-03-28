import { useState } from 'react';
import type { PublicItem } from '../lib/api';

// Standard periodic table layout: [row, col] for each atomic number (1-indexed)
const LAYOUT: [number, number][] = [
	// Period 1
	[0, 0], [0, 17],
	// Period 2
	[1, 0], [1, 1], [1, 12], [1, 13], [1, 14], [1, 15], [1, 16], [1, 17],
	// Period 3
	[2, 0], [2, 1], [2, 12], [2, 13], [2, 14], [2, 15], [2, 16], [2, 17],
	// Period 4
	[3, 0], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7], [3, 8], [3, 9], [3, 10], [3, 11], [3, 12], [3, 13], [3, 14], [3, 15], [3, 16], [3, 17],
	// Period 5
	[4, 0], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [4, 7], [4, 8], [4, 9], [4, 10], [4, 11], [4, 12], [4, 13], [4, 14], [4, 15], [4, 16], [4, 17],
	// Period 6
	[5, 0], [5, 1],
	// La-Lu (lanthanides) -> row 8
	[8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [8, 7], [8, 8], [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14], [8, 15], [8, 16],
	// Hf-Rn
	[5, 3], [5, 4], [5, 5], [5, 6], [5, 7], [5, 8], [5, 9], [5, 10], [5, 11], [5, 12], [5, 13], [5, 14], [5, 15], [5, 16], [5, 17],
	// Period 7
	[6, 0], [6, 1],
	// Ac-Lr (actinides) -> row 9
	[9, 2], [9, 3], [9, 4], [9, 5], [9, 6], [9, 7], [9, 8], [9, 9], [9, 10], [9, 11], [9, 12], [9, 13], [9, 14], [9, 15], [9, 16],
	// Rf-Og
	[6, 3], [6, 4], [6, 5], [6, 6], [6, 7], [6, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [6, 15], [6, 16], [6, 17],
];

// Element category colors
const CATEGORY_COLORS: Record<string, string> = {
	'alkali': 'bg-red-900/40 border-red-700/50',
	'alkaline': 'bg-orange-900/40 border-orange-700/50',
	'transition': 'bg-yellow-900/30 border-yellow-700/50',
	'post-transition': 'bg-emerald-900/30 border-emerald-700/50',
	'metalloid': 'bg-teal-900/30 border-teal-700/50',
	'nonmetal': 'bg-sky-900/30 border-sky-700/50',
	'halogen': 'bg-cyan-900/40 border-cyan-700/50',
	'noble': 'bg-violet-900/30 border-violet-700/50',
	'lanthanide': 'bg-pink-900/30 border-pink-700/50',
	'actinide': 'bg-rose-900/30 border-rose-700/50',
};

// Map atomic number to category
function getCategory(z: number): string {
	if ([1, 6, 7, 8, 15, 16, 34].includes(z)) return 'nonmetal';
	if ([9, 17, 35, 53, 85, 117].includes(z)) return 'halogen';
	if ([2, 10, 18, 36, 54, 86, 118].includes(z)) return 'noble';
	if ([3, 11, 19, 37, 55, 87].includes(z)) return 'alkali';
	if ([4, 12, 20, 38, 56, 88].includes(z)) return 'alkaline';
	if ([5, 14, 32, 33, 51, 52].includes(z)) return 'metalloid';
	if ([13, 31, 49, 50, 81, 82, 83, 84, 113, 114, 115, 116].includes(z)) return 'post-transition';
	if (z >= 57 && z <= 71) return 'lanthanide';
	if (z >= 89 && z <= 103) return 'actinide';
	return 'transition';
}

// Map element symbol to standard atomic number
const SYMBOL_TO_Z: Record<string, number> = {
	H: 1, He: 2, Li: 3, Be: 4, B: 5, C: 6, N: 7, O: 8, F: 9, Ne: 10,
	Na: 11, Mg: 12, Al: 13, Si: 14, P: 15, S: 16, Cl: 17, Ar: 18,
	K: 19, Ca: 20, Sc: 21, Ti: 22, V: 23, Cr: 24, Mn: 25, Fe: 26, Co: 27, Ni: 28, Cu: 29, Zn: 30,
	Ga: 31, Ge: 32, As: 33, Se: 34, Br: 35, Kr: 36, Rb: 37, Sr: 38, Y: 39, Zr: 40,
	Nb: 41, Mo: 42, Tc: 43, Ru: 44, Rh: 45, Pd: 46, Ag: 47, Cd: 48, In: 49, Sn: 50,
	Sb: 51, Te: 52, I: 53, Xe: 54, Cs: 55, Ba: 56, La: 57, Ce: 58, Pr: 59, Nd: 60,
	Pm: 61, Sm: 62, Eu: 63, Gd: 64, Tb: 65, Dy: 66, Ho: 67, Er: 68, Tm: 69, Yb: 70,
	Lu: 71, Hf: 72, Ta: 73, W: 74, Re: 75, Os: 76, Ir: 77, Pt: 78, Au: 79, Hg: 80,
	Tl: 81, Pb: 82, Bi: 83, Po: 84, At: 85, Rn: 86, Fr: 87, Ra: 88, Ac: 89, Th: 90,
	Pa: 91, U: 92, Np: 93, Pu: 94, Am: 95, Cm: 96, Bk: 97, Cf: 98, Es: 99, Fm: 100,
	Md: 101, No: 102, Lr: 103, Rf: 104, Db: 105, Sg: 106, Bh: 107, Hs: 108, Mt: 109, Ds: 110,
	Rg: 111, Cn: 112, Nh: 113, Fl: 114, Mc: 115, Lv: 116, Ts: 117, Og: 118,
};

interface Props {
	items: PublicItem[];
}

export function PeriodicTable({ items }: Props) {
	const [selected, setSelected] = useState<string | null>(null);

	// Build lookup: atomic number -> item (using cardFront as the element symbol)
	const zToItem = new Map<number, PublicItem>();
	for (const item of items) {
		const symbol = item.data?.cardFront;
		if (symbol && SYMBOL_TO_Z[symbol] !== undefined) {
			zToItem.set(SYMBOL_TO_Z[symbol], item);
		}
	}

	// Build grid
	const grid: (number | null)[][] = Array.from({ length: 10 }, () => Array(18).fill(null));
	LAYOUT.forEach(([row, col], i) => {
		grid[row][col] = i + 1; // atomic number (1-indexed)
	});

	const selectedItem = selected ? items.find((i) => i.id === selected) : null;

	function renderCell(z: number | null, key: string) {
		if (z === null) return <div key={key} />;
		const item = zToItem.get(z);
		const cat = getCategory(z);
		const hasItem = !!item;
		const isSelected = item ? selected === item.id : false;
		return (
			<button
				key={key}
				onClick={() => {
					if (item) setSelected(isSelected ? null : item.id);
				}}
				className={`p-0.5 rounded text-center border transition-all duration-150
					${hasItem ? 'cursor-pointer' : 'cursor-default opacity-30'}
					${CATEGORY_COLORS[cat] || 'bg-surface-bright border-border-subtle'}
					${isSelected ? 'ring-2 ring-accent scale-110 z-10' : hasItem ? 'hover:brightness-125' : ''}
				`}
				style={{ minWidth: '38px' }}
				disabled={!hasItem}
			>
				<div className="text-[9px] text-text-tertiary leading-none">{z}</div>
				<div className="text-xs font-bold leading-tight">{item?.data?.cardFront || ''}</div>
			</button>
		);
	}

	return (
		<div>
			{/* Detail panel */}
			<div className={`bg-surface-raised rounded-xl p-4 mb-4 min-h-[80px] transition-all duration-200 ${selected ? '' : 'opacity-50'}`}>
				{selectedItem ? (
					<div>
						<div className="flex items-baseline gap-2 mb-1">
							<span className="text-2xl font-bold text-accent">{selectedItem.data?.cardFront}</span>
							<span className="text-lg font-medium">{selectedItem.data?.cardBack}</span>
							{selectedItem.data?.cardFront && SYMBOL_TO_Z[selectedItem.data.cardFront] !== undefined && (
								<span className="text-text-tertiary text-sm">#{SYMBOL_TO_Z[selectedItem.data.cardFront]}</span>
							)}
						</div>
						{selectedItem.explanation && (
							<ul className="text-sm text-text-secondary leading-relaxed space-y-1 list-disc list-outside ml-4">
								{selectedItem.explanation.split('\\n').map((line, i) => (
									<li key={i}>{line}</li>
								))}
							</ul>
						)}
					</div>
				) : (
					<div className="text-text-tertiary text-sm">Click an element to see details</div>
				)}
			</div>

			{/* Periodic table grid */}
			<div className="overflow-x-auto">
				<div className="inline-grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(18, minmax(0, 1fr))', minWidth: '720px' }}>
					{grid.slice(0, 7).flatMap((row, r) =>
						row.map((z, c) => renderCell(z, `${r}-${c}`))
					)}
				</div>

				{/* Gap between main table and lanthanides/actinides */}
				<div className="h-3" />

				{/* Lanthanides & Actinides */}
				<div className="inline-grid gap-[2px] ml-[calc(2*(38px+2px)+2px)]" style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))', minWidth: '600px' }}>
					{grid.slice(8, 10).flatMap((row, r) =>
						row.slice(2, 17).map((z, c) => renderCell(z, `ln-${r}-${c}`))
					)}
				</div>
			</div>

			{/* Legend */}
			<div className="flex flex-wrap gap-2 mt-4 text-[10px]">
				{Object.entries({ 'Alkali Metal': 'alkali', 'Alkaline Earth': 'alkaline', 'Transition Metal': 'transition', 'Post-Transition': 'post-transition', 'Metalloid': 'metalloid', 'Nonmetal': 'nonmetal', 'Halogen': 'halogen', 'Noble Gas': 'noble', 'Lanthanide': 'lanthanide', 'Actinide': 'actinide' }).map(([label, key]) => (
					<span key={key} className={`px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[key]}`}>{label}</span>
				))}
			</div>
		</div>
	);
}
