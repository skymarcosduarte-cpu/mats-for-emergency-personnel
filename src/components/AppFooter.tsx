import { forwardRef, memo } from 'react';
import { APP_VERSION } from "@/lib/versionCheck";

export const AppFooter = memo(forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>((props, ref) => {
  return (
    <footer ref={ref} className="py-3 px-4 border-t border-border bg-muted/20" {...props}>
      <div className="flex flex-col items-center gap-1.5 text-center max-w-sm mx-auto">
        {/* M.A.T.S. meaning */}
        <p className="text-[10px] text-muted-foreground font-medium">
          M.A.T.S. = Mutual Aid Tracking System
        </p>
        {/* Powered by */}
        <p className="text-[10px] text-muted-foreground">
          <a href="/info" className="text-primary hover:underline">
            v{APP_VERSION}
          </a>{" "}
          · Powered by{" "}
          <a
            href="https://marcosduarte.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            marcosduarte.com
          </a>
        </p>
      </div>
    </footer>
  );
}));

AppFooter.displayName = 'AppFooter';
