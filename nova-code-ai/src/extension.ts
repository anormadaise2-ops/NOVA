import * as vscode from "vscode";
import { ApiKeyManager } from "./security/keyManager";
import { ProviderManager } from "./providers/providerManager";
import { ProjectContextEngine } from "./context/projectContext";
import { ChatViewProvider } from "./webview/chatView";

export function activate(context: vscode.ExtensionContext): void {
    const keys = new ApiKeyManager(context.secrets);
    const manager = new ProviderManager(context, keys);
    const contextEngine = new ProjectContextEngine();
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, new ChatViewProvider(manager, contextEngine)),
        command(context, "nova.openChat", () => vscode.commands.executeCommand("workbench.view.extension.nova")),
        command(context, "nova.manageProviders", () => manageProviders(manager)),
        command(context, "nova.selectProvider", () => selectProvider(manager)),
        command(context, "nova.selectModel", () => selectModel(manager)),
        command(context, "nova.checkConnection", () => checkConnection(manager)),
        command(context, "nova.settings", () => vscode.commands.executeCommand("workbench.action.openSettings", "@ext:nova.nova-code-ai")),
        command(context, "nova.explainCode", () => runPrompt(manager, "Explain this code for a developer. Include meaning, flow, issues, improvements, and what a beginner should learn.")),
        command(context, "nova.fixError", () => runPrompt(manager, "Analyze the current diagnostics and code. Return PROBLEM, CAUSE, SOLUTION, and a proposed DIFF. Do not edit files.")),
        command(context, "nova.generateCode", () => runPrompt(manager, "Ask what should be created, then generate code matching the current project without unnecessary dependencies.")),
        command(context, "nova.improveCode", () => runPrompt(manager, "Review the selected code for correctness, security, performance, and maintainability. Propose changes without applying them.")),
        command(context, "nova.generateTests", () => runPrompt(manager, "Detect the likely test framework and propose focused tests. Do not run commands.")),
        command(context, "nova.explainProject", () => runPrompt(manager, "Explain the project architecture and important relationships.")),
        command(context, "nova.analyzeProblems", () => runPrompt(manager, "Explain the current VS Code diagnostics simply and suggest fixes.")),
        command(context, "nova.explainTerminalError", () => terminalError(manager))
    );
}

function command(context: vscode.ExtensionContext, id: string, callback: () => unknown): vscode.Disposable {
    return vscode.commands.registerCommand(id, callback);
}

async function runPrompt(manager: ProviderManager, instruction: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const code = editor ? editor.document.getText(editor.selection) || editor.document.getText() : "";
    if (!code) {
        vscode.window.showInformationMessage("Open a file or select code first.");
        return;
    }
    try {
        const provider = await manager.active();
        const result = await provider.generate(`${instruction}\n\nLanguage: ${editor?.document.languageId ?? "unknown"}\n\nCode:\n${code}`);
        const doc = await vscode.workspace.openTextDocument({ content: result, language: "markdown" });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
    } catch (error) {
        vscode.window.showErrorMessage(error instanceof Error ? error.message : "No AI provider available.");
    }
}

async function manageProviders(manager: ProviderManager): Promise<void> {
    const action = await vscode.window.showQuickPick(["Add Provider", "Remove Provider", "Test Provider"], { placeHolder: "AI Providers" });
    if (action === "Add Provider") {
        const name = await vscode.window.showInputBox({ prompt: "Provider name" });
        if (!name) return;
        const type = await vscode.window.showQuickPick(["ollama", "openai-compatible", "custom"]);
        if (!type) return;
        const baseUrl = await vscode.window.showInputBox({ prompt: "Base URL", value: type === "ollama" ? vscode.workspace.getConfiguration("nova").get("ollamaUrl", "http://127.0.0.1:11434") : "https://api.example.com/v1" });
        if (!baseUrl) return;
        const model = await vscode.window.showInputBox({ prompt: "Model (optional)" });
        const apiKey = type === "ollama" ? undefined : await vscode.window.showInputBox({ prompt: "API key (stored securely)", password: true });
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        await manager.addProvider({ id, name, type: type as "ollama" | "openai-compatible" | "custom", baseUrl, model }, apiKey);
        vscode.window.showInformationMessage(`Provider ${name} saved.`);
    } else if (action === "Remove Provider") {
        const selected = await vscode.window.showQuickPick(manager.listProviders().map(item => ({ label: item.name, id: item.id })));
        if (selected) await manager.removeProvider(selected.id);
    } else if (action === "Test Provider") {
        await checkConnection(manager);
    }
}

async function selectProvider(manager: ProviderManager): Promise<void> {
    const selected = await vscode.window.showQuickPick(manager.listProviders().map(item => ({ label: item.name, description: item.type, id: item.id })));
    if (selected) { await manager.setActiveProvider(selected.id); vscode.window.showInformationMessage(`Active provider: ${selected.label}`); }
}

async function selectModel(manager: ProviderManager): Promise<void> {
    try {
        const provider = await manager.active();
        const model = await vscode.window.showQuickPick(await provider.getModels(), { placeHolder: "Select a model" });
        if (model) await vscode.workspace.getConfiguration("nova").update("activeModel", model, vscode.ConfigurationTarget.Global);
    } catch (error) { vscode.window.showErrorMessage(error instanceof Error ? error.message : "Could not load models."); }
}

async function checkConnection(manager: ProviderManager): Promise<void> {
    try {
        const provider = await manager.active();
        vscode.window.showInformationMessage(await provider.checkConnection() ? `${provider.config.name} connected.` : `${provider.config.name} is offline.`);
    } catch (error) { vscode.window.showErrorMessage(error instanceof Error ? error.message : "No AI provider available."); }
}

async function terminalError(manager: ProviderManager): Promise<void> {
    const text = await vscode.window.showInputBox({ prompt: "Paste the terminal error (nothing is executed automatically)." });
    if (text) await runPrompt(manager, `Explain this terminal error: ${text}`);
}

export function deactivate(): void {}
