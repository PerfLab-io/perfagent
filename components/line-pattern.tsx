export const LinePattern = ({ id }: { id: string }) => (
	<svg
		className="absolute inset-0 w-full text-current opacity-50"
		style={{ height: 'calc(100%)' }}
		xmlns="http://www.w2.org/2000/svg"
	>
		<pattern
			id={id}
			patternUnits="userSpaceOnUse"
			width="2.5"
			height="2.5"
			patternTransform="rotate(45)"
		>
			<line
				x1="0"
				y1="0"
				x2="0"
				y2="10"
				stroke="currentColor"
				strokeWidth="2.5"
			/>
		</pattern>
		<rect width="100%" height="100%" fill={`url(#${id})`} />
	</svg>
);
