import { AIProvider, ChatMessage, ProviderConfig } from "../types";
import { normalizeBaseUrl, requestJson } from "./http";

interface OpenAIResponse { choices?: Array<{ message?: { content?: string } }>; data?: Array<{ id: string }>; }

export class OpenAICompatibleProvider implements AIProvider {
    public readonly config: ProviderConfig;
    public constructor(config: ProviderConfig, private readonly apiKey?: string) {
        this.config = { ...config, baseUrl: normalizeBaseUrl(config.baseUrl) };
    }
    private headers(): Record<string, string> {
        return { "Content-Type": "application/json", ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}) };
    }
    public async getModels(): Promise<string[]> {
        const data = await requestJson<OpenAIResponse>(`${this.config.baseUrl}/models`, { headers: this.headers() });
        return (data.data ?? []).map(model => model.id);
    }
    public async chat(messages: ChatMessage[], model = this.config.model, signal?: AbortSignal): Promise<string> {
        if (!model) throw new Error("Select a model first.");
        const data = await requestJson<OpenAIResponse>(`${this.config.baseUrl}/chat/completions`, {
            method: "POST", headers: this.headers(), body: JSON.stringify({ model, messages, stream: false }), signal
        });
        return data.choices?.[0]?.message?.content ?? "";
    }
    public async streamChat(messages: ChatMessage[], onToken: (token: string) => void, model?: string, signal?: AbortSignal): Promise<void> {
        onToken(await this.chat(messages, model, signal));
    }
    public generate(prompt: string, model?: string, signal?: AbortSignal): Promise<string> {
        return this.chat([{ role: "user", content: prompt }], model, signal);
    }
    public async checkConnection(): Promise<boolean> {
        try { await this.getModels(); return true; } catch { return false; }
    }
}
