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

export function SettingsDialog() {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    apiKey,
    setApiKey,
    models,
  } = useStore();
  
  const { fetchModels } = useApi();
  const [localApiKey, setLocalApiKey] = useState(apiKey);

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

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogContent 
        data-design-id="settings-dialog"
        className="w-[95vw] max-w-[95vw] xs:w-[90vw] xs:max-w-[90vw] sm:max-w-lg bg-card border-border p-4 xs:p-6 rounded-xl"
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
          {/* API Key Section */}
          <div data-design-id="api-key-section" className="space-y-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
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
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Get your API key
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          
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
            className="bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
          >
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}