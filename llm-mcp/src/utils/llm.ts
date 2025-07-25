import { LLMConfig } from '../types.js';

export function getLLMConfig(): LLMConfig {
	return {
		openaiApiKey: process.env.OPENAI_API_KEY,
		geminiApiKey: process.env.GEMINI_API_KEY,
		openaiModel: process.env.OPENAI_MODEL || 'o3',
		geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-pro'
	};
}

export async function validateLLMSetup(): Promise<{
	valid: boolean;
	error?: string;
	openaiModel?: string;
	geminiModel?: string;
}> {
	const config = getLLMConfig();

	// At least one API key should be configured
	if (!config.openaiApiKey && !config.geminiApiKey) {
		return {
			valid: false,
			error:
				'No API keys configured. Please set at least one of OPENAI_API_KEY or GEMINI_API_KEY environment variables.'
		};
	}

	// Check if models are configured when API keys are present
	if (config.openaiApiKey && !config.openaiModel) {
		return {
			valid: false,
			error: 'OpenAI API key is set but OPENAI_MODEL is not configured.'
		};
	}

	if (config.geminiApiKey && !config.geminiModel) {
		return {
			valid: false,
			error: 'Gemini API key is set but GEMINI_MODEL is not configured.'
		};
	}

	return {
		valid: true,
		openaiModel: config.openaiApiKey ? config.openaiModel : undefined,
		geminiModel: config.geminiApiKey ? config.geminiModel : undefined
	};
}
