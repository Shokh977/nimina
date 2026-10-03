'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { loadCustomFont } from '@/components/customFontLoader';
import { customFontFamily } from '@/engine/customFonts';
import { FONT_ACCEPT, MAX_FONT_BYTES } from '@/lib/fonts/limits';
import { isPro } from '@/lib/plan';
import { fetchUsage } from '@/lib/storage/assets';
import { useEditorStore } from '@/store/editorStore';
import { reloadUserFonts, useUserFonts, type UserFont } from '../useUserFonts';

/**
 * "Your fonts" in the Look panel: the account's uploaded typefaces (Pro),
 * selectable as the project's typeface, with upload and delete. Uploading
 * requires ticking that you have the right to use the font commercially —
 * Nimina isn't a font licensor; the statement and its time are recorded.
 */
export default function CustomFonts({ selectedId }: { selectedId: string | undefined }) {
  const plan = useEditorStore((s) => s.plan);
  const setCustomFont = useEditorStore((s) => s.setCustomFont);
  const { fonts, max, loaded } = useUserFonts();
  const [open, setOpen] = useState(false);
  const pro = isPro(plan);

  // Load each face so its row previews in the real font.
  useEffect(() => {
    fonts.forEach((f) => void loadCustomFont(f).catch(() => {}));
  }, [fonts]);

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12.5px] font-bold text-[#767e8d]">Your fonts</span>
        {pro ? <span className="text-[11.5px] text-[#767e8d]">{fonts.length} of {max}</span> : <span className="rounded-full bg-[#5b4bff]/20 px-2 py-0.5 text-[10.5px] font-bold text-[#cfc8ff]">Pro</span>}
      </div>

      {fonts.length > 0 && (
        <div className="grid gap-1.5">
          {fonts.map((f) => (
            <FontRow key={f.id} font={f} selected={selectedId === f.id} onSelect={() => setCustomFont({ id: f.id, family: f.family, weight: f.weight, italic: f.italic })} />
          ))}
        </div>
      )}

      {!pro ? (
        <p className="mt-1 text-[12.5px] leading-snug text-[#9aa1af]">
          Use your brand&apos;s own typeface — upload .woff2, .ttf or .otf fonts with{' '}
          <Link href="/pricing" className="font-semibold text-[#8b7dff] hover:text-[#a89bff]">
            Pro
          </Link>
          .
        </p>
      ) : open ? (
        <UploadForm onDone={() => setOpen(false)} />
      ) : (
        <button
          type="button"
          disabled={!loaded || fonts.length >= max}
          onClick={() => setOpen(true)}
          className="mt-2 w-full rounded-[10px] border border-dashed border-white/[.18] bg-white/[.02] px-3 py-2.5 text-[12.5px] font-semibold text-[#c9cdd8] hover:border-[#8b7dff]/50 hover:bg-[#5b4bff]/[.08] disabled:opacity-50"
        >
          {fonts.length >= max ? `You have ${max} fonts — delete one to add another` : '＋ Upload a font'}
        </button>
      )}
    </div>
  );
}

function FontRow({ font, selected, onSelect }: { font: UserFont; selected: boolean; onSelect: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    await fetch(`/api/fonts/${font.id}`, { method: 'DELETE' });
    await reloadUserFonts();
    void fetchUsage();
    setBusy(false);
  };
  return (
    <div className={`flex items-center gap-2 rounded-[11px] border px-3 py-2 ${selected ? 'border-[#8b7dff]/55 bg-[#5b4bff]/[.14]' : 'border-white/10 bg-white/[.03]'}`}>
      <button type="button" onClick={onSelect} aria-pressed={selected} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[14.5px] text-[#f4f5f8]" style={{ fontFamily: `"${customFontFamily(font.id)}", Figtree, sans-serif`, fontStyle: font.italic ? 'italic' : undefined }}>
          {font.family}
        </span>
        <span className="block text-[11px] text-[#767e8d]">
          Uploaded · {font.format.toUpperCase()} · {(font.bytes / 1024).toFixed(0)} KB
        </span>
      </button>
      {confirming ? (
        <span className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={remove} disabled={busy} className="rounded-[8px] bg-[#d9442a] px-2 py-1 text-[12px] font-semibold text-white">
            {busy ? '…' : 'Delete'}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="rounded-[8px] px-2 py-1 text-[12px] text-[#9aa1af]">
            Keep
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} aria-label={`Delete ${font.family}`} title="Delete this font" className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] text-[13px] text-[#9aa1af] hover:bg-white/[.08]">
          ✕
        </button>
      )}
    </div>
  );
}

function UploadForm({ onDone }: { onDone: () => void }) {
  const setCustomFont = useEditorStore((s) => s.setCustomFont);
  const [file, setFile] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    setError('');
    if (!f) return setFile(null);
    if (!/\.(woff2|ttf|otf)$/i.test(f.name)) return setError('Choose a .woff2, .ttf or .otf file.');
    if (f.size > MAX_FONT_BYTES) return setError(`That font is ${(f.size / 1048576).toFixed(1)} MB — the limit is 2 MB per file.`);
    setFile(f);
  };

  const upload = async () => {
    if (!file || !rights) return;
    setBusy(true);
    setError('');
    const body = new FormData();
    body.set('file', file);
    body.set('rights', 'yes');
    const res = await fetch('/api/fonts', { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error ?? 'Upload failed.');
    await reloadUserFonts();
    void fetchUsage();
    const f = data.font as UserFont;
    setCustomFont({ id: f.id, family: f.family, weight: f.weight, italic: f.italic });
    onDone();
  };

  return (
    <div className="mt-2 grid gap-2.5 rounded-[11px] border border-white/10 bg-white/[.03] p-3">
      <input ref={inputRef} type="file" accept={FONT_ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <button type="button" onClick={() => inputRef.current?.click()} className="rounded-[9px] border border-white/[.14] px-3 py-2 text-left text-[13px] font-semibold text-[#e4e6ec] hover:bg-white/[.06]">
        {file ? <span className="block truncate">{file.name}</span> : 'Choose a .woff2, .ttf or .otf file (max 2 MB)'}
      </button>
      <label className="flex items-start gap-2 text-[12.5px] leading-snug text-[#c9cdd8]">
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#5b4bff]" />
        <span>
          I have the right to use this font commercially — for example, I bought a licence that covers videos and apps, or it&apos;s released under an open licence such as the SIL OFL. Nimina doesn&apos;t license fonts.
        </span>
      </label>
      {error && (
        <p role="alert" className="text-[12.5px] leading-snug text-[#ff8f76]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={upload} disabled={!file || !rights || busy} className="flex-1 rounded-[9px] bg-[#5b4bff] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#6d5eff] disabled:opacity-50">
          {busy ? 'Checking and uploading…' : 'Upload font'}
        </button>
        <button type="button" onClick={onDone} className="rounded-[9px] px-3 py-2 text-[13px] text-[#9aa1af] hover:bg-white/[.06]">
          Cancel
        </button>
      </div>
    </div>
  );
}
