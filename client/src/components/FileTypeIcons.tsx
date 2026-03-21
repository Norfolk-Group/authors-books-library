/**
 * FileTypeIcons - renders a row of file-type icons for a given list of extensions
 * Uses react-file-icon for rich, recognizable file type visuals
 */

import { FileIcon, defaultStyles, type DefaultExtensionType } from "react-file-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Map extensions to human-readable labels
const FILE_LABELS: Record<string, string> = {
  PDF: "PDF Document",
  DOCX: "Word Document",
  DOC: "Word Document",
  MP3: "MP3 Audio",
  M4B: "M4B Audiobook",
  AAX: "Audible Audiobook",
  MP4: "MP4 Video",
  XLSX: "Excel Spreadsheet",
  TXT: "Text File",
  JPG: "JPEG Image",
  JPEG: "JPEG Image",
  PNG: "PNG Image",
  ZIP: "ZIP Archive",
  WAV: "WAV Audio",
  M4A: "M4A Audio",
  PPTX: "PowerPoint",
  GDOC: "Google Doc",
  GSHEET: "Google Sheet",
};

// Extensions to skip (temp/incomplete files)
const SKIP_TYPES = new Set(["CRDOWNLOAD", "TMP$$", "AUP3", "CDLX", "CONF"]);

// Map to valid react-file-icon extension types
const EXT_MAP: Record<string, DefaultExtensionType> = {
  PDF: "pdf",
  DOCX: "docx",
  DOC: "doc",
  MP3: "mp3",
  M4B: "m4a",
  AAX: "aac",
  MP4: "mp4",
  XLSX: "xlsx",
  TXT: "txt",
  JPG: "jpg",
  JPEG: "jpg",
  PNG: "png",
  ZIP: "zip",
  WAV: "wav",
  M4A: "m4a",
  PPTX: "pptx",
  GDOC: "gdoc",
  GSHEET: "gsheet",
};

interface FileTypeIconsProps {
  fileTypes: string[];
  size?: number;
  maxShow?: number;
}

export function FileTypeIcons({ fileTypes, size = 24, maxShow = 8 }: FileTypeIconsProps) {
  const filtered = fileTypes.filter((t) => !SKIP_TYPES.has(t));
  if (filtered.length === 0) return null;

  const shown = filtered.slice(0, maxShow);
  const remaining = filtered.length - shown.length;

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-2 border-t border-border/50">
      {shown.map((ext) => {
        const mappedExt = EXT_MAP[ext] ?? "txt";
        const label = FILE_LABELS[ext] ?? ext;
        const style = defaultStyles[mappedExt as DefaultExtensionType] ?? {};

        return (
          <Tooltip key={ext}>
            <TooltipTrigger asChild>
              <div
                className="flex-shrink-0 cursor-default"
                style={{ width: size, height: size }}
              >
                <FileIcon
                  extension={mappedExt}
                  {...style}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {label}
            </TooltipContent>
          </Tooltip>
        );
      })}
      {remaining > 0 && (
        <span className="text-[10px] text-muted-foreground font-medium">
          +{remaining}
        </span>
      )}
    </div>
  );
}
