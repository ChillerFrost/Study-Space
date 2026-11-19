# Study-Space

A study workspace for students: write notes, turn them into AI-generated summaries and quizzes, and see upcoming Canvas assignments on a calendar.

## Current features

- **Notes**: write and edit notes, saved in your browser (localStorage). Export any note as PDF or DOCX.
- **AI Study Tools**: paste notes to generate a summary, or a quiz with multiple choice, true/false and flashcards.
  - Works with three AI providers, picked with `LLM_PROVIDER` in `.env`:
    - `spark` (default): a DGX Spark gateway that uses the OpenAI request format
    - `openai`
    - `anthropic`
- **Canvas**: a monthly calendar and agenda of upcoming assignments from all your active Canvas courses, loaded through the Canvas API.
- **Connection status**: the sidebar shows whether AI and Canvas are connected.

All API keys stay on the server (`server/`). The browser only talks to the server through `/api`.

## Getting started

1. Install [Node.js](https://nodejs.org) 22 or newer.
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in:
   - an AI provider's key and model
   - `CANVAS_BASE_URL`, your school's Canvas address ending in `/api/v1`
   - `CANVAS_API_TOKEN`, from Canvas: Account → Settings → New Access Token
4. Start the app:
   ```
   npm run dev:all
   ```
   This starts both the API server (port 3001) and the Vite frontend. Open the address Vite prints.

| Script | What it does |
| --- | --- |
| `npm run dev:all` | Starts the API server and the frontend together |
| `npm run dev` | Starts the frontend only (AI and Canvas show as not connected) |
| `npm run server` | Starts the API server only. It restarts on its own when `server/` or `.env` changes |
| `npm run build` | Builds the frontend for production |

## Planned: user accounts and storage

Right now there is one set of keys in a shared `.env`, and data lives only in one browser. Next we plan to add:

- **User accounts**: sign up and log in, so each student has their own notes, quizzes, summaries and Canvas connection.
- **Settings page**: lets each user set their own API details without editing `.env`:
  - which AI provider to use
  - their AI API key and model
  - their Canvas URL and access token

  Keys entered here will be stored on the server, never sent back to the browser in full.
- **Storage choice**: each user picks where their notes, quizzes and summaries are saved:
  - **Local**: saved on the user's own device. This is how it works today, with the `src/data/` folders planned for local files.
  - **MongoDB**: saved to the cloud, so the same data shows up on any device the user logs into. It uses the `MONGODB_*` settings in `.env`.

## Project layout

```
server/            Express API (AI and Canvas calls, keys stay here)
  index.js         Routes: /api/summarize, /api/quiz, /api/assignments, /api/health
  llm.js           askLLM(): one function for every AI provider
  canvas.js        Canvas API client
src/
  pages/           Notes, AI Study Tools, Canvas
  components/      Layout and study result screens
  services/        Browser code that calls the server
  lib/             Note storage, export, calendar helpers
  data/            Folders for locally saved quizzes, summaries and notes
```

## License

See [LICENSE](LICENSE).
