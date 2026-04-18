/**
 * interventionRenderer.ts — Génération PDF bon d'intervention via @react-pdf/renderer + SharedPdfTemplate
 */
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { SharedDocument } from './SharedPdfTemplate';
import type { TemplateCfg } from './SharedPdfTemplate';
import type { Intervention, InterventionLine, Client } from '@/services/dolibarr';
import type { EntrepriseInfo } from './SharedPdfTemplate';
// @ts-ignore
import defaultLogoUrl from '@/assets/logo.png';

// ─── Config template depuis localStorage ─────────────────────────────────────

function readTemplateCfg(): TemplateCfg {
  try {
    if (typeof window === 'undefined') return {};
    const raw = window.localStorage.getItem('electropro-config');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed?.template as TemplateCfg) || {};
  } catch { return {}; }
}

// ─── Cache logo ───────────────────────────────────────────────────────────────

let _logoCache: { url: string; data: string } | null = null;

async function loadLogoDataUrl(src: string): Promise<string> {
  if (_logoCache && _logoCache.url === src) return _logoCache.data;
  try {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const data = reader.result as string;
        _logoCache = { url: src, data };
        resolve(data);
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch { return ''; }
}

// ─── Construction blob ────────────────────────────────────────────────────────

export interface InterventionRendererParams {
  intervention: Intervention;
  lines: InterventionLine[];
  client?: Client;
  entreprise?: EntrepriseInfo;
  signatureClient?: string;
  signatureTech?: string;
}

async function buildBlob(params: InterventionRendererParams): Promise<Blob> {
  const templateCfg = readTemplateCfg();
  const logoSrc = templateCfg.logoUrl || defaultLogoUrl;
  const logoDataUrl = await loadLogoDataUrl(logoSrc);
  const element = React.createElement(SharedDocument as any, {
    type: 'intervention',
    ...params,
    logoDataUrl,
    templateCfg,
  });
  return pdf(element as any).toBlob();
}

// ─── API publique ─────────────────────────────────────────────────────────────

export async function interventionPdfToBlobUrl(params: InterventionRendererParams): Promise<string> {
  const blob = await buildBlob(params);
  return URL.createObjectURL(blob);
}

export async function openInterventionPdf(params: InterventionRendererParams): Promise<void> {
  const blob = await buildBlob(params);
  window.open(URL.createObjectURL(blob), '_blank');
}

export async function downloadInterventionPdf(params: InterventionRendererParams): Promise<void> {
  const blob = await buildBlob(params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${params.intervention.ref || 'intervention'}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function interventionPdfToBase64(params: InterventionRendererParams): Promise<string> {
  const blob = await buildBlob(params);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
