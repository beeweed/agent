import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Key, Monitor, Search, Check, Loader2, ExternalLink, Sparkles } from "lucide-react";
import { fetchModels, type ModelInfo } from "@/lib/api";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  models: ModelInfo[];
  onSetModels: (models: ModelInfo[]) => void;
}

export default function SettingsDialog({
  open,
  onClose,
  apiKey,
  onSaveApiKey,
  selectedModel,
  onSelectModel,
  models,
  onSetModels,
}: SettingsDialogProps) {
  const [localKey, setLocalKey] = useState(apiKey);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLocalKey(apiKey);
  }, [apiKey]);

  const handleFetchModels = async () => {
    if (!localKey.trim()) {
      setError("Please enter an API key first");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const fetched = await fetchModels(localKey);
      onSetModels(fetched);
    } catch (err) {
      setError("Failed to fetch models. Check your API key.");
    } finally {
      setLoading(false);
    }
  };

  const filteredModels = useMemo(() => {
    if (!search.trim()) return models;
    const q = search.toLowerCase();
    return models.filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    );
  }, [models, search]);

  const handleSave = () => {
    onSaveApiKey(localKey);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-design-id="settings-dialog" className="bg-[#2d2d2d] border-[#404040]/30 text-[#f0f0f0] max-w-lg max-h-[85vh] overflow-hidden p-0 gap-0">
        <DialogHeader data-design-id="settings-header" className="px-6 pt-6 pb-4 border-b border-[#404040]/30">
          <div className="flex items-center gap-3">
            <div data-design-id="settings-icon" className="p-2 rounded-xl bg-gradient-to-br from-[#6366f1]/20 to-[#22d3ee]/20">
              <Sparkles className="w-5 h-5 text-[#6366f1]" />
            </div>
            <div>
              <DialogTitle data-design-id="settings-title" className="text-lg font-semibold">Settings</DialogTitle>
              <p data-design-id="settings-subtitle" className="text-xs text-[#a1a1aa]">Configure your AI Agent</p>
            </div>
          </div>
        </DialogHeader>

        <div data-design-id="settings-body" className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
          <div data-design-id="api-key-section" className="space-y-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-[#6366f1]" />
              <label className="text-sm font-medium">OpenRouter API Key</label>
            </div>
            <div data-design-id="api-key-input-wrapper" className="bg-[#363638] rounded-xl p-1">
              <Input
                data-design-id="api-key-input"
                type="password"
                placeholder="sk-or-v1-..."
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                className="bg-transparent border-none text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <a
              data-design-id="api-key-link"
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#6366f1] hover:underline"
            >
              Get your API key <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div data-design-id="model-section" className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-[#22d3ee]" />
                <label className="text-sm font-medium">Select Model</label>
              </div>
              <Button
                data-design-id="fetch-models-btn"
                variant="outline"
                size="sm"
                onClick={handleFetchModels}
                disabled={loading}
                className="text-xs bg-transparent border-[#404040] hover:bg-white/5 text-[#a1a1aa] hover:text-[#f0f0f0]"
              >
                {loading ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : null}
                Fetch Models
              </Button>
            </div>

            {error && (
              <p data-design-id="settings-error" className="text-xs text-red-400">{error}</p>
            )}

            <div data-design-id="model-search" className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a1a1aa]" />
              <Input
                data-design-id="model-search-input"
                type="text"
                placeholder="Search models..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#363638] border-none pl-10 focus-visible:ring-[#6366f1]/50"
              />
            </div>

            <div data-design-id="model-list" className="bg-[#363638] rounded-xl max-h-[280px] overflow-y-auto p-2 space-y-1">
              {filteredModels.length === 0 && models.length === 0 ? (
                <div data-design-id="model-list-empty" className="text-center py-6 text-xs text-[#a1a1aa]">
                  Click "Fetch Models" to load available models
                </div>
              ) : filteredModels.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#a1a1aa]">
                  No models match your search
                </div>
              ) : (
                filteredModels.map((m) => (
                  <div
                    key={m.id}
                    data-design-id={`model-item-${m.id.replace(/[/:.]/g, "-")}`}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                      selectedModel === m.id
                        ? "bg-[#6366f1]/15 border border-[#6366f1]/30"
                        : "hover:bg-white/5 border border-transparent"
                    }`}
                    onClick={() => onSelectModel(m.id)}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#f0f0f0] truncate">{m.name}</div>
                      <div className="text-[10px] text-[#a1a1aa] truncate">{m.id}</div>
                    </div>
                    {selectedModel === m.id && (
                      <Check className="w-5 h-5 text-[#6366f1] flex-shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div data-design-id="settings-footer" className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#404040]/30 bg-[#252525]">
          <Button
            data-design-id="settings-cancel-btn"
            variant="ghost"
            onClick={onClose}
            className="text-[#a1a1aa] hover:text-[#f0f0f0] hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            data-design-id="settings-save-btn"
            onClick={handleSave}
            className="bg-[#6366f1] hover:bg-[#6366f1]/90 text-white shadow-md shadow-[#6366f1]/20"
          >
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}