import * as vscode from "vscode";
import { ProviderManager } from "../providers/providerManager";
import { ProjectContextEngine } from "../context/projectContext";
import { ChatMessage } from "../types";

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "nova.chat";
    private messages: ChatMessage[] = [];

    public constructor(
        private readonly manager: ProviderManager,
        private readonly contextEngine: ProjectContextEngine
    ) {}

    public resolveWebviewView(view: vscode.WebviewView): void {
        view.webview.options = { enableScripts: true };
        view.webview.html = this.html(view.webview);
        view.webview.onDidReceiveMessage(async message => {
            if (message.type === "refresh") {
                view.webview.postMessage({
                    type: "providers",
                    providers: this.manager.listProviders().map(provider => ({
                        id: provider.id,
                        name: provider.name,
                        type: provider.type,
                        model: provider.model ?? "auto"
                    })),
                    active: this.manager.getActiveProvider()?.id ?? ""
                });
                return;
            }
            if (message.type !== "chat" || typeof message.prompt !== "string") return;
            await this.handleChat(view, message.prompt);
        });
        view.webview.postMessage({
            type: "providers",
            providers: this.manager.listProviders().map(provider => ({
                id: provider.id,
                name: provider.name,
                type: provider.type,
                model: provider.model ?? "auto"
            })),
            active: this.manager.getActiveProvider()?.id ?? ""
        });
    }

    private async handleChat(view: vscode.WebviewView, prompt: string): Promise<void> {
        try {
            const editor = vscode.window.activeTextEditor;
            const context = editor
                ? await this.contextEngine.collect(editor.document, editor.document.getText(editor.selection), 12000)
                : { files: [], estimatedTokens: 0 };
            this.messages.push({ role: "user", content: prompt });
            const provider = await this.manager.active();
            view.webview.postMessage({
                type: "context",
                provider: provider.config.name,
                model: provider.config.model ?? "auto",
                files: context.files.length,
                tokens: context.estimatedTokens
            });
            const answer = await provider.chat([
                { role: "system", content: "You are NOVA Code AI. Teach clearly. Never claim success without evidence." },
                ...this.messages,
                { role: "user", content: `Context (${context.estimatedTokens} tokens):${this.contextEngine.format(context)}\n\n${prompt}` }
            ]);
            this.messages.push({ role: "assistant", content: answer });
            view.webview.postMessage({ type: "answer", text: answer });
        } catch (error) {
            view.webview.postMessage({
                type: "error",
                text: error instanceof Error ? error.message : "AI request failed."
            });
        }
    }

    private html(webview: vscode.Webview): string {
        const nonce = Math.random().toString(36).slice(2);
        return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
:root{--bg:#080b16;--panel:rgba(20,27,51,.78);--panel2:rgba(27,38,72,.8);--line:rgba(157,190,255,.17);--text:#f4f7ff;--muted:#91a0c2;--blue:#5f8dff;--cyan:#35ddff;--green:#4fe0a0}
*{box-sizing:border-box}body{margin:0;min-height:100vh;color:var(--text);font:12px Inter,Segoe UI,sans-serif;background:radial-gradient(circle at 10% 0%,#182c63 0,transparent 40%),radial-gradient(circle at 100% 70%,#073c50 0,transparent 36%),var(--bg);overflow:hidden}
body:before{content:"";position:fixed;inset:0;pointer-events:none;background:linear-gradient(120deg,transparent 20%,rgba(255,255,255,.025) 50%,transparent 80%);transform:translateX(-100%);animation:sweep 12s infinite}
@keyframes sweep{50%,100%{transform:translateX(100%)}}@keyframes float{50%{transform:translateY(-5px)}}@keyframes pulse{50%{box-shadow:0 0 28px rgba(53,221,255,.42)}}
.shell{display:grid;grid-template-columns:178px 1fr;min-height:100vh;padding:12px;gap:12px}.rail,.panel,.composer,.message{border:1px solid var(--line);background:linear-gradient(145deg,rgba(255,255,255,.09),rgba(255,255,255,.025));box-shadow:0 20px 50px rgba(0,0,0,.25),inset 0 1px rgba(255,255,255,.08);backdrop-filter:blur(18px)}
.rail{border-radius:22px;padding:15px 11px;display:flex;flex-direction:column;gap:16px}.brand{display:flex;align-items:center;gap:9px;font-weight:900;letter-spacing:2px;font-size:16px}.orb{width:27px;height:27px;border-radius:9px;background:linear-gradient(135deg,var(--blue),var(--cyan));box-shadow:0 0 25px rgba(53,221,255,.4);animation:pulse 3s infinite}.caption{color:var(--muted);font-size:9px;letter-spacing:1.3px;text-transform:uppercase}.nav{display:grid;gap:6px}.nav button,.action{color:var(--muted);border:1px solid transparent;background:transparent;border-radius:11px;text-align:left;padding:9px;cursor:pointer}.nav button:hover,.nav button.active,.action:hover{color:var(--text);border-color:var(--line);background:rgba(95,141,255,.13)}.rail-foot{margin-top:auto;color:var(--muted);font-size:10px;line-height:1.5}
.main{min-width:0;display:grid;grid-template-rows:auto auto 1fr;gap:12px}.top{display:flex;justify-content:space-between;align-items:center;padding:6px 4px}.title{font-size:19px;font-weight:800}.subtitle{color:var(--muted);font-size:11px;margin-top:3px}.status{display:flex;align-items:center;gap:7px;color:var(--muted)}.dot{width:8px;height:8px;background:var(--green);border-radius:50%;box-shadow:0 0 13px var(--green)}
.overview{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:10px}.panel{border-radius:18px;padding:13px;min-width:0}.hero{background:linear-gradient(135deg,rgba(95,141,255,.23),rgba(53,221,255,.08));animation:float 6s ease-in-out infinite}.hero h2{margin:4px 0;font-size:18px}.hero p{margin:0;color:var(--muted)}.metric{font-size:17px;font-weight:800;margin-top:8px}.metric small{display:block;color:var(--muted);font-size:10px;font-weight:400}
.workspace{display:grid;grid-template-columns:1fr 195px;gap:12px;min-height:0}.chat{display:grid;grid-template-rows:auto 1fr auto;min-height:0}.chat-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);padding-bottom:11px}.select{border:1px solid var(--line);border-radius:9px;background:#111a32;color:var(--text);padding:7px;max-width:150px}.messages{overflow:auto;padding:14px 3px;display:grid;align-content:start;gap:10px}.message{padding:10px 12px;border-radius:14px;max-width:92%;line-height:1.5;white-space:pre-wrap}.message.user{justify-self:end;background:linear-gradient(135deg,rgba(95,141,255,.35),rgba(53,221,255,.12))}.message.assistant{justify-self:start;background:rgba(8,12,28,.65)}.empty{color:var(--muted);text-align:center;padding:45px 20px}.composer{margin-top:10px;border-radius:15px;padding:9px;display:flex;gap:8px;align-items:end}.composer textarea{flex:1;resize:none;min-height:43px;max-height:110px;background:transparent;border:0;outline:0;color:var(--text);font:inherit}.send{border:0;border-radius:11px;padding:10px 13px;background:linear-gradient(135deg,var(--blue),var(--cyan));color:#fff;font-weight:800;cursor:pointer}.side{display:grid;align-content:start;gap:10px}.side h3{margin:0 0 8px}.provider{padding:9px;border:1px solid var(--line);border-radius:12px;margin-top:7px;background:rgba(5,8,20,.3)}.provider strong{display:block}.provider span{display:block;color:var(--muted);font-size:10px;margin-top:3px}.privacy{color:var(--muted);font-size:10px;line-height:1.5}.privacy b{color:var(--cyan)}.quick{display:grid;grid-template-columns:1fr 1fr;gap:6px}
@media(max-width:650px){.shell{grid-template-columns:56px 1fr;padding:7px}.rail{padding:10px 6px}.brand span,.caption,.nav button{font-size:0}.nav button{text-align:center}.nav button:first-letter{font-size:16px}.rail-foot{display:none}.overview{grid-template-columns:1fr 1fr}.hero{grid-column:1/-1}.workspace{grid-template-columns:1fr}.side{display:none}}
</style></head>
<body><div class="shell">
<aside class="rail"><div class="brand"><span class="orb"></span><span>NOVA</span></div><div class="caption">Code intelligence</div>
<nav class="nav"><button class="active">⌂ <span>Home</span></button><button>◈ <span>Chat</span></button><button>◫ <span>Explain</span></button><button>⚙ <span>Settings</span></button></nav>
<div class="rail-foot">Local-first AI<br><span>Keys stay in VS Code SecretStorage.</span></div></aside>
<main class="main"><header class="top"><div><div class="title">NOVA Code AI</div><div class="subtitle">Your intelligent coding cockpit</div></div><div class="status"><span class="dot"></span><span id="status">Ready</span></div></header>
<section class="overview"><div class="panel hero"><div class="caption">Workspace signal</div><h2>Build with clarity.</h2><p>Ask, explain, fix and learn without leaving your editor.</p></div><div class="panel"><div class="caption">Active provider</div><div class="metric" id="activeProvider">Auto</div><small id="activeModel">Model ready</small></div><div class="panel"><div class="caption">Context window</div><div class="metric" id="contextMetric">0</div><small>files included</small></div></section>
<section class="workspace"><section class="panel chat"><div class="chat-head"><div><strong>Open Chat</strong><div class="subtitle">Conversation stays in this view</div></div><select class="select" id="providerSelect"><option>Auto provider</option></select></div><div class="messages" id="chat"><div class="empty" id="empty">Select code or ask a question.<br><br><span class="caption">NOVA is ready when you are.</span></div></div><div class="composer"><textarea id="prompt" placeholder="Ask NOVA to explain, fix or generate..." aria-label="Prompt"></textarea><button class="send" id="send">SEND ↗</button></div></section>
<aside class="side"><div class="panel"><h3>AI providers</h3><div id="providers"><div class="provider"><strong>Scanning...</strong><span>Loading configurations</span></div></div></div><div class="panel"><h3>Quick actions</h3><div class="quick"><button class="action" data-prompt="Explain the selected code clearly.">Explain</button><button class="action" data-prompt="Review the selected code for bugs and security issues.">Review</button><button class="action" data-prompt="Suggest focused tests for this code.">Tests</button><button class="action" data-prompt="Improve this code without adding unnecessary dependencies.">Improve</button></div></div><div class="panel privacy"><b>Privacy shield</b><br>Remote providers receive only the context you choose. API keys never enter this Webview.</div></aside></section></main></div>
<script nonce="${nonce}">
const vscode=acquireVsCodeApi(), prompt=document.getElementById("prompt"), chat=document.getElementById("chat"), empty=document.getElementById("empty");
function send(text){const value=(text||prompt.value).trim();if(!value)return;empty?.remove();const item=document.createElement("div");item.className="message user";item.textContent=value;chat.appendChild(item);prompt.value="";document.getElementById("status").textContent="Thinking...";vscode.postMessage({type:"chat",prompt:value});chat.scrollTop=chat.scrollHeight}
document.getElementById("send").onclick=()=>send();prompt.addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();send()}});
document.querySelectorAll("[data-prompt]").forEach(button=>button.onclick=()=>send(button.dataset.prompt));
window.addEventListener("message",event=>{const data=event.data;if(data.type==="providers"){const select=document.getElementById("providerSelect"),list=document.getElementById("providers");select.innerHTML="";list.innerHTML="";data.providers.forEach(provider=>{const option=document.createElement("option");option.value=provider.id;option.textContent=provider.name;select.appendChild(option);const card=document.createElement("div");card.className="provider";card.innerHTML="<strong></strong><span></span>";card.querySelector("strong").textContent=provider.name;card.querySelector("span").textContent=provider.type+" · "+provider.model;list.appendChild(card)});document.getElementById("activeProvider").textContent=data.providers.find(p=>p.id===data.active)?.name||"Auto"}if(data.type==="context"){document.getElementById("activeProvider").textContent=data.provider;document.getElementById("activeModel").textContent=data.model;document.getElementById("contextMetric").textContent=data.files;document.getElementById("status").textContent="Online"}if(data.type==="answer"||data.type==="error"){const item=document.createElement("div");item.className="message assistant";item.textContent=(data.type==="error"?"⚠ ":"")+data.text;chat.appendChild(item);document.getElementById("status").textContent=data.type==="error"?"Attention":"Ready";chat.scrollTop=chat.scrollHeight}});
vscode.postMessage({type:"refresh"});
</script></body></html>`;
    }
}
