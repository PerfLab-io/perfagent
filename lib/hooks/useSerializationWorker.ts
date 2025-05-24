import { useCallback, useEffect, useRef } from 'react';

export function useSerializationWorker() {
	const workerRef = useRef<Worker | null>(null);

	useEffect(() => {
		if (typeof window !== 'undefined') {
			workerRef.current = new Worker(
				new URL('../workers/serializer.worker.ts', import.meta.url),
			);
		}

		return () => {
			workerRef.current?.terminate();
		};
	}, []);

	const serializeInWorker = useCallback(
		(traceContents: string, navigationId: string): Promise<string | null> => {
			return new Promise((resolve, reject) => {
				if (!workerRef.current) {
					reject(new Error('Worker not initialized'));
					return;
				}

				const handleMessage = (e: MessageEvent) => {
					if (e.data.error) {
						reject(new Error(e.data.error));
					} else {
						resolve(e.data.serializedData);
					}
					workerRef.current?.removeEventListener('message', handleMessage);
				};

				workerRef.current.addEventListener('message', handleMessage);
				workerRef.current.postMessage({ traceContents, navigationId });
			});
		},
		[],
	);

	return { serializeInWorker };
}
