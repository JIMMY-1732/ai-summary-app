'use client'

import { useEffect, useMemo, useRef, useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

type DocumentListItem = {
  id: string;
  fileName: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
};

type SummaryRecord = {
  id: string;
  contentMarkdown: string;
  language: string;
  length: string;
  tone: string;
  updatedAt: string;
};

type DocumentDetailResponse = {
  ok: boolean;
  document?: {
    id: string;
    fileName: string;
    sizeBytes: number;
    status: string;
    extractedText: string;
    createdAt: string;
  };
  viewerUrl?: string;
  summary?: SummaryRecord | null;
  message?: string;
};

type CachedDocumentDetail = {
  viewerUrl: string | null;
  extractedText: string;
  summary: SummaryRecord | null;
};

type TabKey = 'viewer' | 'text' | 'summary';

function formatBytes(bytes: number) {
  return `${Math.round(bytes / 1024)} KB`;
}

export default function Home() {
  const showStatusText = process.env.NEXT_PUBLIC_STATUS === 'dev';

  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('viewer');
  const [status, setStatus] = useState('Ready');
  const [loadingList, setLoadingList] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);
  const [extractingManual, setExtractingManual] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [summary, setSummary] = useState<SummaryRecord | null>(null);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [editingSummary, setEditingSummary] = useState(false);
  const [detailCache, setDetailCache] = useState<Record<string, CachedDocumentDetail>>({});

  const [language, setLanguage] = useState('English');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [tone, setTone] = useState<'neutral' | 'professional' | 'simple'>('neutral');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isWaiting =
    loadingList ||
    uploading ||
    loadingDetail ||
    generating ||
    savingSummary ||
    extractingManual ||
    Boolean(deletingId);

  const loadingMessage = (() => {
    if (uploading) return 'Uploading file and extracting text...';
    if (extractingManual) return 'Extracting text from PDF...';
    if (loadingDetail) return 'Loading document...';
    if (generating) return 'Generating summary...';
    if (savingSummary) return 'Saving summary...';
    if (deletingId) return 'Deleting document...';
    if (loadingList) return 'Refreshing files...';
    return 'Working...';
  })();

  const selectedDocument = useMemo(
    () => documents.find((item) => item.id === selectedId) ?? null,
    [documents, selectedId],
  );

  async function refreshDocuments() {
    setLoadingList(true);
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? 'Failed to load document list');
      }

      setDocuments(data.documents as DocumentListItem[]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to refresh');
    } finally {
      setLoadingList(false);
    }
  }

  async function loadDocument(id: string) {
    const cached = detailCache[id];
    if (cached) {
      setSelectedId(id);
      setViewerUrl(cached.viewerUrl);
      setExtractedText(cached.extractedText);
      setSummary(cached.summary);
      setSummaryDraft(cached.summary?.contentMarkdown ?? '');
      setEditingSummary(false);
      setStatus(`Loaded ${documents.find((item) => item.id === id)?.fileName ?? 'document'} (cached)`);
      return;
    }

    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/documents/${id}`);
      const data: DocumentDetailResponse = await res.json();

      if (!res.ok || !data.ok || !data.document) {
        throw new Error(data.message ?? 'Failed to load document');
      }

      setSelectedId(id);
      setViewerUrl(data.viewerUrl ?? null);
      setExtractedText(data.document.extractedText ?? '');
      setSummary(data.summary ?? null);
      setSummaryDraft(data.summary?.contentMarkdown ?? '');
      setEditingSummary(false);
      setDetailCache((prev) => ({
        ...prev,
        [id]: {
          viewerUrl: data.viewerUrl ?? null,
          extractedText: data.document?.extractedText ?? '',
          summary: data.summary ?? null,
        },
      }));
      setStatus(`Loaded ${data.document.fileName}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load document');
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      setStatus('Choose a PDF before upload');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? 'Upload failed');
      }

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      const uploadedDocument = data.document as DocumentListItem & { extractedText?: string };
      const immediateExtractedText = uploadedDocument.extractedText ?? '';
      setSelectedId(uploadedDocument.id);
      setExtractedText(immediateExtractedText);
      setSummary(null);
      setSummaryDraft('');
      setEditingSummary(false);
      setDetailCache((prev) => ({
        ...prev,
        [uploadedDocument.id]: {
          viewerUrl: null,
          extractedText: immediateExtractedText,
          summary: null,
        },
      }));

      setStatus(data.message ?? `Uploaded ${data.document.fileName}`);
      await refreshDocuments();
      await loadDocument(uploadedDocument.id);
      setActiveTab('text');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? 'Delete failed');
      }

      if (selectedId === id) {
        setSelectedId(null);
        setViewerUrl(null);
        setExtractedText('');
        setSummary(null);
        setSummaryDraft('');
        setEditingSummary(false);
      }
      setDetailCache((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await refreshDocuments();
      setStatus('Deleted document');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleManualExtract() {
    if (!selectedId) {
      setStatus('Select a document first');
      return;
    }

    setExtractingManual(true);
    try {
      const res = await fetch(`/api/documents/${selectedId}/extract`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? 'Extraction failed');
      }

      const fullText = String(data.extractedText ?? '');
      setExtractedText(fullText);

      setDetailCache((prev) => {
        const existing = prev[selectedId];
        return {
          ...prev,
          [selectedId]: {
            viewerUrl: existing?.viewerUrl ?? viewerUrl,
            extractedText: fullText,
            summary: existing?.summary ?? summary,
          },
        };
      });

      setStatus(
        data.message ??
          `Extraction completed (${fullText.length} chars)`,
      );
      setActiveTab('text');
      await refreshDocuments();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Extraction failed');
    } finally {
      setExtractingManual(false);
    }
  }

  async function handleGenerateSummary() {
    if (!selectedId) {
      setStatus('Select a document first');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/summaries/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedId,
          options: { language, length, tone },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? 'Summary generation failed');
      }

      setSummary(data.summary as SummaryRecord);
      setSummaryDraft((data.summary as SummaryRecord).contentMarkdown);
      setEditingSummary(false);
      setDetailCache((prev) => {
        if (!selectedId) {
          return prev;
        }

        const existing = prev[selectedId];
        return {
          ...prev,
          [selectedId]: {
            viewerUrl: existing?.viewerUrl ?? viewerUrl,
            extractedText: existing?.extractedText ?? extractedText,
            summary: data.summary as SummaryRecord,
          },
        };
      });
      setActiveTab('summary');
      setStatus('Summary generated');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Summary generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveSummary() {
    if (!summary?.id) {
      setStatus('Generate a summary first');
      return;
    }

    setSavingSummary(true);
    try {
      const res = await fetch(`/api/summaries/${summary.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentMarkdown: summaryDraft }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? 'Save failed');
      }

      setSummary(data.summary as SummaryRecord);
      setSummaryDraft((data.summary as SummaryRecord).contentMarkdown);
      setEditingSummary(false);
      setDetailCache((prev) => {
        if (!selectedId) {
          return prev;
        }

        const existing = prev[selectedId];
        return {
          ...prev,
          [selectedId]: {
            viewerUrl: existing?.viewerUrl ?? viewerUrl,
            extractedText: existing?.extractedText ?? extractedText,
            summary: data.summary as SummaryRecord,
          },
        };
      });
      setStatus('Summary saved');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSavingSummary(false);
    }
  }

  useEffect(() => {
    void refreshDocuments();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
          <h1 className="mb-4 text-3xl font-bold text-slate-800">AI Summary App</h1>

          <h2 className="mb-2 text-lg font-semibold">Upload Document</h2>
          <div className="mb-4 rounded-lg border border-slate-300 bg-slate-50 p-3">
            <input
              ref={fileInputRef}
              data-testid="file-input"
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
              }}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-md border border-slate-400 bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-100"
                >
                  Choose PDF
                </button>
                <p className="mt-2 truncate text-sm text-slate-600" title={selectedFile?.name ?? ''}>
                  {selectedFile ? selectedFile.name : 'No file selected'}
                </p>
                <p className="text-xs text-slate-500">PDF only, up to 20MB</p>
              </div>

              <button
                data-testid="upload-btn"
                onClick={() => void handleUpload()}
                disabled={!selectedFile || uploading}
                className="rounded-md bg-slate-700 px-6 py-3 text-lg font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-3xl font-semibold">Stored Files</h2>
            <button
              data-testid="refresh-btn"
              onClick={() => void refreshDocuments()}
              disabled={loadingList}
              className="rounded bg-slate-600 px-3 py-2 text-white disabled:opacity-50"
            >
              {loadingList ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          <div className="overflow-x-auto rounded border border-slate-300">
            <table className="w-full text-left">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2">File Name</th>
                  <th className="p-2">Size</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.length === 0 ? (
                  <tr>
                    <td className="p-2 text-slate-500" colSpan={3}>
                      No files uploaded.
                    </td>
                  </tr>
                ) : (
                  documents.map((item) => (
                    <tr key={item.id} className="border-t border-slate-200">
                      <td className="p-2">
                        <button
                          data-testid={`open-${item.id}`}
                          className="text-left text-blue-700 underline"
                          onClick={() => void loadDocument(item.id)}
                        >
                          {item.fileName}
                        </button>
                      </td>
                      <td className="p-2">{formatBytes(item.sizeBytes)}</td>
                      <td className="p-2">
                        <button
                          data-testid={`delete-${item.id}`}
                          onClick={() => void handleDelete(item.id)}
                          disabled={Boolean(deletingId)}
                          className="rounded bg-red-600 px-3 py-1 font-semibold text-white"
                        >
                          {deletingId === item.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-2xl font-bold">
            Document: {selectedDocument?.fileName ?? 'None selected'}
          </h2>

          <div className="mb-3 flex gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab('viewer')}
              className={`rounded px-3 py-2 ${activeTab === 'viewer' ? 'bg-slate-700 text-white' : 'bg-slate-100'}`}
            >
              PDF Viewer
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`rounded px-3 py-2 ${activeTab === 'text' ? 'bg-slate-700 text-white' : 'bg-slate-100'}`}
            >
              Extracted Text
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`rounded px-3 py-2 ${activeTab === 'summary' ? 'bg-slate-700 text-white' : 'bg-slate-100'}`}
            >
              Summary
            </button>
          </div>

          <div className={activeTab === 'viewer' ? 'h-[500px] overflow-hidden rounded border border-slate-300' : 'hidden'}>
            {viewerUrl ? (
              <iframe title="pdf-viewer" src={viewerUrl} className="h-full w-full" />
            ) : (
              <div className="p-3 text-slate-500">Select a document to view PDF.</div>
            )}
          </div>

          {activeTab === 'text' && (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  data-testid="extract-btn"
                  onClick={() => void handleManualExtract()}
                  disabled={!selectedId || extractingManual || loadingDetail}
                  className="rounded bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                >
                  {extractingManual ? 'Extracting...' : 'Extract Text'}
                </button>
                <span className="text-sm text-slate-600">
                  Extracted {extractedText.length} chars
                </span>
              </div>

              <div className="h-[450px] overflow-y-auto rounded border border-slate-300 p-3 whitespace-pre-wrap">
                {extractedText || 'No extracted text yet.'}
              </div>
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="grid gap-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Language</span>
                  <input
                    data-testid="language-input"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className="rounded border border-slate-300 px-2 py-1"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Length</span>
                  <select
                    data-testid="length-select"
                    value={length}
                    onChange={(event) => setLength(event.target.value as 'short' | 'medium' | 'long')}
                    className="rounded border border-slate-300 px-2 py-1"
                  >
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Tone</span>
                  <select
                    data-testid="tone-select"
                    value={tone}
                    onChange={(event) => setTone(event.target.value as 'neutral' | 'professional' | 'simple')}
                    className="rounded border border-slate-300 px-2 py-1"
                  >
                    <option value="neutral">Neutral</option>
                    <option value="professional">Professional</option>
                    <option value="simple">Simple</option>
                  </select>
                </label>
              </div>

              <div>
                <div className="flex flex-wrap gap-2">
                  <button
                    data-testid="generate-btn"
                    onClick={() => void handleGenerateSummary()}
                    disabled={!selectedId || generating || loadingDetail}
                    className="rounded bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                  >
                    {generating ? 'Generating...' : 'Generate Summary'}
                  </button>
                  <button
                    type="button"
                    data-testid="edit-summary-btn"
                    onClick={() => setEditingSummary((prev) => !prev)}
                    disabled={!summaryDraft || generating || loadingDetail}
                    className="rounded bg-slate-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
                  >
                    {editingSummary ? 'Preview' : 'Edit'}
                  </button>
                </div>
              </div>

              <div className="rounded border border-slate-300 p-3">
                <h3 className="mb-2 font-semibold">Summary</h3>
                {editingSummary ? (
                  <div data-color-mode="light">
                    <MDEditor
                      value={summaryDraft}
                      onChange={(value) => setSummaryDraft(value ?? '')}
                      preview="edit"
                      height={420}
                      textareaProps={{
                        placeholder: 'Summary markdown appears here',
                      }}
                    />
                  </div>
                ) : (
                  <div data-color-mode="light">
                    <MDEditor.Markdown source={summaryDraft || '*No summary*'} />
                  </div>
                )}
              </div>
              <button
                data-testid="save-summary-btn"
                onClick={() => void handleSaveSummary()}
                disabled={!summary || savingSummary || !editingSummary}
                className="w-fit rounded bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
              >
                {savingSummary ? 'Saving...' : 'Save Summary'}
              </button>
            </div>
          )}
        </section>
      </div>

      {showStatusText && (
        <p data-testid="status-text" className="mx-auto mt-4 max-w-7xl text-sm text-slate-700">
          {status}
        </p>
      )}

      {isWaiting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35">
          <div className="rounded-lg bg-white px-6 py-4 shadow-lg">
            <div className="mb-2 flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              <p className="font-semibold text-slate-800">Please wait</p>
            </div>
            <p className="text-sm text-slate-600">{loadingMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}