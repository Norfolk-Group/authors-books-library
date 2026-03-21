/**
 * AudioCard -- individual audiobook card for the Books Audio tab.
 * Extracted from Home.tsx for file size management.
 */

import { motion } from "framer-motion";
import { Headphones, ExternalLink } from "lucide-react";
import { type AudioBook } from "@/lib/audioData";
import { FORMAT_CLASSES, FORMAT_LABEL } from "./libraryConstants";

interface AudioCardProps {
  audio: AudioBook;
  query: string;
}

export function AudioCard({ audio, query }: AudioCardProps) {
  const driveUrl = `https://drive.google.com/drive/folders/${audio.id}?view=grid`;

  const highlight = (text: string) => {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const totalFiles = Object.values(audio.formats).reduce((sum, f) => sum + f.fileCount, 0);

  return (
    <motion.div
      className="card-animate group relative"
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
    >
      <a
        href={driveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-border shadow-sm overflow-hidden block cursor-pointer relative bg-card border-l-[3px] border-l-primary h-full"
      >
        {/* Watermark */}
        <div className="pointer-events-none absolute bottom-2 right-2 select-none watermark-icon" aria-hidden>
          <Headphones className="w-[72px] h-[72px] text-primary opacity-[0.07]" strokeWidth={1} />
        </div>

        <div className="p-4 relative z-10">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 bg-primary/10">
                <Headphones className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                Audiobook
              </span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity text-muted-foreground" />
          </div>

          <h3 className="text-sm font-semibold leading-snug mb-1 tracking-tight">
            {highlight(audio.title)}
          </h3>
          {audio.bookAuthors && (
            <p className="text-xs text-muted-foreground leading-relaxed mb-2">
              <span className="font-medium">by</span> {highlight(audio.bookAuthors)}
            </p>
          )}

          {/* Format badges with file counts */}
          <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/50">
            {Object.entries(audio.formats).map(([fmt, info]) => {
              const cls = FORMAT_CLASSES[fmt] ?? "bg-muted text-muted-foreground";
              const label = FORMAT_LABEL[fmt] ?? fmt;
              return (
                <a
                  key={fmt}
                  href={`https://drive.google.com/drive/folders/${info.folderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold hover:opacity-80 transition-opacity ${cls}`}
                  title={`Open ${fmt} folder in Drive`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {label}
                  <span className="opacity-70">·{info.fileCount}</span>
                </a>
              );
            })}
            <span className="text-[10px] text-muted-foreground ml-auto self-center">
              {totalFiles} file{totalFiles !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </a>
    </motion.div>
  );
}
