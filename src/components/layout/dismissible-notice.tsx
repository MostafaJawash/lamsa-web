"use client";

import { useState } from "react";

export function DismissibleNotice({
  text,
  dismissLabel,
}: {
  text: string;
  dismissLabel: string;
}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="lm-devnote" role="status">
      <span>{text}</span>
      <button type="button" onClick={() => setOpen(false)}>
        {dismissLabel}
      </button>
    </div>
  );
}
