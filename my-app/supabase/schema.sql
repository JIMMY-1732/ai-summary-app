create extension if not exists pgcrypto;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  storage_path text not null unique,
  extracted_text text not null default '',
  status text not null default 'uploaded' check (status in ('uploaded', 'extracted', 'summarized')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists summary_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  content_markdown text not null,
  language text not null,
  length text not null,
  tone text not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_summary_versions_document_id on summary_versions(document_id);
create unique index if not exists idx_summary_versions_current on summary_versions(document_id) where is_current = true;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_documents_updated_at on documents;
create trigger trg_documents_updated_at
before update on documents
for each row execute function set_updated_at();

drop trigger if exists trg_summary_versions_updated_at on summary_versions;
create trigger trg_summary_versions_updated_at
before update on summary_versions
for each row execute function set_updated_at();
