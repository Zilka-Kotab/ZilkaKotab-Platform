import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function MatchedApplicantNames({ names }: { names: string[] }) {
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const restoreFocus = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelClose = () => clearTimeout(closeTimer.current);
  const closeAfterHover = () => {
    cancelClose();
    if (!pinned.current) closeTimer.current = setTimeout(() => setOpen(false), 180);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  return (
    <Popover open={open} onOpenChange={(next) => {
      cancelClose();
      if (!next) pinned.current = false;
      setOpen(next);
    }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="button-matched-applicant-names"
          onPointerEnter={(event) => {
            if (event.pointerType !== 'mouse') return;
            cancelClose();
            if (!pinned.current) restoreFocus.current = false;
            setOpen(true);
          }}
          onPointerLeave={closeAfterHover}
          onClick={(event) => {
            // Clicking pins a hover-opened list; a second click closes it.
            event.preventDefault();
            cancelClose();
            pinned.current = !pinned.current;
            restoreFocus.current = pinned.current;
            setOpen(pinned.current);
          }}
        >
          Matched applicant names ({names.length.toLocaleString()})
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-96 max-w-[calc(100vw-2rem)] p-3"
        aria-label="Matched applicant names"
        onPointerEnter={cancelClose}
        onPointerLeave={closeAfterHover}
        onOpenAutoFocus={(event) => {
          if (!pinned.current) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          if (!restoreFocus.current) event.preventDefault();
        }}
      >
        <div className="mb-2 text-sm font-semibold">Matched applicant names</div>
        <ul
          className="max-h-64 space-y-1 overflow-y-auto overscroll-contain pr-2 text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={0}
          aria-label="All matched applicant names"
          data-testid="list-matched-applicant-names"
        >
          {names.map((name, index) => (
            <li key={`${name}-${index}`} className="break-words" data-testid={`text-applicant-${index}`}>{name}</li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
