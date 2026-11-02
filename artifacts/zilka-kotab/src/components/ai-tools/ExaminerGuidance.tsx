import { useState } from "react";
import { Phone, Sparkles, ExternalLink, Copy } from "lucide-react";
import type { PublicExaminerAnalysis } from "@workspace/api-client-react";
import { examinerAiLinks, examinerAiPrompt } from "./examiner-ai-prompt";

export function ExaminerGuidance({ data }: { data: PublicExaminerAnalysis }) {
  const [copyStatus, setCopyStatus] = useState("");
  if (data.searchType !== "examiner") return null;
  const contact = data.examinerContact;
  const prompt = examinerAiPrompt(data);
  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyStatus("Prompt copied. Paste it into your chosen AI tool.");
    } catch {
      setCopyStatus("Copy was blocked. Expand the prompt below and select the text to copy manually.");
    }
  }
  const phoneParts = contact?.phone?.split(" ext. ");
  const phoneHref = phoneParts
    ? `tel:+1${phoneParts[0].replace(/\D/g, "")}${phoneParts[1] ? `;ext=${phoneParts[1]}` : ""}` : "";
  return (
    <div className="mt-5 space-y-4">
      <section className="rounded-sm border bg-white p-4 sm:p-5" data-testid="section-examiner-contact">
        <h4 className="zk-h4">Examiner Contact</h4>
        <div className="mt-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"><Phone className="h-4 w-4" aria-hidden="true" /> USPTO Phone</div>
            {contact?.phone
              ? <a className="mt-1 inline-block font-medium text-primary underline underline-offset-4" href={phoneHref} data-testid="link-examiner-phone">{contact.phone}</a>
              : <p className="mt-1 text-sm text-muted-foreground">Not Available</p>}
          </div>
        </div>
      </section>
      <section className="rounded-sm border border-[hsl(var(--zk-brass))] border-l-4 bg-[hsl(var(--zk-brass)/0.06)] p-4 sm:p-5" data-testid="section-external-ai">
        <h4 className="zk-h4 flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--zk-brass))]" aria-hidden="true" /> Explore Strategy With AI</h4>
        <p className="mt-3 text-sm leading-relaxed">Use this examiner’s metrics in your preferred AI tool. Copy the prepared prompt, then open a tool below.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={copyPrompt} className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Copy className="h-4 w-4" aria-hidden="true" /> Copy metrics &amp; prompt</button>
          {examinerAiLinks(prompt).map(link => <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-sm border bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-muted">{link.name}<ExternalLink className="h-3 w-3" aria-hidden="true" /></a>)}
        </div>
        <p role="status" className="mt-2 text-sm">{copyStatus}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">ChatGPT and Claude links include the public metrics in a prepared prompt; if it does not appear, paste the copied prompt. For Copilot, paste the prompt after opening. These are independent services and may require sign-in. No AI request runs while these results load.</p>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-primary underline underline-offset-4">View prepared prompt</summary>
          <textarea aria-label="Examiner metrics and AI prompt" readOnly value={prompt} rows={8} className="mt-2 w-full rounded-sm border bg-white p-3 text-xs leading-relaxed" onFocus={event => event.currentTarget.select()} />
        </details>
      </section>
    </div>
  );
}
