const API_BASE = "https://api.e2b.app";

interface CreateTemplateResponse {
  templateID: string;
  buildID: string;
  public: boolean;
  names: string[];
  tags: string[];
  aliases: string[];
}

interface BuildStatusResponse {
  templateID: string;
  public: boolean;
  builds: Array<{
    buildID: string;
    status: "building" | "ready" | "error";
    createdAt: string;
    updatedAt: string;
  }>;
}

export async function createTemplate(apiKey: string): Promise<CreateTemplateResponse> {
  const res = await fetch(`${API_BASE}/v3/templates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      name: `sandbox-template-${Date.now()}`,
      cpuCount: 8,
      memoryMB: 8192,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Failed to create template: ${res.status}`);
  }

  return res.json();
}

export async function startBuild(
  apiKey: string,
  templateID: string,
  buildID: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/v2/templates/${templateID}/builds/${buildID}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ fromTemplate: "base" }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Failed to start build: ${res.status}`);
  }
}

export async function makeTemplatePublic(
  apiKey: string,
  templateID: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/v2/templates/${templateID}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({ public: true }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Failed to make template public: ${res.status}`);
  }
}

export async function getBuildStatus(
  apiKey: string,
  templateID: string
): Promise<BuildStatusResponse> {
  const res = await fetch(`${API_BASE}/templates/${templateID}`, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Failed to get build status: ${res.status}`);
  }

  return res.json();
}
