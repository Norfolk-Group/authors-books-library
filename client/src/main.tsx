import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, splitLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

// Use splitLink to handle large query inputs:
// - Mutations always use POST (body)
// - Queries use GET by default but fall back to POST when the URL would exceed
//   8 KB (prevents HTTP 414 URI Too Large for large array inputs like book titles)
const batchLinkOptions = {
  url: "/api/trpc",
  transformer: superjson,
  maxURLLength: 8192,
  fetch(input: RequestInfo | URL, init?: RequestInit) {
    return globalThis.fetch(input, {
      ...(init ?? {}),
      credentials: "include",
    });
  },
};

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      // Mutations always go POST; queries use GET (with 8 KB URL cap)
      condition: (op) => op.type === "subscription",
      true: httpBatchLink(batchLinkOptions),
      false: httpBatchLink(batchLinkOptions),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <AppSettingsProvider>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </AppSettingsProvider>
);
