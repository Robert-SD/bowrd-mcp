import type { Board, Entry, ScrapedPage } from "./types.js";

export class BowrdClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl?: string, token?: string) {
    this.baseUrl = (baseUrl || process.env.BOWRD_URL || "").replace(/\/$/, "");
    this.token = token || process.env.BOWRD_API_TOKEN || "";

    if (!this.baseUrl) {
      console.error("Warning: BOWRD_URL is not configured.");
    }
    if (!this.token) {
      console.error("Warning: BOWRD_API_TOKEN is not configured.");
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const text = await response.text();
      let errorMsg = `Bowrd API error (${response.status}): ${response.statusText}`;
      try {
        const json = JSON.parse(text);
        if (json.message) errorMsg = `${errorMsg} - ${json.message}`;
      } catch {
        if (text) errorMsg = `${errorMsg} - ${text.substring(0, 200)}`;
      }
      throw new Error(errorMsg);
    }

    return (await response.json()) as T;
  }

  async getBoards(): Promise<Board[]> {
    return this.request<Board[]>("/api/mcp/boards");
  }

  async createBoard(name: string, description?: string, isPublic: boolean = true): Promise<Board> {
    return this.request<Board>("/api/mcp/boards", {
      method: "POST",
      body: JSON.stringify({
        name,
        description,
        is_public: isPublic,
      }),
    });
  }

  async getEntries(boardId?: number, limit: number = 20): Promise<Entry[]> {
    const params = new URLSearchParams();
    if (boardId) params.append("board_id", boardId.toString());
    params.append("limit", limit.toString());

    return this.request<Entry[]>(`/api/mcp/entries?${params.toString()}`);
  }

  async createEntry(params: {
    boardId: number;
    title: string;
    imageUrl: string;
    sourceUrl?: string;
    description?: string;
    isPublic?: boolean;
    tags?: string[];
  }): Promise<Entry> {
    return this.request<Entry>("/api/mcp/entries", {
      method: "POST",
      body: JSON.stringify({
        board_id: params.boardId,
        title: params.title,
        images: [params.imageUrl],
        source_url: params.sourceUrl,
        description: params.description,
        is_public: params.isPublic ?? true,
        tags: params.tags,
      }),
    });
  }

  async search(query: string, limit: number = 20): Promise<Entry[]> {
    const params = new URLSearchParams({ query, limit: limit.toString() });
    return this.request<Entry[]>(`/api/mcp/search?${params.toString()}`);
  }

  async fetchImagesFromUrl(url: string): Promise<ScrapedPage> {
    return this.request<ScrapedPage>("/api/mcp/fetch-images", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  }
}
