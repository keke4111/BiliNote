# BiliNote Clean Release

This folder is a clean source copy created for release or migration.

## What is included

- Frontend and backend source code
- Dependency manifests and lock files
- Example environment files such as `.env.example`
- Project documentation and startup scripts
- Empty runtime directories required by the app

## What is not included

- Personal `.env` files
- API keys or provider configuration
- Bilibili cookies
- SQLite runtime database
- Downloaded audio/video files
- Generated notes, screenshots, frame grids, logs, vector indexes, and browser backup snapshots
- Installed dependencies such as `.venv` and `node_modules`
- Git history

## Setup after copying

1. Copy `.env.example` to `.env` and fill in local settings.
2. Install backend dependencies in `backend`.
3. Install frontend dependencies in `BillNote_frontend`.
4. Start backend and frontend normally.
5. Reconfigure model providers, cookies, and transcription settings in the app.

This clean copy does not contain previous notes, categories, versions, recycle-bin data, or browser `task-storage` data.
