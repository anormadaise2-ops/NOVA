import { AIProvider, ChatMessage, ProviderConfig } from "../types";
import { normalizeBaseUrl, requestJson } from "./http";

interface OllamaResponse { models?: Array<{ name: string }>; response?: string; message?: { content?: string }; }

export class OllamaProvider implements AIProvider {
    public readonly config: ProviderConfig;
    public constructor(config: ProviderConfig) { this.config = { ...config, baseUrl: normalizeBaseUrl(config.baseUrl) }; }
    public async getModels(): Promise<string[]> {
        const data = await requestJson<OllamaResponse>(`${this.config.baseUrl}/api/tags`);
        return (data.models ?? []).map(model => model.name);
    }
    public async chat(messages: ChatMessage[], model = this.config.model, signal?: AbortSignal): Promise<string> {
        if (!model) throw new Error("Select an Ollama model first.");
        const data = await requestJson<OllamaResponse>(`${this.config.baseUrl}/api/chat`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages, stream: false }), signal
        });
        return data.message?.content ?? data.response ?? "";
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
