import { useCallback, useEffect, useRef } from 'react';
import type {
	TraceWorkerMessage,
	TraceWorkerResponse,
} from '@/lib/workers/trace.worker';

export interface UseTraceWorkerResult {
	analyzeTraceFromFileInWorker: (file: File) => Promise<string>;
	analyzeTraceInWorker: (contents: string) => Promise<any>;
}

export const useTraceWorker = (): UseTraceWorkerResult => {
	const workerRef = useRef<Worker | null>(null);

	useEffect(() => {
		if (typeof window !== 'undefined') {
			workerRef.current = new Worker(
				new URL('../workers/trace.worker.ts', import.meta.url),
			);
		}

		return () => {
			workerRef.current?.terminate();
		};
	}, []);

	const analyzeTraceFromFileInWorker = useCallback(
		(file: File): Promise<string> => {
			return new Promise(async (resolve, reject) => {
				if (!workerRef.current) {
					reject(new Error('Worker not initialized'));
					return;
				}

				try {
					// Read file contents
					const fileContents = await file.text();

					const handleMessage = (e: MessageEvent<TraceWorkerResponse>) => {
						const response = e.data;

						if (response.type === 'error') {
							reject(
								new Error(response.error || 'analyzeTraceFromFile failed'),
							);
							workerRef.current?.removeEventListener('message', handleMessage);
						} else if (response.type === 'success' && response.data) {
							resolve(response.data.result);
							workerRef.current?.removeEventListener('message', handleMessage);
						}
					};

					workerRef.current.addEventListener('message', handleMessage);
					workerRef.current.postMessage({
						type: 'analyzeTraceFromFile',
						contents: fileContents,
					} as TraceWorkerMessage);
				} catch (error) {
					reject(error);
				}
			});
		},
		[],
	);

	const analyzeTraceInWorker = useCallback((contents: string): Promise<any> => {
		return new Promise((resolve, reject) => {
			if (!workerRef.current) {
				reject(new Error('Worker not initialized'));
				return;
			}

			const handleMessage = (e: MessageEvent<TraceWorkerResponse>) => {
				const response = e.data;

				if (response.type === 'error') {
					reject(new Error(response.error || 'analyzeTrace failed'));
					workerRef.current?.removeEventListener('message', handleMessage);
				} else if (response.type === 'success' && response.data) {
					resolve(response.data.result);
					workerRef.current?.removeEventListener('message', handleMessage);
				}
			};

			workerRef.current.addEventListener('message', handleMessage);
			workerRef.current.postMessage({
				type: 'analyzeTrace',
				contents,
			} as TraceWorkerMessage);
		});
	}, []);

	return {
		analyzeTraceFromFileInWorker,
		analyzeTraceInWorker,
	};
};
