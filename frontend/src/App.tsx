import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import {
  Sparkles,
  Bot,
  User,
  Send,
  Terminal,
  Cpu,
  Layers,
  Server,
  Settings2,
  RefreshCw,
  Sliders,
  Copy,
  Check,
  Trash2,
  Zap,
  Network,
  Database
} from 'lucide-react';

const DEFAULT_GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL ?? 'http://127.0.0.1:8080/chat';

type ToolCall = {
  name: string;
  args: Record<string, unknown>;
  result: string;
  latency: string;
};

type Message = {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  toolCall: ToolCall | null;
  timestamp: string;
};

const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tag: 'Fast & Low Latency', context: '1M tokens' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', tag: 'Complex Reasoning', context: '2M tokens' }
];

const REGISTERED_MCP_TOOLS = [
  {
    name: 'search_knowledge_base',
    description: 'Look up internal infrastructure knowledge base & deployment SOPs',
    argsSchema: { query: 'string' },
    category: 'Documentation',
    icon: Database
  },
  {
    name: 'calculate_nodes',
    description: 'Determine recommended Kubernetes node count & pod replicas from live RPS',
    argsSchema: { traffic_rps: 'number' },
    category: 'Operations',
    icon: Cpu
  },
  {
    name: 'inspect_cluster_health',
    description: 'Retrieve pod status, node memory pressure, and cluster uptime',
    argsSchema: { namespace: 'string (optional)' },
    category: 'Observability',
    icon: Network
  }
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'welcome-msg',
    sender: 'bot',
    text: "Hello I am your study guide int GCELT student . so you can ask anything notes books notice etc. I will try to help you as much as possible.",
    toolCall: null,
    timestamp: 'Just now'
  }
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [gatewayUrl, setGatewayUrl] = useState(DEFAULT_GATEWAY_URL);
  const [forceSimulation, setForceSimulation] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connected'); // 'connected' | 'simulated' | 'error'
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleCopy = (text: unknown, id: string) => {
    const value = typeof text === 'object'
      ? JSON.stringify(text, null, 2) ?? ''
      : String(text);
    navigator.clipboard.writeText(value);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const simulateMcpResponse = async (prompt: string) => {
    await new Promise((r) => setTimeout(r, 1200));
    const lower = prompt.toLowerCase();
    const startTime = performance.now();

    if (lower.includes('cluster') || lower.includes('doc') || lower.includes('sop') || lower.includes('deploy')) {
      const q = lower.includes('deploy') ? 'deployment' : 'cluster';
      const output = q === 'deployment'
        ? "Deployments are managed by ArgoCD GitOps engine synchronized with 'main' branch manifests."
        : "Production cluster is GKE v1.30 with 3 active regional availability zones and auto-repair.";
      const elapsed = Math.round(performance.now() - startTime);

      return {
        reply: `According to our internal knowledge base, ${output.toLowerCase()} No manual helm commands are permitted on staging or production clusters.`,
        tool: {
          name: 'search_knowledge_base',
          args: { query: q },
          result: output,
          latency: `${elapsed + 115}ms`
        }
      };
    } else if (lower.includes('node') || lower.includes('rps') || lower.includes('traffic') || lower.includes('scale')) {
      const numbers = prompt.match(/\d+/g);
      const rps = numbers ? parseInt(numbers[0], 10) : 3400;
      const count = Math.max(2, Math.floor(rps / 500) + 1);
      const elapsed = Math.round(performance.now() - startTime);

      return {
        reply: `Based on an expected traffic volume of **${rps.toLocaleString()} RPS**, our formula requires **${count} nodes** (e2-standard-4) to comfortably maintain p99 response times under 70ms with 20% burst tolerance.`,
        tool: {
          name: 'calculate_nodes',
          args: { traffic_rps: rps },
          result: `{"target_nodes": ${count}, "estimated_headroom": "24%", "pod_replicas": ${count * 4}}`,
          latency: `${elapsed + 65}ms`
        }
      };
    } else if (lower.includes('health') || lower.includes('status')) {
      const elapsed = Math.round(performance.now() - startTime);
      return {
        reply: "Cluster health check completed. All nodes report Healthy (Ready=True, DiskPressure=False, MemoryPressure=False). All gateway pods are responsive.",
        tool: {
          name: 'inspect_cluster_health',
          args: { namespace: 'production' },
          result: "ClusterState: GREEN, Nodes: 5/5 Ready, MemoryPressure: None",
          latency: `${elapsed + 140}ms`
        }
      };
    }

    return {
      reply: `I received your request: "${prompt}". You can test MCP functions by asking about our cluster health, scaling calculation for any RPS, or deployment documentation.`,
      tool: null
    };
  };

  const handleSubmit = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) return;

    const userMessageId = Date.now().toString();
    const newUserMessage: Message = {
      id: userMessageId,
      sender: 'user',
      text: trimmed,
      toolCall: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
        let finalReply = '';
        let toolData: ToolCall | null = null;

      if (!forceSimulation) {
        try {
          const res = await fetch(gatewayUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: trimmed, model: selectedModel })
          });

          if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
          const data = await res.json();
          finalReply = data.reply;
          if (data.tool) {
            toolData = {
              name: data.tool,
              args: data.args || {},
              result: data.result || 'Operation executed successfully.',
              latency: data.latency || '180ms'
            };
          }
          setConnectionStatus('connected');
        } catch (apiError) {
          console.warn('Real gateway unreachable, falling back to simulator:', apiError);
          setConnectionStatus('simulated');
          const mock = await simulateMcpResponse(trimmed);
          finalReply = `*(Offline Fallback)*\n\n` + mock.reply;
          toolData = mock.tool;
        }
      } else {
        const mock = await simulateMcpResponse(trimmed);
        finalReply = mock.reply;
        toolData = mock.tool;
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: finalReply,
        toolCall: toolData,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown network error';
      const errMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: `⚠️ **Processing Error**: ${message}. Please check your MCP gateway settings.`,
        toolCall: null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {}
      <aside className="w-80 border-r border-slate-800/80 bg-slate-900/40 backdrop-blur-xl flex flex-col hidden lg:flex select-none">
        {/* Brand / Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-sky-400 p-[1.5px] shadow-lg shadow-indigo-500/20">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
                Gemini MCP
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  Kubernetes
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">Agentic Orchestrator</p>
            </div>
          </div>
        </div>

        {/* Model Selector Card */}
        <div className="p-4 border-b border-slate-800/80">
          <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-indigo-400" /> Active Google LLM
          </label>
          <div className="space-y-1.5">
            {AVAILABLE_MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs flex items-center justify-between ${
                  selectedModel === model.id
                    ? 'bg-indigo-600/15 border-indigo-500/50 text-white shadow-sm'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-200">{model.name}</div>
                  <div className="text-[10px] text-slate-400">{model.tag}</div>
                </div>
                <span className="text-[10px] font-mono bg-slate-800/80 px-2 py-0.5 rounded text-slate-300">
                  {model.context}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Discovered MCP Tools List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" /> Discovered MCP Tools ({REGISTERED_MCP_TOOLS.length})
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              SSE Connected
            </span>
          </div>

          <div className="space-y-2.5">
            {REGISTERED_MCP_TOOLS.map((tool) => {
              const IconComponent = tool.icon;
              return (
                <div
                  key={tool.name}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-indigo-300 font-semibold flex items-center gap-1.5">
                      <IconComponent className="w-3.5 h-3.5 text-indigo-400" />
                      {tool.name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-medium">
                      {tool.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-2">{tool.description}</p>
                  <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800/60 text-[10px] font-mono text-slate-400">
                    args: {JSON.stringify(tool.argsSchema)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Kubernetes Cluster Meta Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/50 text-[11px] space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <Server className="w-3 h-3 text-sky-400" /> Namespace
            </span>
            <span className="font-mono text-slate-200">default</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" /> Pipeline Sync
            </span>
            <span className="font-mono text-slate-200">GitOps (ArgoCD)</span>
          </div>
        </div>
      </aside>

      {}
      <main className="flex-1 flex flex-col bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900/60 relative overflow-hidden">
        
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md px-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-200">Gateway Console</span>
              <span className="text-xs text-slate-500">/</span>
              <span className="text-xs font-mono text-indigo-400">{selectedModel}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-400'
                      : connectionStatus === 'simulated'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-500'
                      : connectionStatus === 'simulated'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                />
              </span>
              <span className="text-slate-300 font-medium">
                {connectionStatus === 'connected'
                  ? 'Gateway Live'
                  : connectionStatus === 'simulated'
                  ? 'Simulator Active'
                  : 'Disconnected'}
              </span>
            </div>

            {/* Clear Chat */}
            <button
              onClick={() => setMessages(INITIAL_MESSAGES)}
              className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Clear conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Settings button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
              title="Settings"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Message Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-3.5 ${
                  msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-md ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600'
                      : 'bg-gradient-to-tr from-purple-600 to-indigo-600'
                  }`}
                >
                  {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Body */}
                <div
                  className={`space-y-2 max-w-2xl ${
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  } flex flex-col`}
                >
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <span>{msg.sender === 'user' ? 'You' : 'Gemini MCP Agent'}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {}
                  {msg.toolCall && (
                    <div className="w-full rounded-xl bg-slate-900/90 border border-indigo-500/30 overflow-hidden shadow-lg shadow-indigo-950/20 text-xs font-mono">
                      <div className="bg-indigo-950/40 px-3.5 py-2 border-b border-indigo-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-300 font-medium">
                          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                          <span>MCP Tool Invoked:</span>
                          <span className="text-white bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
                            {msg.toolCall.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
                            {msg.toolCall.latency}
                          </span>
                          <button
                            onClick={() => handleCopy(msg.toolCall, `tool-${msg.id}`)}
                            className="text-slate-400 hover:text-white"
                            title="Copy tool payload"
                          >
                            {copiedId === `tool-${msg.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="p-3 space-y-2 bg-slate-950/50">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Incoming Arguments</div>
                          <div className="bg-slate-900/80 p-2 rounded border border-slate-800 text-slate-300 text-[11px]">
                            {JSON.stringify(msg.toolCall.args, null, 2)}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">MCP Response Output</div>
                          <div className="bg-slate-900/80 p-2 rounded border border-slate-800 text-emerald-300 text-[11px] whitespace-pre-wrap">
                            {msg.toolCall.result}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Main Bubble */}
                  <div
                    className={`p-4 rounded-2xl text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white shadow-md rounded-tr-none'
                        : 'bg-slate-900/90 border border-slate-800 text-slate-200 shadow-sm rounded-tl-none whitespace-pre-wrap'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-start gap-3.5">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center flex-shrink-0 text-white shadow-md">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs text-slate-400 flex items-center gap-3">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Connecting to Gemini & evaluating MCP tool calls...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Quick Suggestion Prompts */}
        <div className="px-6 py-2 border-t border-slate-800/40 bg-slate-950/30">
          <div className="max-w-3xl mx-auto flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" /> Try:
            </span>
            <button
              onClick={() => {
                setInputText('What does internal docs say about cluster deployment?');
                textareaRef.current?.focus();
              }}
              className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
            >
              📘 Knowledge Base search
            </button>
            <button
              onClick={() => {
                setInputText('Calculate recommended Kubernetes nodes for 4500 RPS');
                textareaRef.current?.focus();
              }}
              className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
            >
              ⚡ Scale nodes for 4,500 RPS
            </button>
            <button
              onClick={() => {
                setInputText('Check current cluster health and node memory pressure');
                textareaRef.current?.focus();
              }}
              className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
            >
              🩺 Cluster health
            </button>
          </div>
        </div>

        {/* Input Bar Form */}
        <div className="p-4 sm:p-6 border-t border-slate-800/80 bg-slate-950/60 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="relative flex items-end bg-slate-900 border border-slate-800 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 rounded-2xl p-2 shadow-2xl transition-all">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask Gemini to query the MCP tools or explain Kubernetes resources..."
                className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none px-3 py-2 resize-none max-h-32 min-h-[40px]"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between mt-2 px-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                Target: {gatewayUrl}
              </span>
              <span>Press Enter to send, Shift + Enter for newline</span>
            </div>
          </form>
        </div>

      </main>

      {}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Gateway & Cluster Configuration</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  FastAPI Gateway Endpoint
                </label>
                <input
                  type="text"
                  value={gatewayUrl}
                  onChange={(e) => setGatewayUrl(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                  placeholder="http://127.0.0.1:8000/chat"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Default corresponds to local Python backend (`uvicorn engine:app`).
                </p>
              </div>

              {/* Force Simulator Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <div>
                  <div className="text-xs font-medium text-slate-300">Offline Simulation Mode</div>
                  <div className="text-[11px] text-slate-500">
                    Emulate MCP tools locally without a running Python backend
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceSimulation}
                    onChange={(e) => {
                      setForceSimulation(e.target.checked);
                      setConnectionStatus(e.target.checked ? 'simulated' : 'connected');
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}