import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <PageHeader crumbs={[{ label: "404 - Page Not Found" }]} />
      <div className="flex items-center justify-center min-h-[calc(100vh-49px)]">
        <div className="text-center px-6 max-w-md">
          <div className="flex justify-center mb-6">
            <WarningCircleIcon
              weight="duotone"
              size={64}
              className="text-muted-foreground"
            />
          </div>

          <h1 className="text-5xl font-bold font-display text-foreground mb-2">404</h1>

          <h2 className="text-xl font-semibold font-display text-foreground mb-4">
            Page Not Found
          </h2>

          <p className="text-muted-foreground mb-8 leading-relaxed">
            The page you are looking for does not exist.
            It may have been moved or deleted.
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              onClick={() => setLocation("/")}
              className="px-6"
            >
              Return to Library
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
