interface Props {
	imageUrl: string;
	alt: string;
	size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
	sm: 'max-w-[120px] max-h-[80px]',
	md: 'max-w-[240px] max-h-[160px]',
	lg: 'max-w-[320px] max-h-[200px]',
};

export function ItemImage({ imageUrl, alt, size = 'md' }: Props) {
	return (
		<img
			src={imageUrl}
			alt={alt}
			loading="lazy"
			className={`${sizeClasses[size]} w-auto h-auto rounded-lg object-contain`}
		/>
	);
}
