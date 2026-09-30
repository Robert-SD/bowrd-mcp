<?php

namespace App\Http\Controllers;

use App\Jobs\DownloadEntryImages;
use App\Jobs\FanoutEntryCreated;
use App\Models\Board;
use App\Models\Entry;
use App\Models\EntryImage;
use App\Models\Tag;
use App\Models\User;
use App\Services\ImageFinderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class McpApiController extends Controller
{
    /**
     * Authenticate request using MCP_API_TOKEN and retrieve the primary user.
     */
    protected function getAuthUser(Request $request): User
    {
        $token = $request->bearerToken();
        $expected = env('MCP_API_TOKEN');

        if (!$expected || !$token || !hash_equals($expected, $token)) {
            abort(401, 'Unauthorized MCP API token');
        }

        $user = null;
        if (env('ADMIN_EMAIL')) {
            $user = User::where('email', env('ADMIN_EMAIL'))->first();
        }

        if (!$user) {
            $user = User::firstOrFail();
        }

        return $user;
    }

    /**
     * List all boards belonging to the user.
     */
    public function boards(Request $request): JsonResponse
    {
        $user = $this->getAuthUser($request);
        $boards = $user->boards()
            ->withCount('entries')
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'description', 'is_public']);

        return response()->json($boards);
    }

    /**
     * Create a new board.
     */
    public function createBoard(Request $request): JsonResponse
    {
        $user = $this->getAuthUser($request);
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'is_public' => 'boolean',
        ]);

        $board = $user->boards()->create([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'is_public' => $request->boolean('is_public', true),
        ]);

        return response()->json($board, 201);
    }

    /**
     * List pins/entries, optionally filtered by board_id.
     */
    public function entries(Request $request): JsonResponse
    {
        $user = $this->getAuthUser($request);
        $query = Entry::where('user_id', $user->id)
            ->with(['images', 'boards:id,name,slug', 'tags:id,name'])
            ->latest();

        if ($request->has('board_id')) {
            $query->whereHas('boards', fn($q) => $q->where('boards.id', $request->input('board_id')));
        }

        $entries = $query->limit($request->integer('limit', 20))->get();

        return response()->json($entries);
    }

    /**
     * Get a single entry by ID or UUID.
     */
    public function entry(Request $request, $id): JsonResponse
    {
        $user = $this->getAuthUser($request);
        $entry = Entry::where('user_id', $user->id)
            ->where(function ($q) use ($id) {
                $q->where('id', $id)->orWhere('uuid', $id);
            })
            ->with(['images', 'boards:id,name,slug', 'tags:id,name'])
            ->firstOrFail();

        return response()->json($entry);
    }

    /**
     * Create a new pin/entry and dispatch background image download.
     */
    public function createEntry(Request $request): JsonResponse
    {
        $user = $this->getAuthUser($request);

        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'board_id' => 'required|exists:boards,id',
            'images' => 'required|array|min:1',
            'images.*' => 'required|url',
            'source_url' => 'nullable|url',
            'is_public' => 'boolean',
            'tags' => 'nullable|array',
        ]);

        $board = Board::where('id', $request->input('board_id'))
            ->where('user_id', $user->id)
            ->firstOrFail();

        $entry = DB::transaction(function () use ($request, $user, $board) {
            $entry = Entry::create([
                'uuid' => Str::uuid(),
                'user_id' => $user->id,
                'title' => $request->input('title'),
                'description' => $request->input('description'),
                'source_url' => $request->input('source_url'),
                'is_public' => $request->boolean('is_public', true),
                'is_safe' => 0,
            ]);

            foreach ($request->input('images') as $position => $url) {
                EntryImage::create([
                    'entry_id' => $entry->id,
                    'url' => $url,
                    'position' => $position,
                ]);
            }

            $board->entries()->attach($entry->id, [
                'user_id' => $user->id,
                'created_at' => now(),
            ]);

            if ($request->has('tags')) {
                $tagIds = [];
                foreach ($request->input('tags') as $tagName) {
                    $tag = Tag::firstOrCreate(['name' => Str::slug($tagName)]);
                    $tagIds[] = $tag->id;
                }
                $entry->tags()->sync($tagIds);
            }

            return $entry;
        });

        DownloadEntryImages::dispatch($entry);

        if ($entry->is_public) {
            FanoutEntryCreated::dispatch($entry);
        }

        return response()->json($entry->load(['images', 'boards:id,name,slug', 'tags:id,name']), 201);
    }

    /**
     * Update an existing entry (title, description, tags, move board, or visibility).
     */
    public function updateEntry(Request $request, $id): JsonResponse
    {
        $user = $this->getAuthUser($request);
        $entry = Entry::where('user_id', $user->id)
            ->where(function ($q) use ($id) {
                $q->where('id', $id)->orWhere('uuid', $id);
            })
            ->firstOrFail();

        $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'board_id' => 'nullable|exists:boards,id',
            'is_public' => 'boolean',
            'content_warning' => 'nullable|string|max:200',
            'tags' => 'nullable|array',
        ]);

        if ($request->has('title')) {
            $entry->title = $request->input('title');
        }
        if ($request->has('description')) {
            $entry->description = $request->input('description');
        }
        if ($request->has('is_public')) {
            $entry->is_public = $request->boolean('is_public');
        }
        if ($request->has('content_warning')) {
            $entry->content_warning = $request->input('content_warning');
        }
        $entry->save();

        if ($request->has('board_id') && $boardId = $request->input('board_id')) {
            $board = Board::where('id', $boardId)->where('user_id', $user->id)->firstOrFail();
            $entry->boards()->wherePivot('user_id', $user->id)->detach();
            $entry->boards()->attach($board->id, [
                'user_id' => $user->id,
                'created_at' => now(),
            ]);
        }

        if ($request->has('tags')) {
            $tagIds = [];
            foreach ($request->input('tags') as $tagName) {
                $tag = Tag::firstOrCreate(['name' => Str::slug($tagName)]);
                $tagIds[] = $tag->id;
            }
            $entry->tags()->sync($tagIds);
        }

        return response()->json($entry->load(['images', 'boards:id,name,slug', 'tags:id,name']));
    }

    /**
     * Search entries by title, description, or source URL.
     */
    public function search(Request $request): JsonResponse
    {
        $user = $this->getAuthUser($request);
        $q = $request->input('query');

        if (!$q) {
            return response()->json([]);
        }

        $entries = Entry::where('user_id', $user->id)
            ->where(function ($query) use ($q) {
                $query->where('title', 'like', "%{$q}%")
                    ->orWhere('description', 'like', "%{$q}%")
                    ->orWhere('source_url', 'like', "%{$q}%");
            })
            ->with(['images', 'boards:id,name,slug', 'tags:id,name'])
            ->latest()
            ->limit($request->integer('limit', 20))
            ->get();

        return response()->json($entries);
    }

    /**
     * Extract images and page metadata from a URL using Bowrd's ImageFinderService.
     */
    public function fetchImages(Request $request, ImageFinderService $finder): JsonResponse
    {
        $this->getAuthUser($request);
        $url = $request->input('url');

        if (!$url) {
            return response()->json(['error' => 'URL required'], 400);
        }

        return response()->json($finder->findFromUrl($url));
    }
}
