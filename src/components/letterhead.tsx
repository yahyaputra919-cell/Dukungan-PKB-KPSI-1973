import type { ReactNode } from "react";
import { COMPANY, ORG_SHORT } from "@/lib/dukungan/types";

export function Letterhead({ action }: { action?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="seal" aria-hidden="true">
          1973
        </span>
        <div>
          <p className="text-sm font-semibold tracking-wide text-primary">{ORG_SHORT}</p>
          <p className="text-sm text-muted">{COMPANY}</p>
        </div>
      </div>
      {action}
    </header>
  );
}
