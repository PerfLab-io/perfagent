'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function LandingBanner() {
	return (
		<div className="relative w-full overflow-hidden bg-peppermint-50 text-foreground dark:bg-background">
			{/* Dotted background pattern */}
			<svg
				className="absolute inset-0 h-full w-full text-foreground"
				width="100%"
				height="100%"
				xmlns="http://www.w3.org/2000/svg"
			>
				<pattern
					id="dots-pattern"
					x="0"
					y="0"
					width="8"
					height="8"
					patternUnits="userSpaceOnUse"
				>
					<circle cx="0.5" cy="0.5" r="0.5" fill="currentColor" />
				</pattern>
				<rect width="100%" height="100%" fill="url(#dots-pattern)" />
			</svg>

			<div className="container relative mx-auto px-4 py-8 md:py-10">
				<div className="flex flex-col gap-12 lg:flex-row">
					<div className="flex-1 bg-background p-4">
						<h1 className="mb-6 text-5xl font-bold text-foreground">
							Understanding Performance Problems Is Hard
						</h1>

						<p className="max-w-xl text-lg text-foreground opacity-90">
							Web performance issues can be complex and difficult to diagnose.
							PerfAgent gives you AI-powered insights that make optimizations
							more accessible. Turning hours of debugging into minutes of
							clarity by analyzing your traces and identifying potential
							improvements with an intuitive chat.
						</p>
					</div>

					<div className="relative w-full lg:w-1/3">
						{/* Diagonal lines pattern for card */}
						<svg
							className="absolute -left-4 top-4 w-full text-foreground"
							style={{ height: 'calc(100% - 3rem)' }}
							xmlns="http://www.w3.org/2000/svg"
						>
							<pattern
								id="diagonal-lines"
								patternUnits="userSpaceOnUse"
								width="4"
								height="4"
								patternTransform="rotate(45)"
							>
								<line
									x1="0"
									y1="0"
									x2="0"
									y2="10"
									stroke="currentColor"
									strokeWidth="2"
								/>
							</pattern>
							<rect width="100%" height="100%" fill="url(#diagonal-lines)" />
						</svg>

						<Card className="relative rounded-none border border-border bg-card text-foreground shadow-none dark:text-peppermint-950">
							<CardHeader>
								<CardTitle className="text-2xl font-bold">
									Perf Intelligence at your fingertips
								</CardTitle>
							</CardHeader>
							<CardContent>
								<ul className="space-y-3">
									<li className="flex items-baseline gap-2">
										<span className="mt-1 inline-block h-3 w-3 shrink-0">
											<svg
												width="100%"
												height="100%"
												viewBox="0 0 12 12"
												xmlns="http://www.w3.org/2000/svg"
											>
												<defs>
													<pattern
														id="diagonalPattern"
														patternUnits="userSpaceOnUse"
														width="4"
														height="4"
														patternTransform="rotate(45)"
													>
														<rect
															width="4"
															height="4"
															fill="currentColor"
															opacity="0.2"
														/>
														<line
															x1="0"
															y1="1"
															x2="4"
															y2="1"
															stroke="currentColor"
															strokeWidth="1"
														/>
														<line
															x1="0"
															y1="3"
															x2="4"
															y2="3"
															stroke="currentColor"
															strokeWidth="1"
														/>
													</pattern>
												</defs>
												<circle
													cx="6"
													cy="6"
													r="5"
													fill="url(#diagonalPattern)"
													stroke="currentColor"
													strokeWidth="1"
												/>
											</svg>
										</span>
										<span>
											Automated trace analysis to identify potential root causes
										</span>
									</li>
									<li className="flex items-baseline gap-2">
										<span className="mt-1 inline-block h-3 w-3 shrink-0">
											<svg
												width="100%"
												height="100%"
												viewBox="0 0 12 12"
												xmlns="http://www.w3.org/2000/svg"
											>
												<defs>
													<pattern
														id="diagonalPattern"
														patternUnits="userSpaceOnUse"
														width="4"
														height="4"
														patternTransform="rotate(45)"
													>
														<rect
															width="4"
															height="4"
															fill="currentColor"
															opacity="0.2"
														/>
														<line
															x1="0"
															y1="1"
															x2="4"
															y2="1"
															stroke="currentColor"
															strokeWidth="1"
														/>
														<line
															x1="0"
															y1="3"
															x2="4"
															y2="3"
															stroke="currentColor"
															strokeWidth="1"
														/>
													</pattern>
												</defs>
												<circle
													cx="6"
													cy="6"
													r="5"
													fill="url(#diagonalPattern)"
													stroke="currentColor"
													strokeWidth="1"
												/>
											</svg>
										</span>
										<span>Create reports with actionable fixes</span>
									</li>
									<li className="flex items-baseline gap-2">
										<span className="mt-1 inline-block h-3 w-3 shrink-0">
											<svg
												width="100%"
												height="100%"
												viewBox="0 0 12 12"
												xmlns="http://www.w3.org/2000/svg"
											>
												<defs>
													<pattern
														id="diagonalPattern"
														patternUnits="userSpaceOnUse"
														width="4"
														height="4"
														patternTransform="rotate(45)"
													>
														<rect
															width="4"
															height="4"
															fill="currentColor"
															opacity="0.2"
														/>
														<line
															x1="0"
															y1="1"
															x2="4"
															y2="1"
															stroke="currentColor"
															strokeWidth="1"
														/>
														<line
															x1="0"
															y1="3"
															x2="4"
															y2="3"
															stroke="currentColor"
															strokeWidth="1"
														/>
													</pattern>
												</defs>
												<circle
													cx="6"
													cy="6"
													r="5"
													fill="url(#diagonalPattern)"
													stroke="currentColor"
													strokeWidth="1"
												/>
											</svg>
										</span>
										<span>Core Web Vitals analysis</span>
									</li>
								</ul>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
