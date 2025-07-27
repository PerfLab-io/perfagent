import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
	customProvider,
	simulateStreamingMiddleware,
	wrapLanguageModel,
} from 'ai';
import { serverEnv } from '@/lib/env/server';
import { createOpenAI } from '@ai-sdk/openai';

const local = createOpenAI({
	baseURL: 'http://localhost:11434/v1',
	apiKey: 'ollama', // required but unused
});

const middleware = simulateStreamingMiddleware();

const localModels = {
	default_model: wrapLanguageModel({
		model: local('qwen2.5-coder:14b', {
			structuredOutputs: true,
		}),
		middleware,
	}),
	topics_model: wrapLanguageModel({
		model: local('llama3.1:8b', {
			structuredOutputs: true,
		}),
		middleware,
	}),
};

const google = createGoogleGenerativeAI({
	apiKey: serverEnv.GEMINI_API_KEY,
});

const googleModels = {
	default_model: google('gemini-2.5-flash', {
		structuredOutputs: true,
	}),
	topics_model: google('gemini-2.0-flash-lite', {
		structuredOutputs: true,
	}),
};

export const perflab = customProvider({
	languageModels:
		// process.env.NODE_ENV === 'development' ? localModels : googleModels,
		googleModels,
});
