import { Phone, Sparkles } from "lucide-react";
import type { PublicExaminerAnalysis } from "@workspace/api-client-react";

export function ExaminerGuidance({ data }: { data: PublicExaminerAnalysis }) {
  if (data.searchType !== "examiner") return null;
  const contact = data.examinerContact;
  const strategy = data.recommendedStrategy;
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
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-sm border px-2 py-1 font-medium ${contact?.confidence === "high" ? "border-green-700/30 bg-green-50 text-green-900" : "border-border bg-muted text-muted-foreground"}`} data-testid="text-contact-confidence">
            Contact evidence: {contact?.confidence === "high" ? "High confidence" : contact?.confidence === "moderate" ? "Moderate confidence" : "Not verified"}
          </span>
          <span className="text-muted-foreground">{contact?.verificationMethod === "directory" ? "USPTO employee directory" : "No verified source"}</span>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {contact?.note ?? "Contact information could not be verified."}{" "}
          <a href="https://portal.uspto.gov/EmployeeSearch/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">USPTO Employee Directory</a>
          {contact?.checkedAt && <> · Verified {new Date(contact.checkedAt).toLocaleDateString()}</>}
        </p>
      </section>
      <section className="rounded-sm border border-[hsl(var(--zk-brass))] border-l-4 bg-[hsl(var(--zk-brass)/0.06)] p-4 sm:p-5" data-testid="section-ai-strategy">
        <h4 className="zk-h4 flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--zk-brass))]" aria-hidden="true" /> AI Recommended Strategy — {data.examinerName}</h4>
        {strategy?.status === "ready" && <>
          <p className="mt-3 text-sm leading-relaxed" data-testid="text-ai-strategy">{strategy.summary}</p>
          <p className="mt-3 text-sm font-medium leading-relaxed" data-testid="text-ai-approach"><span className="font-semibold">Recommended approach:</span> {strategy.approach}</p>
        </>}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{strategy?.note ?? "The AI recommendation is unavailable for this result. Review the source statistics below."}</p>
      </section>
    </div>
  );
}
