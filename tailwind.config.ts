import type { Config } from 'tailwindcss';
const config = {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{ts,tsx}',
		'./components/**/*.{ts,tsx}',
		'./app/**/*.{ts,tsx}',
		'./src/**/*.{ts,tsx}',
		'./*.{ts,tsx}',
		'*.{js,ts,jsx,tsx,mdx}',
	],
	prefix: '',
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px',
			},
		},
		extend: {
			colors: {
				merino: {
					'50': 'hsl(var(--merino-50) / <alpha-value>)',
					'100': 'hsl(var(--merino-100) / <alpha-value>)',
					'200': 'hsl(var(--merino-200) / <alpha-value>)',
					'300': 'hsl(var(--merino-300) / <alpha-value>)',
					'400': 'hsl(var(--merino-400) / <alpha-value>)',
					'500': 'hsl(var(--merino-500) / <alpha-value>)',
					'600': 'hsl(var(--merino-600) / <alpha-value>)',
					'700': 'hsl(var(--merino-700) / <alpha-value>)',
					'800': 'hsl(var(--merino-800) / <alpha-value>)',
					'900': 'hsl(var(--merino-900) / <alpha-value>)',
					'950': 'hsl(var(--merino-950) / <alpha-value>)',
				},
				peppermint: {
					'25': 'hsl(var(--peppermint-25) / <alpha-value>)',
					'50': 'hsl(var(--peppermint-50) / <alpha-value>)',
					'100': 'hsl(var(--peppermint-100) / <alpha-value>)',
					'200': 'hsl(var(--peppermint-200) / <alpha-value>)',
					'300': 'hsl(var(--peppermint-300) / <alpha-value>)',
					'400': 'hsl(var(--peppermint-400) / <alpha-value>)',
					'500': 'hsl(var(--peppermint-500) / <alpha-value>)',
					'600': 'hsl(var(--peppermint-600) / <alpha-value>)',
					'700': 'hsl(var(--peppermint-700) / <alpha-value>)',
					'800': 'hsl(var(--peppermint-800) / <alpha-value>)',
					'900': 'hsl(var(--peppermint-900) / <alpha-value>)',
					'950': 'hsl(var(--peppermint-950) / <alpha-value>)',
				},
				midnight: {
					'50': 'hsl(var(--midnight-50) / <alpha-value>)',
					'100': 'hsl(var(--midnight-100) / <alpha-value>)',
					'200': 'hsl(var(--midnight-200) / <alpha-value>)',
					'300': 'hsl(var(--midnight-300) / <alpha-value>)',
					'400': 'hsl(var(--midnight-400) / <alpha-value>)',
					'500': 'hsl(var(--midnight-500) / <alpha-value>)',
					'600': 'hsl(var(--midnight-600) / <alpha-value>)',
					'700': 'hsl(var(--midnight-700) / <alpha-value>)',
					'800': 'hsl(var(--midnight-800) / <alpha-value>)',
					'900': 'hsl(var(--midnight-900) / <alpha-value>)',
					'950': 'hsl(var(--midnight-950) / <alpha-value>)',
				},
				sidebar: {
					DEFAULT: 'hsl(var(--peppermint-200))',
					foreground: 'hsl(var(--peppermint-950))',
					primary: 'hsl(var(--peppermint-500))',
					'primary-foreground': 'hsl(var(--peppermint-50))',
					accent: 'hsl(var(--peppermint-50))',
					'accent-foreground': 'hsl(var(--peppermint-900))',
					border: 'hsl(var(--peppermint-500))',
					ring: 'hsl(var(--peppermint-50))',
				},
				border: 'hsl(var(--border) / <alpha-value>)',
				input: 'hsl(var(--input) / <alpha-value>)',
				ring: 'hsl(var(--ring) / <alpha-value>)',
				background: 'hsl(var(--bg-color) / <alpha-value>)',
				foreground: 'hsl(var(--text-color) / <alpha-value>)',
				primary: {
					DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
					foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
					foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
					foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
				},
				muted: {
					DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
					foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
				},
				accent: {
					DEFAULT: 'hsl(var(--accent-color) / <alpha-value>)',
					foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
				},
				popover: {
					DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
					foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
				},
				card: {
					DEFAULT: 'hsl(var(--card-bg) / <alpha-value>)',
					foreground: 'hsl(var(--text-color) / <alpha-value>)',
				},
				base: 'hsl(var(--text-color) / <alpha-value>)',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
			},
		},
	},
	plugins: [
		require('tailwindcss-animate'),
		require('@tailwindcss/container-queries'),
	],
} satisfies Config;

export default config;
