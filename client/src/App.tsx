import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";

const Admin = lazy(() => import("./pages/Admin"));
const AuthorDetail = lazy(() => import("./pages/AuthorDetail"));
const AuthorCompare = lazy(() => import("./pages/AuthorCompare"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const BookDetail = lazy(() => import("./pages/BookDetail"));
const AuthorChatbot = lazy(() => import("./pages/AuthorChatbot"));
const InterestHeatmap = lazy(() => import("./pages/InterestHeatmap"));
const GroupContrast = lazy(() => import("./pages/GroupContrast"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));

const PageLoader = () => (
  <div className="flex items-center justify-center h-screen text-muted-foreground">
    <div className="flex flex-col items-center gap-3">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-sm">Loading…</span>
    </div>
  </div>
);

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/author/:slug"}>
        <Suspense fallback={<PageLoader />}>
          <AuthorDetail />
        </Suspense>
      </Route>
      <Route path={"/compare"}>
        <Suspense fallback={<PageLoader />}>
          <AuthorCompare />
        </Suspense>
      </Route>
      <Route path={"/leaderboard"}>
        <Suspense fallback={<PageLoader />}>
          <Leaderboard />
        </Suspense>
      </Route>
      <Route path={"/book/:slug"}>
        <Suspense fallback={<PageLoader />}>
          <BookDetail />
        </Suspense>
      </Route>
      <Route path={"/chat/:slug"}>
        <Suspense fallback={<PageLoader />}>
          <AuthorChatbot />
        </Suspense>
      </Route>
      <Route path={"/interests/heatmap"}>
        <Suspense fallback={<PageLoader />}>
          <InterestHeatmap />
        </Suspense>
      </Route>
      <Route path={"/interests/contrast"}>
        <Suspense fallback={<PageLoader />}>
          <GroupContrast />
        </Suspense>
      </Route>
      <Route path={"/privacy"}>
        <Suspense fallback={<PageLoader />}>
          <PrivacyPolicy />
        </Suspense>
      </Route>
      <Route path={"/admin"}>
        <Suspense fallback={<PageLoader />}>
          <Admin />
        </Suspense>
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
