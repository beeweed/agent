import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import type { Provider } from "@/store/useStore";
import { useApi } from "@/hooks/useApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Box, Key, Layers, Plus, ChevronDown, Zap, Flame } from "lucide-react";
import { SandboxCreatorDialog } from "@/components/SandboxCreatorDialog";

const PROVIDERS: { id: Provider; name: string; icon: React.ReactNode; color: string; description: string; keyPrefix: string; keyUrl: string; keyLabel: string }[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    icon: <Key className="w-4 h-4" />,
    color: "text-blue-500",
    description: "Access Claude, GPT-4o, Gemini, Llama, and more via OpenRouter",
    keyPrefix: "sk-or-v1-...",
    keyUrl: "https://openrouter.ai/keys",
    keyLabel: "OpenRouter API Key",
  },
  {
    id: "groq",
    name: "Groq",
    icon: <Zap className="w-4 h-4" />,
    color: "text-emerald-500",
    description: "Ultra-fast inference with Groq LPU — Llama, Mixtral, Gemma",
    keyPrefix: "gsk_...",
    keyUrl: "https://console.groq.com/keys",
    keyLabel: "Groq API Key",
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    icon: <Flame className="w-4 h-4" />,
    color: "text-orange-500",
    description: "Blazing-fast inference — Llama, Qwen, DeepSeek, Kimi & more",
    keyPrefix: "fw_...",
    keyUrl: "https://fireworks.ai/account/api-keys",
    keyLabel: "Fireworks API Key",
  },
];

