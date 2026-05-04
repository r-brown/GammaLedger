import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, Send, ShieldCheck, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { api } from "@/shared/api/client";
import type { AIMessage } from "@/shared/api/types";
import { useFeatureFlag } from "@/shared/hooks/useFeatureFlag";
import { PageHeader } from "@/shared/layout/AppShell";
import { ErrorState, Loading } from "@/shared/ui/State";

const quickPrompts = [
  "Give me a portfolio health check.",
  "Run a risk audit and focus on concentration.",
  "Which open positions need attention first?",
];

export function AIAssistantPage(): JSX.Element {
  const features = useQuery({ queryKey: ["ai-features"], queryFn: api.aiFeatures });
  const entitlement = useFeatureFlag("ai_assistant");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AIMessage[]>([
    { role: "assistant", content: "Ask for portfolio health, risk checks, or trade follow-up. Local mode uses a deterministic offline analyst unless Gemini is explicitly enabled server-side." },
  ]);
  const chat = useMutation({
    mutationFn: ({ message, history }: { message: string; history: AIMessage[] }) => api.aiChat(message, history),
    onSuccess: (response) => {
      setMessages((current) => [...current, { role: "assistant", content: response.data.message }]);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || !entitlement.enabled) return;
    const history = messages.slice(-8);
    setMessages((current) => [...current, { role: "user", content: message }]);
    setInput("");
    chat.mutate({ message, history });
  }

  function ask(prompt: string) {
    if (!entitlement.enabled) return;
    const history = messages.slice(-8);
    setMessages((current) => [...current, { role: "user", content: prompt }]);
    chat.mutate({ message: prompt, history });
  }

  return (
    <>
      <PageHeader title="AI Assistant" subtitle="Gemini-compatible portfolio coach with local-mode privacy fallback and server-side feature flags." />
      <section className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="rounded border border-border bg-surface">
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-2 font-semibold">
              <Bot className="h-5 w-5 text-primary" />
              Assistant Chat
            </div>
          </div>
          <div className="max-h-[62vh] space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={message.role === "user" ? "ml-auto max-w-[88%] rounded bg-primary p-3 text-sm text-primary-foreground" : "max-w-[88%] whitespace-pre-line rounded border border-border bg-background p-3 text-sm"}>
                {message.content}
              </div>
            ))}
            {chat.isPending ? <Loading label="Analyzing..." /> : null}
            {chat.error ? <ErrorState error={chat.error} /> : null}
          </div>
          <form className="flex gap-2 border-t border-border p-4" onSubmit={submit}>
            <input className="min-h-11 flex-1 rounded border border-border bg-background px-3 text-sm" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about portfolio risk..." disabled={!entitlement.enabled} />
            <button className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={!entitlement.enabled}>
              <Send className="h-4 w-4" />
              Send
            </button>
          </form>
        </div>

        <aside className="space-y-5">
          <div className="rounded border border-border bg-surface p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4 text-primary" />
              AI Feature Flags
            </h2>
            {features.isLoading ? <Loading /> : null}
            {features.error ? <ErrorState error={features.error} /> : null}
            {features.data ? (
              <div className="space-y-2 text-sm">
                <Flag label="External Gemini calls" enabled={features.data.data.externalCallsEnabled} />
                <Flag label="Server Gemini key" enabled={features.data.data.geminiConfigured} />
                <Flag label="AI entitlement" enabled={entitlement.enabled} />
              </div>
            ) : null}
          </div>
          <div className="rounded border border-border bg-surface p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Quick Prompts
            </h2>
            <div className="space-y-2">
              {quickPrompts.map((prompt) => (
                <button key={prompt} className="w-full rounded border border-border p-3 text-left text-sm hover:bg-background disabled:opacity-50" onClick={() => ask(prompt)} disabled={!entitlement.enabled}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}

function Flag({ label, enabled }: { label: string; enabled: boolean }): JSX.Element {
  return (
    <div className="flex items-center justify-between rounded border border-border p-3">
      <span>{label}</span>
      <span className={enabled ? "text-success" : "text-text-secondary"}>{enabled ? "Enabled" : "Off"}</span>
    </div>
  );
}
