import { useState, useRef, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useApi } from "@/hooks/useApi";
import { ChevronDown, Search, Check, Loader2 } from "lucide-react";

export function ModelSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    apiKey,
    selectedModel,
    setSelectedModel,
    models,
    modelsLoading,
    setIsSettingsOpen,
  } = useStore();

  const { fetchModels } = useApi();

  useEffect(() => {
    if (isOpen && apiKey && models.length === 0 && !modelsLoading) {
      fetchModels();
    }
  }, [isOpen, apiKey, models.length, modelsLoading, fetchModels]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!apiKey) {
      setIsSettingsOpen(true);
      return;
    }
    setIsOpen(!isOpen);
  };

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    setIsOpen(false);
    setSearchQuery("");
  };

  const filteredModels = models.filter((model) =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getModelDisplayName = () => {
    const model = models.find((m) => m.id === selectedModel);
    if (model) {
      return model.name;
    }
    const modelParts = selectedModel.split("/");
    return modelParts[modelParts.length - 1] || "Select Model";
  };

  return (
    <div data-design-id="model-selector-container" className="relative" ref={dropdownRef}>
      <button
        data-design-id="model-selector-trigger"
        onClick={handleToggle}
        className="flex items-center gap-1 xs:gap-2 px-2 xs:px-3 py-1 xs:py-1.5 rounded-md border border-border bg-muted hover:bg-accent active:bg-accent hover:border-primary/50 transition-all text-[11px] xs:text-[13px]"
      >
        <div className="w-4 h-4 xs:w-[18px] xs:h-[18px] rounded bg-primary flex items-center justify-center flex-shrink-0">
          <svg className="w-2.5 h-2.5 xs:w-3 xs:h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <span className="text-foreground hidden xs:inline truncate max-w-[80px] sm:max-w-[120px]">
          {getModelDisplayName()}
        </span>
        <ChevronDown className={`w-3 h-3 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          data-design-id="model-selector-dropdown"
          className="absolute bottom-full left-0 mb-2 w-[280px] xs:w-[320px] sm:w-[360px] bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                data-design-id="model-search-input"
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
            </div>
          </div>

          <div className="max-h-[240px] xs:max-h-[280px] sm:max-h-[320px] overflow-y-auto p-1.5">
            {modelsLoading ? (
              <div className="flex items-center justify-center py-8 gap-2">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="text-sm text-muted-foreground">Loading models...</span>
              </div>
            ) : !apiKey ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground mb-3">API key required</p>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setIsSettingsOpen(true);
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Add API key in settings
                </button>
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {searchQuery ? "No models found" : "No models available"}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredModels.map((model) => (
                  <button
                    key={model.id}
                    data-design-id={`model-option-${model.id.replace(/[^a-zA-Z0-9]/g, "-")}`}
                    onClick={() => handleSelectModel(model.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors text-left ${
                      selectedModel === model.id
                        ? "bg-primary/15 border border-primary/30"
                        : "hover:bg-accent border border-transparent"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground truncate">{model.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{model.id}</div>
                    </div>
                    {selectedModel === model.id && (
                      <Check className="w-4 h-4 text-primary flex-shrink-0 ml-2" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}