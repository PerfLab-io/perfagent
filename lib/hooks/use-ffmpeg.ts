'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { fetchFile } from '@ffmpeg/util';
import type { FFmpeg } from '@ffmpeg/ffmpeg';

/**
 * Options for converting frames to a format.
 */
export interface ConvertOptions {
	fps?: number;
	loop?: number;
	quality?: number;
	outputType?: 'blob' | 'url';
}

/**
 * Return type of the useFFmpeg hook.
 */
export interface UseFFmpegReturn {
	/**
	 * Convert an array of frames to the specified format.
	 * @param format - e.g. 'webp'
	 * @param frames - array of File, Blob, or URL strings
	 * @param options - conversion options
	 * @returns Promise resolving to a Blob or URL string, or null on error.
	 */
	convertToFormat(
		format: string,
		frames: Array<File | Blob | string>,
		options?: ConvertOptions,
	): Promise<Blob | string | null>;

	/** true while loading or converting */
	isLoading: boolean;
	/** conversion progress, 0–100 */
	progress: number;
	/** error message, if any */
	error: string | null;
}

/**
 * React hook for in-browser processing using ffmpeg.wasm.
 */
export function useFFmpeg(): UseFFmpegReturn {
	const ffmpegRef = useRef<FFmpeg | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [progress, setProgress] = useState<number>(0);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const initFFmpeg = async () => {
			const { FFmpeg } = await import('@ffmpeg/ffmpeg');
			ffmpegRef.current = new FFmpeg();
		};
		initFFmpeg();
	}, []);

	const convertToFormat = useCallback(
		async (
			format: string,
			frames: Array<File | Blob | string>,
			options: ConvertOptions = {},
		): Promise<Blob | string | null> => {
			const ffmpeg = ffmpegRef.current;
			if (!ffmpeg) {
				setError('FFmpeg instance not initialized');
				return null;
			}

			setError(null);
			setIsLoading(true);
			setProgress(0);

			try {
				if (!ffmpeg.loaded) {
					await ffmpeg.load();
				}

				// Normalize inputs
				format = format.toLowerCase();
				const fps = options.fps ?? 15;
				const loop = options.loop ?? 0;
				const quality = options.quality ?? 75;
				const outputType = options.outputType ?? 'blob';

				// Determine extension
				let frameExt = 'png';
				const first = frames[0];
				if (typeof first === 'string') {
					const url = first;
					if (url.startsWith('data:')) {
						const m = url.match(/^data:image\/(\w+);/);
						if (m) frameExt = m[1];
					} else {
						try {
							const path = new URL(url, window.location.href).pathname;
							const extm = path.match(/\.(\w+)$/);
							if (extm) frameExt = extm[1];
						} catch {}
					}
				} else if (first instanceof File) {
					const nm = first.name.toLowerCase();
					const i = nm.lastIndexOf('.');
					if (i >= 0) frameExt = nm.slice(i + 1);
				} else if (first instanceof Blob) {
					const t = first.type;
					if (t.startsWith('image/')) frameExt = t.split('/')[1];
				}
				if (frameExt === 'jpg') frameExt = 'jpeg';

				// Write frames to FFmpeg FS
				const count = frames.length;
				const pad = Math.max(3, String(count).length);
				const names: string[] = [];

				for (let i = 0; i < count; i++) {
					const data = await fetchFile(frames[i]);
					const name = `frame_${String(i + 1).padStart(pad, '0')}.${frameExt}`;
					await ffmpeg.writeFile(name, data);
					names.push(name);
				}

				// Build FFmpeg args
				const outputName = `output.${format}`;
				let args: string[];

				if (format === 'webp') {
					args = [
						'-framerate',
						`${fps}`,
						'-i',
						`frame_%0${pad}d.${frameExt}`,
						'-loop',
						`${loop}`,
						'-c:v',
						'libwebp',
						'-q:v',
						`${quality}`,
						outputName,
					];
				} else {
					throw new Error(`Unsupported format: ${format}`);
				}

				// Run conversion
				await ffmpeg.exec(args);

				// Retrieve and cleanup
				const out = await ffmpeg.readFile(outputName);
				const blob = new Blob([out], { type: `image/${format}` });

				// remove files
				ffmpeg.deleteFile(outputName);
				names.forEach((n) => {
					try {
						ffmpeg.deleteFile(n);
					} catch {}
				});

				// TODO: For now I just want url strings, but this might come in handy
				// if (outputType === 'url') {
				// 	return URL.createObjectURL(blob);
				// }
				// return blob;
				return URL.createObjectURL(blob);
			} catch (e: any) {
				console.error(e);
				setError(e.message || 'Conversion failed');
				return null;
			} finally {
				setIsLoading(false);
				setProgress((prev) => (prev < 100 ? 100 : prev));
			}
		},
		[ffmpegRef.current],
	);

	return { convertToFormat, isLoading, progress, error };
}
