import type { ReactNode } from "react";

/** Rahmen für Anmeldung und zweiten Faktor */
export function AuthFrame({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-surface px-4 py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span aria-hidden="true" className="brand-mark">
            MR
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.01em]">{title}</h1>
            <p className="text-sm text-muted">{lead}</p>
          </div>
        </div>
        <div className="card p-6 shadow-soft sm:p-8">{children}</div>
      </div>
    </main>
  );
}
