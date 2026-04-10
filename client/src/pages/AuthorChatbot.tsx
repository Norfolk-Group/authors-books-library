/**
 * AuthorChatbot.tsx
 *
 * Full-screen author impersonation chatbot.
 * The author speaks as themselves, grounded in their Digital Me RAG file.
 *
 * Route: /chat/:slug
 * - slug is the URL-encoded author name
 *
 * Features:
 *   - Author avatar + name in header with "Speaking as {Author}" badge
 *   - Multi-turn conversation with message history
 *   - Opening message from the author on first load
 *   - Reset conversation button
 *   - Disclaimer banner
 *   - Keyboard: Enter to send, Shift+Enter for newline
 *   - Escape key returns to previous page
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { LazyImage } from "@/components/ui/LazyImage";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Send,
  RefreshCw,
  Loader2,
  Brain,
  AlertCircle,
  User,
  MessageSquare,
  Info,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function MessageBubble({ message, authorName, avatarUrl }: {
  message: Message;
  authorName: string;
  avatarUrl?: string | null;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center">
        {isUser ? (
          <User className="w-4 h-4 text-muted-foreground" />
        ) : avatarUrl ? (
          <LazyImage src={avatarUrl} alt={authorName} className="w-full h-full object-cover" eager />
        ) : (
          <Brain className="w-4 h-4 text-primary" />
        )}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card border border-border rounded-tl-sm"
        }`}>
          {message.content}
        </div>
        <span className="text-xs text-muted-foreground px-1">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

export default function AuthorChatbot() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const authorName = decodeURIComponent(slug ?? "");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOpening, setLoadingOpening] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: authorInfo, isLoading: loadingInfo } = trpc.authorChatbot.getAuthorChatInfo.useQuery(
    { authorName },
    { enabled: !!authorName }
  );

  const openingMutation = trpc.authorChatbot.getOpeningMessage.useMutation();
  const chatMutation = trpc.authorChatbot.chat.useMutation();

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Escape key → go back
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate("/");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate]);

  // Load opening message on mount
  useEffect(() => {
    if (!authorName) return;
    setLoadingOpening(true);
    openingMutation.mutateAsync({ authorName }).then((result) => {
      setMessages([{
        role: "assistant",
        content: result.reply,
        timestamp: new Date(),
      }]);
    }).catch(() => {
      setMessages([{
        role: "assistant",
        content: `Hello, I'm ${authorName}. How can I help you today?`,
        timestamp: new Date(),
      }]);
    }).finally(() => setLoadingOpening(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorName]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMessage: Message = { role: "user", content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const conversationHistory = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const result = await chatMutation.mutateAsync({
        authorName,
        messages: conversationHistory,
      });

      if (result.success && result.reply) {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: result.reply!,
          timestamp: new Date(),
        }]);
      } else {
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: (result as { message?: string }).message ?? "I'm unable to respond right now. Please try again.",
          timestamp: new Date(),
        }]);
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "I encountered an error. Please try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [input, sending, messages, authorName, chatMutation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setLoadingOpening(true);
    openingMutation.mutateAsync({ authorName }).then((result) => {
      setMessages([{ role: "assistant", content: result.reply, timestamp: new Date() }]);
    }).finally(() => setLoadingOpening(false));
  };

  if (loadingInfo) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authorInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Author not found: {authorName}</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Home
        </Button>
      </div>
    );
  }

  const isReady = authorInfo.isReady;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shadow-sm">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 h-8 px-2"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Author identity */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
            {authorInfo.avatarUrl ? (
              <LazyImage src={authorInfo.avatarUrl} alt={authorName} className="w-full h-full object-cover" eager />
            ) : (
              <Brain className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-sm truncate">{authorName}</h1>
              <Badge
                className={`text-xs px-1.5 py-0 ${isReady ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"}`}
              >
                {isReady ? "Digital Me Active" : "RAG Not Ready"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {isReady
                ? `v${authorInfo.ragVersion} · ${authorInfo.ragWordCount?.toLocaleString() ?? 0} words`
                : "Generate Digital Me in Admin Console first"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleReset}
            disabled={loadingOpening || sending}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        </div>
      </div>

      {/* Disclaimer */}
      {isReady && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-800/30 text-xs text-amber-700 dark:text-amber-400">
          <Info className="w-3.5 h-3.5 flex-shrink-0" />
          This is an AI simulation of {authorName} based on their published works and public record. Not the real person.
        </div>
      )}

      {/* Not ready state */}
      {!isReady && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <Brain className="w-12 h-12 text-muted-foreground" />
          <div>
            <h2 className="font-semibold text-lg mb-1">Digital Me Not Ready</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              The Digital Me knowledge file for {authorName} hasn't been generated yet.
              Go to Admin → Digital Me to generate it.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Home
            </Button>
            <Button onClick={() => navigate("/admin")}>
              <Brain className="w-4 h-4 mr-2" />
              Open Admin
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
      {isReady && (
        <>
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          >
            {loadingOpening ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                {authorName} is composing an introduction…
              </div>
            ) : (
              messages.map((msg, idx) => (
                <MessageBubble
                  key={idx}
                  message={msg}
                  authorName={authorName}
                  avatarUrl={authorInfo.avatarUrl}
                />
              ))
            )}

            {sending && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  {authorInfo.avatarUrl ? (
                    <LazyImage src={authorInfo.avatarUrl} alt={authorName} className="w-full h-full object-cover rounded-full" eager />
                  ) : (
                    <Brain className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t bg-card px-4 py-3">
            <div className="flex gap-2 items-end max-w-4xl mx-auto">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask ${authorName} anything…`}
                  className="resize-none min-h-[44px] max-h-[120px] text-sm pr-2 py-2.5"
                  rows={1}
                  disabled={sending || loadingOpening}
                />
              </div>
              <Button
                size="sm"
                className="h-[44px] w-[44px] p-0 flex-shrink-0"
                onClick={handleSend}
                disabled={!input.trim() || sending || loadingOpening}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-1.5">
              <MessageSquare className="w-3 h-3 inline mr-1" />
              Enter to send · Shift+Enter for new line · Esc to go back
            </p>
          </div>
        </>
      )}
    </div>
  );
}
