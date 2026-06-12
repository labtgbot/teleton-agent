/**
 * LLM Provider Stub
 *
 * Placeholder for the actual LLM provider interface.
 * Replace with real implementation (e.g., @mariozechner/pi-ai wrapper).
 */

export interface LLMProvider {
  generate(prompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<string>;
  embed?(text: string): Promise<number[]>;
}

/** Stub provider that returns empty responses */
export class StubLLMProvider implements LLMProvider {
  async generate(_prompt: string, _options?: { temperature?: number; maxTokens?: number }): Promise<string> {
    return '';
  }
}

export function createLLMProvider(): LLMProvider {
  return new StubLLMProvider();
}
