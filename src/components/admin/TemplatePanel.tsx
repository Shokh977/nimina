'use client';

import TemplateMetadataPanel from './TemplateMetadataPanel';
import TemplatePreviewRegenerator from './TemplatePreviewRegenerator';
import TemplateVersionHistory from './TemplateVersionHistory';

/** The "Template" tab inside EditorShell's template-editing mode —
 * metadata/slot editing, preview regeneration, and version history, all
 * scoped to one templateId. Kept separate from the Slides/Look/Motion tabs
 * (which edit the live Project via the normal Zustand store) since these
 * three are about the template row itself, not the canvas content. */
export default function TemplatePanel({ templateId, sampleAssetsSourceId }: { templateId: string; sampleAssetsSourceId: string | null }) {
 return (
 <div className="grid gap-6">
 <TemplateMetadataPanel templateId={templateId} />
 <div className="border-t border-white/[.12] pt-4 ">
 <TemplatePreviewRegenerator templateId={templateId} sampleAssetsSourceId={sampleAssetsSourceId} />
 </div>
 <div className="border-t border-white/[.12] pt-4 ">
 <p className="mb-2 text-[12.5px] font-bold text-[#767e8d] ">Version history</p>
 <TemplateVersionHistory templateId={templateId} />
 </div>
 </div>
 );
}
