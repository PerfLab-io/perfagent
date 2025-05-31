import type React from 'react';

export default async function TerminalWindow({
	children,
	title,
	footerLinks,
	footerElement,
}: {
	children: React.ReactNode;
	title: string;
	footerLinks?: {
		link: string;
		label: string;
	}[];
	footerElement?: React.ReactNode;
}) {
	return (
		<div className="w-full max-w-md">
			{/* Terminal window header */}
			<div className="bg-peppermint-900 border-peppermint-500 rounded-t-lg border-2 border-dotted p-3">
				<div className="flex items-center gap-2">
					<div className="bg-peppermint-500 h-3 w-3 rounded-full"></div>
					<div className="bg-merino-500 h-3 w-3 rounded-full"></div>
					<div className="h-3 w-3 rounded-full bg-rose-500"></div>
					<span className="text-peppermint-300 ml-2 font-mono text-xs tracking-wider uppercase">
						{title}
					</span>
				</div>
			</div>

			{/* Login form container */}
			<div className="bg-peppermint-950 border-peppermint-500 relative rounded-b-lg border-2 border-t-0 border-dotted p-8">
				{children}

				{/* Footer links */}
				<div className="border-peppermint-600 mt-8 border-t border-dashed pt-6">
					{footerElement ? footerElement : null}
					<div className="text-peppermint-400 flex flex-col items-center justify-between gap-4 font-mono text-xs sm:flex-row">
						{footerLinks?.map((link) => (
							<a
								href={link.link}
								className="hover:text-peppermint-300 transition-colors"
							>
								&gt; {link.label}
							</a>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
