interface WikiLinksProps {
	links?: { text: string; url: string }[];
}

export function WikiLinks({ links }: WikiLinksProps) {
	if (!links || links.length === 0) return null;

	return (
		<div className="mt-2 text-sm">
			<span className="text-text-tertiary">Read more: </span>
			{links.map((link, i) => (
				<span key={i}>
					{i > 0 && <span className="text-text-tertiary">, </span>}
					<a
						href={link.url}
						target="_blank"
						rel="noopener noreferrer"
						className="text-accent hover:underline"
					>
						{link.text}
					</a>
				</span>
			))}
		</div>
	);
}
