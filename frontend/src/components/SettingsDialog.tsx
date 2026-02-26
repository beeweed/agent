import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import { useApi } from "@/hooks/useApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function SettingsDialog() {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    apiKey,
    setApiKey,
    selectedModel,
    setSelectedModel,
    models,
    modelsLoading,
  } = useStore();
  
  const { fetchModels } = useApi();
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (isSettingsOpen && apiKey && models.length === 0) {
      fetchModels();
    }
  }, [isSettingsOpen, apiKey, models.length, fetchModels]);

  const handleSave = () => {
    setApiKey(localApiKey);
    if (localApiKey && localApiKey !== apiKey) {
      fetchModels();
    }
    setIsSettingsOpen(false);
  };

  const filteredModels = models.filter((model) =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogContent 
        data-design-id="settings-dialog"
        className="sm:max-w-lg bg-[#2d2d2d] border-border/30"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <DialogTitle data-design-id="settings-title">Settings</DialogTitle>
              <p className="text-xs text-muted-foreground">Configure your Anygent</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* API Key Section */}
          <div data-design-id="api-key-section" className="space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <label className="text-sm font-medium text-foreground">OpenRouter API Key</label>
            </div>
            <div className="bg-[#363638] rounded-xl p-4">
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
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Get your API key
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {/* Model Selection */}
          <div data-design-id="model-selection-section" className="space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <label className="text-sm font-medium text-foreground">Select Model</label>
            </div>

            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input
                data-design-id="model-search-input"
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#363638] rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {/* Model List */}
            <ScrollArea className="bg-[#363638] rounded-xl max-h-[280px] p-2">
              {modelsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="w-6 h-6 text-primary animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
              ) : !apiKey ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Enter your API key to load models
                </div>
              ) : filteredModels.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {searchQuery ? "No models found" : "No models available"}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredModels.map((model) => (
                    <div
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                        selectedModel === model.id
                          ? "bg-primary/15 border border-primary/30"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-medium text-foreground">{model.name}</div>
                        <div className="text-[10px] text-muted-foreground">{model.id}</div>
                      </div>
                      {selectedModel === model.id && (
                        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/30">
          <Button
            variant="ghost"
            onClick={() => setIsSettingsOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            data-design-id="settings-save-button"
            onClick={handleSave}
            className="bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
          >
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}