import type { Metadata } from "next";
import Link from "next/link";

import { markMessage, removeMessage } from "@/app/admin/actions";
import { ActionButton } from "@/components/admin/forms";
import { AdminShell } from "@/components/admin/shell";
import { Badge, PageHead, formatDateTime } from "@/components/admin/ui";
import { MESSAGE_RETENTION_DAYS } from "@/lib/admin/db";
import { adminPrefix, requireAdmin } from "@/lib/admin/guard";
import { listMessages, type Message } from "@/lib/admin/messages";

export const metadata: Metadata = { title: "Nachrichten" };

const TOPIC: Record<string, string> = {
  project: "Projekt & Zusammenarbeit",
  volleyball: "Volleyball & Verein",
  other: "Etwas anderes",
};

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const admin = await requireAdmin("/nachrichten");
  const prefix = await adminPrefix();
  const { filter } = await searchParams;
  const onlyUnread = filter === "ungelesen";

  let messages: Message[] = [];
  let error: string | null = null;
  try {
    messages = await listMessages();
  } catch {
    error = "Die Datenbank antwortet nicht. Bitte später erneut versuchen.";
  }
  const unread = messages.filter((message) => !message.read).length;
  const shown = onlyUnread ? messages.filter((message) => !message.read) : messages;

  const tab = (active: boolean) =>
    `inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[14.5px] font-medium ${active ? "bg-bg text-fg shadow-soft" : "text-muted hover:text-fg"}`;

  return (
    <AdminShell admin={admin}>
      <PageHead
        title="Nachrichten"
        text={`Alles aus dem Kontaktformular. Nachrichten löschen sich nach ${Math.round(MESSAGE_RETENTION_DAYS / 30)} Monaten von selbst.`}
        action={
          <nav aria-label="Filter" className="inline-flex gap-1 rounded-xl bg-surface-2 p-1">
            <Link href={`${prefix}/nachrichten`} aria-current={!onlyUnread ? "page" : undefined} className={tab(!onlyUnread)}>
              Alle <span className="font-mono text-[12px] text-muted">{messages.length}</span>
            </Link>
            <Link href={`${prefix}/nachrichten?filter=ungelesen`} aria-current={onlyUnread ? "page" : undefined} className={tab(onlyUnread)}>
              Ungelesen <span className="font-mono text-[12px] text-muted">{unread}</span>
            </Link>
          </nav>
        }
      />

      {error ? <p className="rounded-xl bg-loss-soft px-4 py-3 font-medium text-loss">{error}</p> : null}
      {!error && shown.length === 0 ? (
        <div className="card p-10 text-center text-muted">{onlyUnread ? "Alles gelesen." : "Noch keine Nachrichten."}</div>
      ) : null}

      <ul className="grid gap-3">
        {shown.map((message) => {
          const topic = TOPIC[message.topic] ?? message.topic;
          const quote = message.message
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n");
          const reply = `mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent(`Re: Deine Nachricht (${topic})`)}&body=${encodeURIComponent(`Hallo ${message.name},\n\n\n\n${quote}`)}`;
          return (
            <li key={message.id} id={`n-${message.id}`} className="scroll-mt-24">
              <details className="card overflow-hidden" open={!message.read}>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-surface [&::-webkit-details-marker]:hidden">
                  <span aria-label={message.read ? "gelesen" : "ungelesen"} className={`size-2.5 shrink-0 rounded-full ${message.read ? "bg-line" : "bg-accent"}`} />
                  <span className={`min-w-0 flex-1 truncate ${message.read ? "" : "font-semibold"}`}>{message.name}</span>
                  <Badge tone="neutral">{topic}</Badge>
                  <span className="font-mono text-[12px] text-muted">{formatDateTime(message.receivedAt)}</span>
                </summary>
                <div className="border-t border-line px-5 py-5">
                  <dl className="grid gap-x-6 gap-y-1 text-[15px] sm:grid-cols-[auto_1fr]">
                    <dt className="text-muted">E-Mail</dt>
                    <dd>
                      <a href={`mailto:${message.email}`} className="text-accent hover:underline">
                        {message.email}
                      </a>
                    </dd>
                    <dt className="text-muted">Sprache</dt>
                    <dd>{message.locale === "en" ? "Englisch" : "Deutsch"}</dd>
                    <dt className="text-muted">Per Mail</dt>
                    <dd>{message.mailed ? "zugestellt" : "nicht verschickt (nur hier)"}</dd>
                  </dl>
                  <p className="mt-4 rounded-xl bg-surface p-4 text-[15px] leading-relaxed break-words whitespace-pre-wrap">{message.message}</p>
                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <a href={reply} className="btn btn-primary btn-nav">
                      Antworten
                    </a>
                    <ActionButton action={markMessage.bind(null, message.id, !message.read)}>
                      {message.read ? "Als ungelesen markieren" : "Als gelesen markieren"}
                    </ActionButton>
                    <ActionButton action={removeMessage.bind(null, message.id)} confirm={`Nachricht von ${message.name} endgültig löschen?`} variant="danger">
                      Löschen
                    </ActionButton>
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </AdminShell>
  );
}
