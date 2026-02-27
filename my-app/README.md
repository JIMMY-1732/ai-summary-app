# AI Summary App

## Features

- Upload PDF files to Supabase Storage
- View uploaded PDFs using signed URLs
- Extract PDF text server-side
- Generate AI summaries in Markdown with options (`language`, `length`, `tone`)
- Edit summary Markdown and persist updates to database
- Responsive split-pane demo UI

## Setup

1. Copy environment template:

```bash
cp .env.example .env.local
```

2. Fill values in `.env.local`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (for example `documents`)
- `POE_API_KEY`
- `POE_MODEL` (optional, default `Grok-4`)
- `POE_BASE_URL` (optional, default `https://api.poe.com/v1`)

3. Create database schema in Supabase SQL editor:

- Run [supabase/schema.sql](supabase/schema.sql)

4. Install dependencies and start app:

```bash
npm install
npm run dev
```

## Test Commands

```bash
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
```

If running e2e for the first time, install browser binaries:

```bash
npx playwright install
```
