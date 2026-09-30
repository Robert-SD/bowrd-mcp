#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as dotenv from "dotenv";
import { BowrdClient } from "./client.js";

// Load environment variables from .env
dotenv.config();

const client = new BowrdClient();

// Initialize the MCP Server
const server = new McpServer({
  name: "bowrd-mcp",
  version: "1.0.0",
});

// Tool: List boards
server.tool(
  "bowrd_list_boards",
  "List all boards in Bowrd with their ID, name, slug, description, and pin counts.",
  {},
  async () => {
    try {
      const boards = await client.getBoards();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(boards, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error fetching boards: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: Create board
server.tool(
  "bowrd_create_board",
  "Create a new board in Bowrd for organizing visual bookmarks.",
  {
    name: z.string().describe("The name of the board (e.g. 'Interior Design', 'App UI Ideas')"),
    description: z.string().optional().describe("Optional description explaining the board's theme"),
    is_public: z.boolean().default(true).describe("Whether the board is public (default: true)"),
  },
  async ({ name, description, is_public }) => {
    try {
      const board = await client.createBoard(name, description, is_public);
      return {
        content: [
          {
            type: "text",
            text: `Successfully created board "${board.name}" (ID: ${board.id}, Slug: ${board.slug})`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error creating board: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: List entries
server.tool(
  "bowrd_list_entries",
  "List pins/entries from Bowrd, optionally filtered by a specific board ID.",
  {
    board_id: z.number().optional().describe("Optional board ID to filter entries by"),
    limit: z.number().min(1).max(50).default(20).describe("Maximum number of entries to return (default: 20)"),
  },
  async ({ board_id, limit }) => {
    try {
      const entries = await client.getEntries(board_id, limit);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(entries, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error fetching entries: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: Create entry (Pin an image)
server.tool(
  "bowrd_create_entry",
  "Create a new pin/entry in Bowrd. Automatically downloads the image to Bowrd storage and attaches it to the specified board.",
  {
    board_id: z.number().describe("The ID of the board to add this pin to"),
    title: z.string().describe("Title of the pin/entry"),
    image_url: z.string().url().describe("Direct URL to the image"),
    source_url: z.string().url().optional().describe("Source webpage where the image was found"),
    description: z.string().optional().describe("Optional notes or description for the pin"),
    is_public: z.boolean().default(true).describe("Whether the pin is publicly visible"),
    tags: z.array(z.string()).optional().describe("Optional list of tags (e.g. ['architecture', 'minimalism'])"),
  },
  async ({ board_id, title, image_url, source_url, description, is_public, tags }) => {
    try {
      const entry = await client.createEntry({
        boardId: board_id,
        title,
        imageUrl: image_url,
        sourceUrl: source_url,
        description,
        isPublic: is_public,
        tags,
      });

      return {
        content: [
          {
            type: "text",
            text: `Successfully pinned "${entry.title}" (UUID: ${entry.uuid}) to board ID ${board_id}!`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error creating entry: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: Search entries
server.tool(
  "bowrd_search_entries",
  "Search through your Bowrd pins by matching keywords in title, description, or source URL.",
  {
    query: z.string().describe("Keyword or phrase to search for"),
    limit: z.number().min(1).max(50).default(20).describe("Maximum results to return"),
  },
  async ({ query, limit }) => {
    try {
      const results = await client.search(query, limit);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error searching entries: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Tool: Scrape/discover images from a webpage
server.tool(
  "bowrd_scrape_images_from_url",
  "Scrape a webpage URL to automatically find images, title, and description using Bowrd's image finder service.",
  {
    url: z.string().url().describe("The webpage URL to scrape for images"),
  },
  async ({ url }) => {
    try {
      const result = await client.fetchImagesFromUrl(url);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error scraping images: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Start the server over STDIO
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting Bowrd MCP server:", err);
  process.exit(1);
});
