import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createTemplate, startBuild, makeTemplatePublic, getBuildStatus } from "@/lib/e2b-template-api";
import { Box, Cpu, MemoryStick, Clock, Globe, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Step = "idle" | "creating" | "building" | "making-public" | "polling" | "done" | "error";

const SPECS = [
  { icon: Cpu, label: "CPU Cores", value: "8 vCPUs" },
  { icon: MemoryStick, label: "Memory", value: "8,192 MB" },
  { icon: Clock, label: "Timeout", value: "3,600s (1hr)" },
  { icon: Globe, label: "Visibility", value: "Public" },
];

interface SandboxCreatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialApiKey?: string;
  onTemplateCreated?: (templateId: string) => void;
}

export function SandboxCreatorDialog({ 
  open, 
  onOpenChange, 
  initialApiKey = "",
  onTemplateCreated 
}: SandboxCreatorDialogProps) {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [step, setStep] = useState<Step>("idle");
  const [templateId, setTemplateId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!apiKey.trim()) {
      toast.error("Please enter your E2B API key");
      return;
    }

    setStep("creating");
    setErrorMsg("");
    setTemplateId("");

    try {
      // Step 1: Create template
      const template = await createTemplate(apiKey.trim());
      setTemplateId(template.templateID);

      // Step 2: Start build
      setStep("building");
      await startBuild(apiKey.trim(), template.templateID, template.buildID);

      // Step 3: Make public
      setStep("making-public");
      await makeTemplatePublic(apiKey.trim(), template.templateID);

      // Step 4: Poll build status until ready
      setStep("polling");
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 5000));
        const status = await getBuildStatus(apiKey.trim(), template.templateID);
        const latestBuild = status.builds?.[0];

        if (latestBuild?.status === "ready") {
          setStep("done");
          toast.success("Template created successfully!");
          onTemplateCreated?.(template.templateID);
          return;
        }

        if (latestBuild?.status === "error") {
          throw new Error("Build failed. Check your E2B dashboard for details.");
        }

        attempts++;
      }

      // If we get here, build didn't complete but template was created
      setStep("done");
      toast.info("Template created! Build may still be in progress.");
      onTemplateCreated?.(template.templateID);
    } catch (err: unknown) {
      setStep("error");
      const msg = err instanceof Error ? err.message : "An unknown error occurred";
      setErrorMsg(msg);
      toast.error(msg);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(templateId);
    setCopied(true);
    toast.success("Template ID copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUseTemplate = () => {
    onTemplateCreated?.(templateId);
    onOpenChange(false);
  };

  const isLoading = ["creating", "building", "making-public", "polling"].includes(step);

  const getStatusText = () => {
    switch (step) {
      case "creating": return "Creating template...";
      case "building": return "Starting build...";
      case "making-public": return "Setting template to public...";
      case "polling": return "Waiting for build to complete...";
      default: return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        data-design-id="sandbox-creator-dialog"
        className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-lg bg-card border-border p-4 sm:p-6 rounded-xl max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/15">
              <Box className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <DialogTitle data-design-id="sandbox-creator-title" className="text-foreground">
                Create Sandbox Template
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Provision a public E2B sandbox template with custom specs
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Specs Grid */}
          <div data-design-id="sandbox-specs-grid" className="grid grid-cols-2 gap-3">
            {SPECS.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="rounded-lg border border-border bg-muted p-3 space-y-1"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 text-purple-500" />
                  <span className="text-xs font-mono">{label}</span>
                </div>
                <p className="text-sm font-mono font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          {/* API Key Input */}
          <div data-design-id="sandbox-api-key-section" className="space-y-2">
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              E2B API Key
            </label>
            <div className="bg-muted rounded-xl p-3 border border-border">
              <Input
                data-design-id="sandbox-api-key-input"
                type="password"
                placeholder="e2b_***"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isLoading}
                className="bg-transparent border-none text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
              />
            </div>
          </div>

          {/* Create Button */}
          <Button
            data-design-id="sandbox-create-button"
            onClick={handleCreate}
            disabled={isLoading || !apiKey.trim()}
            className="w-full font-mono font-semibold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {getStatusText()}
              </span>
            ) : (
              "Create Template"
            )}
          </Button>

          {/* Status / Progress */}
          {isLoading && (
            <div data-design-id="sandbox-progress" className="rounded-lg border border-border bg-muted p-4">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                <span className="text-sm font-mono text-muted-foreground">
                  {getStatusText()}
                </span>
              </div>
              {templateId && (
                <p className="mt-2 text-xs font-mono text-muted-foreground">
                  Template ID: {templateId}
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <div data-design-id="sandbox-error" className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm font-mono text-destructive">{errorMsg}</p>
            </div>
          )}

          {/* Success - Template ID */}
          {step === "done" && templateId && (
            <div data-design-id="sandbox-success" className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-mono font-semibold text-purple-500">
                  Template Created Successfully
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted border border-border px-3 py-2 font-mono text-sm text-foreground select-all">
                  {templateId}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopy}
                  className="shrink-0 border-border text-muted-foreground hover:text-purple-500 hover:border-purple-500"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                This template is <span className="text-purple-500">public</span> - anyone can create sandboxes with this ID.
              </p>
              <Button
                data-design-id="sandbox-use-template-button"
                onClick={handleUseTemplate}
                className="w-full mt-2 bg-purple-600 text-white hover:bg-purple-700"
              >
                Use This Template
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}