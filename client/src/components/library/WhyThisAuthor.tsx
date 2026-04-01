/**
 * WhyThisAuthor
 *
 * A button that generates a 3-sentence LLM explanation of why this author
 * is relevant to the user's current interests. Uses Claude Opus via the
 * userInterests.whyThisAuthor tRPC procedure.
 *
 * Usage: <WhyThisAuthor authorName="Adam Grant" />
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { HelpCircle, Loader2, Sparkles } from "lucide-react";

interface WhyThisAuthorProps {
  authorName: string;
}

export function WhyThisAuthor({ authorName }: WhyThisAuthorProps) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  const whyMutation = trpc.userInterests.whyThisAuthor.useMutation({
    onSuccess: (data) => {
      setExplanation(data.explanation);
    },
  });

  if (!isAuthenticated) return null;

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !explanation && !whyMutation.isPending) {
      whyMutation.mutate({ authorName });
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          onClick={(e) => e.stopPropagation()}
          title="Why is this author relevant to my interests?"
        >
          <HelpCircle className="w-3 h-3" />
          Why this author?
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3"
        side="bottom"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <p className="text-xs font-semibold text-foreground">Why {authorName.split(" ")[0]}?</p>
        </div>
        {whyMutation.isPending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Analyzing alignment with your interests...
          </div>
        )}
        {whyMutation.isError && (
          <p className="text-xs text-destructive">
            {whyMutation.error?.message?.includes("no interests")
              ? "Add interests in Admin → My Interests first."
              : "Could not generate explanation. Try again."}
          </p>
        )}
        {explanation && (
          <p className="text-xs text-muted-foreground leading-relaxed">{explanation}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
