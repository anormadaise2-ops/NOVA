import * as vscode from "vscode";
import { ApiKeyManager } from "../security/keyManager";
import { AIProvider, ProviderConfig } from "../types";
import { OllamaProvider } from "./ollamaProvider";
import { OpenAICompatibleProvider } from "./openaiCompatibleProvider";

const PROVIDERS_KEY = "nova.providers";

export class ProviderManager {
    private readonly providers = new Map<string, ProviderConfig>();
    public constructor(private readonly context: vscode.ExtensionContext, private readonly keys: ApiKeyManager) {
        const configs = context.globalState.get<ProviderConfig[]>(PROVIDERS_KEY, []);
        for (const config of configs) this.providers.set(config.id, config);
    }
    public listProviders(): ProviderConfig[] { return [...this.providers.values()]; }
    public getProvider(id: string): ProviderConfig | undefined { return this.providers.get(id); }
    public async addProvider(config: ProviderConfig, apiKey?: string): Promise<void> {
        if (this.providers.has(config.id)) throw new Error("Provider ID already exists.");
        await this.save(config, apiKey);
    }
    public async updateProvider(config: ProviderConfig, apiKey?: string): Promise<void> { await this.save(config, apiKey); }
    public async removeProvider(id: string): Promise<void> {
        const existing = this.providers.get(id);
        if (!existing) return;
        this.providers.delete(id);
        if (existing.keyId) await this.keys.deleteKey(existing.keyId);
        await this.persist();
    }
    public async setActiveProvider(id: string): Promise<void> {
        if (!this.providers.has(id)) throw new Error("Provider not found.");
        await vscode.workspace.getConfiguration("nova").update("activeProvider", id, vscode.ConfigurationTarget.Global);
    }
    public getActiveProvider(): ProviderConfig | undefined {
        const id = vscode.workspace.getConfiguration("nova").get<string>("activeProvider");
        return id ? this.providers.get(id) : this.listProviders()[0];
    }
    public async createProvider(config: ProviderConfig): Promise<AIProvider> {
        const key = config.keyId ? await this.keys.getKey(config.keyId) : undefined;
        const model = vscode.workspace.getConfiguration("nova").get<string>("activeModel");
        const effectiveConfig = model ? { ...config, model } : config;
        return effectiveConfig.type === "ollama" ? new OllamaProvider(effectiveConfig) : new OpenAICompatibleProvider(effectiveConfig, key);
    }
    public async active(): Promise<AIProvider> {
        const config = this.getActiveProvider();
        if (!config) throw new Error("No AI provider configured.");
        return this.createProvider(config);
    }
    private async save(config: ProviderConfig, apiKey?: string): Promise<void> {
        const normalized = { ...config, keyId: config.type === "ollama" ? undefined : (config.keyId ?? `nova.provider.${config.id}.key`) };
        if (normalized.keyId && apiKey) await this.keys.saveKey(normalized.keyId, apiKey);
        this.providers.set(normalized.id, normalized);
        await this.persist();
    }
    private persist(): Thenable<void> { return this.context.globalState.update(PROVIDERS_KEY, this.listProviders()); }
}
