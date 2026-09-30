# Bowrd MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-1.0.0-green.svg)](https://modelcontextprotocol.io/)

A Model Context Protocol (MCP) server for [Bowrd](https://bowrd.eu/) — the minimalist, self-hosted visual bookmarking platform and Pinterest alternative with ActivityPub / Fediverse integration.

This server enables AI assistants (Claude Desktop, Cursor, Antigravity, OpenClaw, Hermes, etc.) to browse your boards, search bookmarks, scrape images from the web, and pin visual inspirations directly into your Bowrd instance.

---

## Features & Tools

| Tool | Description | Parameters |
| :--- | :--- | :--- |
| `bowrd_list_boards` | List all boards with IDs, names, slugs, descriptions, and pin counts. | None |
| `bowrd_create_board` | Create a new board. | `name` (required), `description` (optional), `is_public` (default: `true`) |
| `bowrd_list_entries` | List pins/entries from Bowrd, optionally filtered by board. | `board_id` (optional), `limit` (1-50, default: `20`) |
| `bowrd_create_entry` | Pin an image to a board. Bowrd automatically downloads and stores the media. | `board_id` (required), `title` (required), `image_url` (required), `source_url` (optional), `description` (optional), `tags` (optional array), `is_public` (default: `true`) |
| `bowrd_search_entries` | Search through your pins by keyword in title, description, or source URL. | `query` (required), `limit` (default: `20`) |
| `bowrd_scrape_images_from_url` | Scrape a webpage to find images, title, and description using Bowrd's image finder. | `url` (required) |

---

## Quickstart

### 1. Prerequisites
- Node.js `>= 18`
- A running self-hosted [Bowrd](https://bowrd.eu/) instance with the API bridge enabled (see [Bowrd Backend Setup](#bowrd-backend-setup) below).

### 2. Installation & Build

```bash
git clone https://github.com/Robert-SD/bowrd-mcp.git
cd bowrd-mcp
npm install
npm run build
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Set your Bowrd URL and secret API token:
```env
BOWRD_URL=https://your-bowrd-domain.com
BOWRD_API_TOKEN=your_generated_mcp_token
```

---

## Client Integration

### Claude Desktop
Add this to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "bowrd": {
      "command": "npx",
      "args": ["-y", "bowrd-mcp"],
      "env": {
        "BOWRD_URL": "https://your-bowrd-domain.com",
        "BOWRD_API_TOKEN": "your_generated_mcp_token"
      }
    }
  }
}
```
*(If running from local source clone, replace `"command": "npx", "args": ["-y", "bowrd-mcp"]` with `"command": "node", "args": ["/path/to/bowrd-mcp/dist/index.js"]`)*

### Cursor
Add to `.cursor/mcp.json` in your workspace or global settings:

```json
{
  "mcpServers": {
    "bowrd": {
      "command": "npx",
      "args": ["-y", "bowrd-mcp"],
      "env": {
        "BOWRD_URL": "https://your-bowrd-domain.com",
        "BOWRD_API_TOKEN": "your_generated_mcp_token"
      }
    }
  }
}
```

### Google Antigravity (`agy`)
Install directly via the Antigravity plugin manager:
```bash
agy plugin install https://github.com/Robert-SD/bowrd-mcp
```
Make sure `BOWRD_URL` and `BOWRD_API_TOKEN` are set in your environment.

### Safety & Guardrails
- **Non-Destructive Operations**: To protect your visual library from unintended AI hallucination or accidental mass deletion, Bowrd MCP deliberately exposes strictly additive, reading, and searching tools. Deletions cannot be performed via MCP.


---

## Bowrd Backend Setup

As upstream Bowrd does not currently ship with an official REST API, this MCP server pairs with a lightweight API bridge controller included in [`laravel/McpApiController.php`](laravel/McpApiController.php).

### Step 1: Copy Controller
Copy [`laravel/McpApiController.php`](laravel/McpApiController.php) into your Bowrd project directory:
```bash
cp laravel/McpApiController.php <path-to-bowrd>/app/Http/Controllers/McpApiController.php
```

### Step 2: Register API Routes
Add the following to `<path-to-bowrd>/routes/web.php`:
```php
use App\Http\Controllers\McpApiController;

Route::prefix('api/mcp')->group(function () {
    Route::get('/boards', [McpApiController::class, 'boards']);
    Route::post('/boards', [McpApiController::class, 'createBoard']);
    Route::get('/entries', [McpApiController::class, 'entries']);
    Route::post('/entries', [McpApiController::class, 'createEntry']);
    Route::get('/search', [McpApiController::class, 'search']);
    Route::post('/fetch-images', [McpApiController::class, 'fetchImages']);
});
```

### Step 3: Exclude from CSRF Protection
In `<path-to-bowrd>/bootstrap/app.php` (Laravel 11+), ensure `api/*` is excluded from CSRF verification:
```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->validateCsrfTokens(except: [
        'api/*',
        '@*/inbox',
    ]);
})
```

### Step 4: Configure Token in `.env`
Add an MCP token to your Bowrd `.env`:
```env
MCP_API_TOKEN=your_secure_random_token_here
```
*(Optionally specify `ADMIN_EMAIL=user@example.com` if you want API actions explicitly tied to a specific account).*

Restart or rebuild your Bowrd container stack:
```bash
docker compose up -d
```

---

## Development

```bash
# Run with live TypeScript execution
npm run dev

# Compile TypeScript
npm run build
```

---

## License

This project is licensed under the [MIT License](LICENSE).
