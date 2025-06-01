import { z } from 'zod';

export const emailSchema = z.object({
	email: z
		.string()
		.min(1, { message: 'Email is required' })
		.email({ message: 'Invalid email address' }),
});

export const signupSchema = z.object({
	email: z
		.string()
		.min(1, { message: 'Email is required' })
		.email({ message: 'Invalid email address' }),
});

export const onboardingSchema = z
	.object({
		username: z
			.string()
			.min(1, { message: 'Username is required' })
			.min(3, { message: 'Username must be at least 3 characters' })
			.max(20, { message: 'Username must be less than 20 characters' })
			.regex(/^[a-zA-Z0-9_-]+$/, {
				message:
					'Username can only contain letters, numbers, underscores, and hyphens',
			}),
		name: z
			.string()
			.min(1, { message: 'Full name is required' })
			.min(2, { message: 'Name must be at least 2 characters' })
			.max(50, { message: 'Name must be less than 50 characters' }),
		password: z
			.string()
			.min(8, { message: 'Password must be at least 8 characters' })
			.regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
				message:
					'Password must contain at least one uppercase letter, one lowercase letter, and one number',
			}),
		confirmPassword: z.string(),
		agreeToTerms: z.boolean().refine((val) => val === true, {
			message: 'You must agree to the Terms of Service',
		}),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword'],
	});

export type EmailFormValues = z.infer<typeof emailSchema>;
export type SignupFormValues = z.infer<typeof signupSchema>;
export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
