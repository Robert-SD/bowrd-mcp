export interface Board {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_public: boolean;
  entries_count?: number;
}

export interface EntryImage {
  id: number;
  entry_id: number;
  url: string;
  position: number;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Entry {
  id: number;
  uuid: string;
  user_id: number;
  title: string;
  description: string | null;
  source_url: string | null;
  is_public: boolean;
  created_at: string;
  images: EntryImage[];
  boards?: Board[];
  tags?: Tag[];
}

export interface ScrapedPage {
  images: string[];
  title: string;
  description: string;
  error?: string | null;
}

export interface UpdateEntryParams {
  title?: string;
  description?: string;
  boardId?: number;
  isPublic?: boolean;
  contentWarning?: string;
  tags?: string[];
}

