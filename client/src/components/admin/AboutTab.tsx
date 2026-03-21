/**
 * AboutTab - App info tab for the Admin Console.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AUTHORS } from "@/lib/libraryData";
import { AUDIO_BOOKS } from "@/lib/audioData";
import { BOOKS } from "@/lib/libraryData";
import { type AppSettings } from "@/contexts/AppSettingsContext";

interface AboutTabProps {
  settings: AppSettings;
}

export function AboutTab({ settings }: AboutTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">NCG Library</CardTitle>
        <CardDescription className="text-xs">Ricardo Cidale's Books and Authors Library</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{AUTHORS.length}</p>
            <p className="text-[10px] text-muted-foreground">Authors</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{BOOKS.length}</p>
            <p className="text-[10px] text-muted-foreground">Books</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">{AUDIO_BOOKS.length}</p>
            <p className="text-[10px] text-muted-foreground">Audiobooks</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold">9</p>
            <p className="text-[10px] text-muted-foreground">Categories</p>
          </div>
        </div>
        <div className="pt-3 border-t border-border/50 space-y-1.5">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Theme:</span> {settings.theme} ({settings.colorMode})
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">AI Model:</span> {settings.geminiModel}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">View Mode:</span> {settings.viewMode}
          </p>
        </div>
        <div className="pt-3 border-t border-border/50">
          <a
            href="https://norfolkai.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img
              src={
                settings.colorMode === "dark"
                  ? "https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/norfolk-ai-logo-white_d92c1722.png"
                  : "https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/norfolk-ai-logo-blue_9ed63fc7.png"
              }
              alt="Norfolk AI"
              className="w-5 h-5 object-contain"
            />
            <span className="text-xs text-muted-foreground">Powered by Norfolk AI</span>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
