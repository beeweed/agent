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
import { Box, Key } from "lucide-react";

export function SettingsDialog() {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    apiKey,
    setApiKey,
    e2bApiKey,
    setE2bApiKey,
    models,
  } = useStore();
  
  const { fetchModels } = useApi();
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [localE2bApiKey, setLocalE2bApiKey] = useState(e2bApiKey);

  useEffect(() => {
    setLocalApiKey(apiKey);
    setLocalE2bApiKey(e2bApiKey);
  }, [apiKey, e2bApiKey]);

  useEffect(() => {
    if (isSettingsOpen && apiKey && models.length === 0) {
      fetchModels();
    }
  }, [isSettingsOpen, apiKey, models.length, fetchModels]);

  const handleSave = () => {
    setApiKey(localApiKey);
    setE2bApiKey(localE2bApiKey);
    if (localApiKey && localApiKey !== apiKey) {
      fetchModels();
    }
    setIsSettingsOpen(false);
  };

  const isConfigValid = localApiKey.trim() && localE2bApiKey.trim();

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
          {/* OpenRouter API Key Section */}
          <div data-design-id="api-key-section" className="space-y-3">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-primary" />
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
    </Dialog>
  );
}