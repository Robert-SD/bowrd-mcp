---
name: bowrd-bookmarks
description: Use when the user asks to inspect, organize, search, pin, or scrape visual bookmarks, inspiration, images, or boards in Bowrd.
---

# Bowrd Visual Bookmarking Workflows

Use the Bowrd MCP tools to manage boards and pins in the user's self-hosted Bowrd instance.

## Available Tools

- `bowrd_list_boards`: List all boards with pin counts, descriptions, and slugs.
- `bowrd_create_board`: Create a new board (name, optional description, public/private).
- `bowrd_list_entries`: Browse pins, optionally filtered by `board_id`.
- `bowrd_get_entry`: Retrieve detailed information for a single pin by its ID or UUID.
- `bowrd_create_entry`: Pin an image to a board with title, image URL, source URL, description, and tags.
- `bowrd_update_entry`: Update an existing pin (edit title, description, tags, move board, or visibility).
- `bowrd_search_entries`: Search pins by keyword across title, notes, or source URL.
- `bowrd_scrape_images_from_url`: Extract high-resolution images and metadata from any webpage.

---

## Best Practices & Workflows

### 1. Board Discovery & Organization
- When the user asks about their bookmarks or wants to pin something without specifying a board, call `bowrd_list_boards` first to see existing boards.
- Avoid creating duplicate boards. Match the user's intent to an existing board whenever possible (e.g. use "Style" for fashion/outfits).

### 2. Pinning from a Webpage
When the user shares a URL or asks to bookmark an article/product/design:
1. Run `bowrd_scrape_images_from_url` with the provided URL.
2. Review the scraped candidate images and page title.
3. Call `bowrd_create_entry` using the primary image URL, setting `source_url` to the original page, and adding concise, relevant tags (e.g. `["architecture", "minimalism"]`).

### 3. Safety & Non-Destructive Operations
- **Guarded Destructive Actions:** Do not attempt or simulate deleting boards or entries. Bowrd MCP operations are strictly additive and exploratory to prevent accidental data loss.
- Always confirm board selection before pinning if there is ambiguity.
- Validate that image URLs are direct and accessible.
