import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import type { Provider } from "@/store/useStore";
import { useApi } from "@/hooks/useApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Key, ChevronDown, Zap, Flame, Box, Layers3 } from "lucide-react";

const PROVIDERS: { id: Provider; name: string; icon: React.ReactNode; color: string; description: string; keyUrl: string }[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    icon: <Key className="w-4 h-4" />,
    color: "text-blue-500",
    description: "Access Claude, GPT-4o, Gemini, Llama, and more via OpenRouter",
    keyUrl: "https://openrouter.ai/keys",
  },
  {
    id: "groq",
    name: "Groq",
    icon: <Zap className="w-4 h-4" />,
    color: "text-emerald-500",
    description: "Ultra-fast inference with Groq LPU — Llama, Mixtral, Gemma",
    keyUrl: "https://console.groq.com/keys",
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    icon: <Flame className="w-4 h-4" />,
    color: "text-orange-500",
    description: "Blazing-fast inference — Llama, Qwen, DeepSeek, Kimi & more",
    keyUrl: "https://fireworks.ai/account/api-keys",
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
    novitaApiKey,
    setNovitaApiKey,
    novitaTemplateId,
    setNovitaTemplateId,
    models,
    setModels,
  } = useStore();

  const { fetchModels } = useApi();
  const [localProvider, setLocalProvider] = useState<Provider>(provider);
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localGroqApiKey, setLocalGroqApiKey] = useState(groqApiKey);
  const [localFireworksApiKey, setLocalFireworksApiKey] = useState(fireworksApiKey);
  const [localNovitaApiKey, setLocalNovitaApiKey] = useState(novitaApiKey);
  const [localNovitaTemplateId, setLocalNovitaTemplateId] = useState(novitaTemplateId);
  const [isProviderOpen, setIsProviderOpen] = useState(false);

  useEffect(() => {
    setLocalProvider(provider);
    setLocalApiKey(apiKey);
    setLocalGroqApiKey(groqApiKey);
    setLocalFireworksApiKey(fireworksApiKey);
    setLocalNovitaApiKey(novitaApiKey);
    setLocalNovitaTemplateId(novitaTemplateId);
  }, [provider, apiKey, groqApiKey, fireworksApiKey, novitaApiKey, novitaTemplateId]);

  const getActiveApiKey = () => {
    if (localProvider === "groq") return localGroqApiKey;
    if (localProvider === "fireworks") return localFireworksApiKey;
    return localApiKey;
  };

  useEffect(() => {
    if (isSettingsOpen && getActiveApiKey() && models.length === 0) {
      fetchModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSettingsOpen]);

  const selectedProviderConfig = PROVIDERS.find((p) => p.id === localProvider) || PROVIDERS[0];

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
    setNovitaApiKey(localNovitaApiKey);
    setNovitaTemplateId(localNovitaTemplateId.trim());

    if (providerChanged || apiKeyChanged) {
      setModels([]);
      setTimeout(() => {
        fetchModels();
      }, 100);
    }

    setIsSettingsOpen(false);
  };

  const activeKey = getActiveApiKey();
  const hasLlmKey = activeKey.trim().length > 0;
  const hasSandboxKey = localNovitaApiKey.trim().length > 0;
  const isConfigValid = hasLlmKey && hasSandboxKey;

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogContent
        data-design-id="settings-dialog"
        aria-describedby={undefined}
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
              <DialogDescription className="text-xs text-muted-foreground">
                Configure your LLM provider and Novita sandbox.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
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
                  <div className={`p-1.5 rounded-lg ${localProvider === "groq" ? "bg-emerald-500/15" : localProvider === "fireworks" ? "bg-orange-500/15" : "bg-blue-500/15"}`}>
                    <span className={selectedProviderConfig.color}>{selectedProviderConfig.icon}</span>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-foreground">{selectedProviderConfig.name}</div>
                    <div className="text-[11px] text-muted-foreground">{selectedProviderConfig.description}</div>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isProviderOpen ? "rotate-180" : ""}`} />
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
                      className={`w-full flex items-center gap-3 p-3 hover:bg-accent transition-colors text-left ${localProvider === p.id ? "bg-primary/10" : ""}`}
                    >
                      <div className={`p-1.5 rounded-lg ${p.id === "groq" ? "bg-emerald-500/15" : p.id === "fireworks" ? "bg-orange-500/15" : "bg-blue-500/15"}`}>
                        <span className={p.color}>{p.icon}</span>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-foreground">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">{p.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {localProvider === "openrouter" && (
            <ProviderKeySection
              designId="api-key"
              icon={<Key className="w-4 h-4 text-blue-500" />}
              label="OpenRouter API Key"
              placeholder="sk-or-v1-..."
              value={localApiKey}
              onChange={setLocalApiKey}
              helperUrl="https://openrouter.ai/keys"
              helperColor="text-blue-500"
            />
          )}

          {localProvider === "groq" && (
            <ProviderKeySection
              designId="groq-api-key"
              icon={<Zap className="w-4 h-4 text-emerald-500" />}
              label="Groq API Key"
              placeholder="gsk_..."
              value={localGroqApiKey}
              onChange={setLocalGroqApiKey}
              helperUrl="https://console.groq.com/keys"
              helperColor="text-emerald-500"
            />
          )}

          {localProvider === "fireworks" && (
            <ProviderKeySection
              designId="fireworks-api-key"
              icon={<Flame className="w-4 h-4 text-orange-500" />}
              label="Fireworks API Key"
              placeholder="fw_..."
              value={localFireworksApiKey}
              onChange={setLocalFireworksApiKey}
              helperUrl="https://fireworks.ai/account/api-keys"
              helperColor="text-orange-500"
            />
          )}

          <div data-design-id="novita-sandbox-section" className="space-y-3">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-cyan-400" />
              <label className="text-sm font-medium text-foreground">Novita Sandbox API Key</label>
            </div>
            <div className="bg-muted rounded-xl p-4 border border-border">
              <Input
                data-design-id="novita-api-key-input"
                type="password"
                placeholder="sk_..."
                value={localNovitaApiKey}
                onChange={(e) => setLocalNovitaApiKey(e.target.value)}
                className="bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
              />
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Box className="w-4 h-4 flex-shrink-0 mt-0.5 text-cyan-400/70" />
              <span>This key is required. Anygent will create a Novita sandbox before the first LLM turn and route file tools through it.</span>
            </div>
          </div>

          <div data-design-id="novita-template-section" className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers3 className="w-4 h-4 text-violet-400" />
              <label className="text-sm font-medium text-foreground">Custom Sandbox Template ID</label>
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Optional</span>
            </div>
            <div className="bg-muted rounded-xl p-4 border border-border">
              <Input
                data-design-id="novita-template-id-input"
                type="text"
                placeholder="tmpl_... or your Novita template ID"
                value={localNovitaTemplateId}
                onChange={(e) => setLocalNovitaTemplateId(e.target.value)}
                className="bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave blank to use Novita’s default template. Add your own template ID to enable custom sandbox dependencies and features.
            </p>
          </div>

          {(!hasLlmKey || !hasSandboxKey) && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-xs text-amber-500 space-y-1">
                {!hasLlmKey && <p>{selectedProviderConfig.name} API key is required.</p>}
                {!hasSandboxKey && <p>Novita sandbox API key is required. Without it, the app will not let you chat.</p>}
              </div>
            </div>
          )}
        </div>

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
    </Dialog>
  );
}

interface ProviderKeySectionProps {
  designId: string;
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  helperUrl: string;
  helperColor: string;
}

function ProviderKeySection({
  designId,
  icon,
  label,
  placeholder,
  value,
  onChange,
  helperUrl,
  helperColor,
}: ProviderKeySectionProps) {
  return (
    <div data-design-id={`${designId}-section`} className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <label className="text-sm font-medium text-foreground">{label}</label>
      </div>
      <div className="bg-muted rounded-xl p-4 border border-border">
        <Input
          data-design-id={`${designId}-input`}
          type="password"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
        />
      </div>
      <a
        href={helperUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-xs hover:underline ${helperColor}`}
      >
        Get your API key
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}