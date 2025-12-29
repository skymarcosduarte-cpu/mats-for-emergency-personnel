import { APP_VERSION } from "@/lib/versionCheck";

export function AppFooter() {
  return (
    <footer className="py-3 px-4 border-t border-border bg-muted/20">
      <div className="flex flex-col items-center gap-2 text-center max-w-sm mx-auto">
        {/* Powered by */}
        <p className="text-[10px] text-muted-foreground">
          v{APP_VERSION} · Powered by{" "}
          <a
            href="https://latamgrowthoperators.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Latam Growth Operators
          </a>
        </p>
      </div>
    </footer>
  );
}