export function SettingsDialog() {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    provider,
    setProvider,
    apiKey,
    setApiKey,
    groqApiKey,
    setGroqApiKey,
    fireworksApiKey,
    setFireworksApiKey,
    e2bApiKey,
    setE2bApiKey,
    e2bTemplateId,
    setE2bTemplateId,
    models,
    setModels,
  } = useStore();
  
  const { fetchModels } = useApi();
  const [localProvider, setLocalProvider] = useState<Provider>(provider);
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localGroqApiKey, setLocalGroqApiKey] = useState(groqApiKey);
  const [localFireworksApiKey, setLocalFireworksApiKey] = useState(fireworksApiKey);
  const [localE2bApiKey, setLocalE2bApiKey] = useState(e2bApiKey);
  const [localE2bTemplateId, setLocalE2bTemplateId] = useState(e2bTemplateId);
  const [isSandboxCreatorOpen, setIsSandboxCreatorOpen] = useState(false);
  const [isProviderOpen, setIsProviderOpen] = useState(false);

  const handleTemplateCreated = (templateId: string) => {
    setLocalE2bTemplateId(templateId);
  };

  useEffect(() => {
    setLocalProvider(provider);
    setLocalApiKey(apiKey);
    setLocalGroqApiKey(groqApiKey);
    setLocalFireworksApiKey(fireworksApiKey);
    setLocalE2bApiKey(e2bApiKey);
    setLocalE2bTemplateId(e2bTemplateId);
  }, [provider, apiKey, groqApiKey, fireworksApiKey, e2bApiKey, e2bTemplateId]);

  useEffect(() => {
    if (isSettingsOpen && getActiveApiKey() && models.length === 0) {
      fetchModels();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSettingsOpen]);

  const getActiveApiKey = () => {
    if (localProvider === "groq") return localGroqApiKey;
    if (localProvider === "fireworks") return localFireworksApiKey;
    return localApiKey;
  };

  const selectedProviderConfig = PROVIDERS.find(p => p.id === localProvider) || PROVIDERS[0];

  const handleSave = () => {
    const providerChanged = localProvider !== provider;
    const apiKeyChanged = localProvider === "openrouter" 
      ? localApiKey !== apiKey 
      : localProvider === "fireworks"
        ? localFireworksApiKey !== fireworksApiKey
        : localGroqApiKey !== groqApiKey;

    setProvider(localProvider);
    setApiKey(localApiKey);
    setGroqApiKey(localGroqApiKey);
    setFireworksApiKey(localFireworksApiKey);
    setE2bApiKey(localE2bApiKey);
    setE2bTemplateId(localE2bTemplateId);

    if (providerChanged || apiKeyChanged) {
      setModels([]);
      setTimeout(() => {
        fetchModels();
      }, 100);
    }

    setIsSettingsOpen(false);
  };

  const activeKey = getActiveApiKey();
  const isConfigValid = activeKey.trim() && localE2bApiKey.trim() && localE2bTemplateId.trim();

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogContent 
        data-design-id="settings-dialog"
        className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-lg bg-card border-border p-4 sm:p-6 rounded-xl max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/15">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <DialogTitle data-design-id="settings-title" className="text-foreground">Settings</DialogTitle>
              <p className="text-xs text-muted-foreground">Configure your Anygent</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Provider Selection */}
          <div data-design-id="provider-section" className="space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <label className="text-sm font-medium text-foreground">LLM Provider</label>
            </div>
            <div className="relative">
              <button
                data-design-id="provider-dropdown-trigger"
                onClick={() => setIsProviderOpen(!isProviderOpen)}
                className="w-full flex items-center justify-between bg-muted rounded-xl p-4 border border-border hover:border-primary/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${localProvider === 'groq' ? 'bg-emerald-500/15' : localProvider === 'fireworks' ? 'bg-orange-500/15' : 'bg-blue-500/15'}`}>
                    <span className={selectedProviderConfig.color}>
                      {selectedProviderConfig.icon}
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-foreground">{selectedProviderConfig.name}</div>
                    <div className="text-[11px] text-muted-foreground">{selectedProviderConfig.description}</div>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isProviderOpen ? 'rotate-180' : ''}`} />
              </button>

              {isProviderOpen && (
                <div
                  data-design-id="provider-dropdown-menu"
                  className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      data-design-id={`provider-option-${p.id}`}
                      onClick={() => {
                        setLocalProvider(p.id);
                        setIsProviderOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-left ${
                        localProvider === p.id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${p.id === 'groq' ? 'bg-emerald-500/15' : p.id === 'fireworks' ? 'bg-orange-500/15' : 'bg-blue-500/15'}`}>
                        <span className={p.color}>{p.icon}</span>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">{p.description}</div>
                      </div>
                      {localProvider === p.id && (
                        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* OpenRouter API Key Section - shown when openrouter is selected */}
          {localProvider === "openrouter" && (
            <div data-design-id="api-key-section" className="space-y-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-500" />
                <label className="text-sm font-medium text-foreground">OpenRouter API Key</label>
              </div>
              <div className="bg-muted rounded-xl p-4 border border-border">
                <Input
                  data-design-id="api-key-input"
                  type="password"
                  placeholder="sk-or-v1-..."
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                  className="bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
                />
              </div>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
              >
                Get your API key
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}

          {/* Groq API Key Section - shown when groq is selected */}
          {localProvider === "groq" && (
            <div data-design-id="groq-api-key-section" className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                <label className="text-sm font-medium text-foreground">Groq API Key</label>
              </div>
              <div className="bg-muted rounded-xl p-4 border border-border">
                <Input
                  data-design-id="groq-api-key-input"
                  type="password"
                  placeholder="gsk_..."
                  value={localGroqApiKey}
                  onChange={(e) => setLocalGroqApiKey(e.target.value)}
                  className="bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
                />
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Zap className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500/60" />
                <span>Groq provides ultra-fast inference powered by custom LPU hardware. Supports tool/function calling.</span>
              </div>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-emerald-500 hover:underline"
              >
                Get your Groq API key
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}

          {/* Fireworks API Key Section - shown when fireworks is selected */}
          {localProvider === "fireworks" && (
            <div data-design-id="fireworks-api-key-section" className="space-y-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <label className="text-sm font-medium text-foreground">Fireworks API Key</label>
              </div>
              <div className="bg-muted rounded-xl p-4 border border-border">
                <Input
                  data-design-id="fireworks-api-key-input"
                  type="password"
                  placeholder="fw_..."
                  value={localFireworksApiKey}
                  onChange={(e) => setLocalFireworksApiKey(e.target.value)}
                  className="bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
                />
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Flame className="w-4 h-4 flex-shrink-0 mt-0.5 text-orange-500/60" />
                <span>Fireworks AI offers blazing-fast inference for 100+ models with full tool/function calling support.</span>
              </div>
              <a
                href="https://fireworks.ai/account/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-orange-500 hover:underline"
              >
                Get your Fireworks API key
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}

          {/* E2B API Key Section */}
          <div data-design-id="e2b-api-key-section" className="space-y-3">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-orange-500" />
              <label className="text-sm font-medium text-foreground">E2B API Key</label>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 font-medium">Required</span>
            </div>
            <div className="bg-muted rounded-xl p-4 border border-border">
              <Input
                data-design-id="e2b-api-key-input"
                type="password"
                placeholder="e2b_..."
                value={localE2bApiKey}
                onChange={(e) => setLocalE2bApiKey(e.target.value)}
                className="bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
              />
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>E2B provides secure cloud sandboxes for code execution. All files will be stored in the sandbox.</span>
            </div>
            <a
              href="https://e2b.dev/dashboard?tab=keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-orange-500 hover:underline"
            >
              Get your E2B API key
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {/* E2B Sandbox Template Section */}
          <div data-design-id="e2b-template-section" className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-500" />
                <label className="text-sm font-medium text-foreground">E2B Sandbox Template</label>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 font-medium">Required</span>
              </div>
              <Button
                data-design-id="create-template-button"
                variant="outline"
                size="sm"
                onClick={() => setIsSandboxCreatorOpen(true)}
                className="h-7 text-xs border-purple-500/30 text-purple-500 hover:bg-purple-500/10 hover:text-purple-400"
              >
                <Plus className="w-3 h-3 mr-1" />
                Create Template
              </Button>
            </div>
            <div className="bg-muted rounded-xl p-4 border border-border">
              <Input
                data-design-id="e2b-template-input"
                type="text"
                placeholder="Enter your E2B sandbox template ID"
                value={localE2bTemplateId}
                onChange={(e) => setLocalE2bTemplateId(e.target.value)}
                className="bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
              />
            </div>
            
            {/* Template Benefits Info */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <svg className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div className="text-xs text-purple-400">
                <span className="font-semibold">Create a template to unlock:</span>
                <ul className="mt-1 space-y-0.5 text-purple-400/90">
                  <li>8 GB RAM for your sandbox</li>
                  <li>8 CPU cores for faster execution</li>
                  <li>1 hour timeout for long-running tasks</li>
                </ul>
              </div>
            </div>
            
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>A template is required to chat with the AI. Create one using the button above.</span>
            </div>
          </div>

          {/* Warning if E2B key is missing */}
          {!localE2bApiKey.trim() && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-amber-500">
                E2B API key is required to use the agent. Without it, you won't be able to create files or run code.
              </p>
            </div>
          )}
          
          {/* Warning if Template is missing */}
          {localE2bApiKey.trim() && !localE2bTemplateId.trim() && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <svg className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-purple-400">
                <span className="font-semibold">Template required!</span> Create a template to chat with AI and get 8GB RAM + 8 CPU cores for your sandbox.
              </p>
            </div>
          )}

          {/* Warning if LLM API key is missing */}
          {!activeKey.trim() && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-amber-500">
                {selectedProviderConfig.name} API key is required to use the agent.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            data-design-id="settings-cancel-button"
            variant="ghost"
            onClick={() => setIsSettingsOpen(false)}
            className="text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            Cancel
          </Button>
          <Button
            data-design-id="settings-save-button"
            onClick={handleSave}
            disabled={!isConfigValid}
            className="bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save Changes
          </Button>
        </div>
      </DialogContent>

      {/* Sandbox Creator Dialog */}
      <SandboxCreatorDialog
        open={isSandboxCreatorOpen}
        onOpenChange={setIsSandboxCreatorOpen}
        initialApiKey={localE2bApiKey}
        onTemplateCreated={handleTemplateCreated}
      />
    </Dialog>
  );
}