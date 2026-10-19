"use client";

import { useEffect, useRef, useState } from "react";
import { registerAccessCodePrompt } from "@/lib/api";

type Pending = { rejected: boolean; resolve: (code: string | null) => void };

// Shown only when the API answers 401 UNAUTHORIZED. One field; the code is kept in
// sessionStorage by lib/api.ts and sent as x-access-code from then on.
export default function AccessCodeGate() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    registerAccessCodePrompt(
      (rejected) =>
        new Promise<string | null>((resolve) => {
          setValue("");
          setPending({ rejected, resolve });
        }),
    );
    return () => registerAccessCodePrompt(null);
  }, []);

  useEffect(() => {
    if (pending) inputRef.current?.focus();
  }, [pending]);

  if (!pending) return null;

  const finish = (code: string | null) => {
    pending.resolve(code);
    setPending(null);
    setValue("");
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onKeyDown={(event) => {
        if (event.key === "Escape") finish(null);
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-code-heading"
        className="card w-full max-w-md space-y-4 bg-white p-6"
        onSubmit={(event) => {
          event.preventDefault();
          const code = value.trim();
          if (code) finish(code);
        }}
      >
        <h2 id="access-code-heading" className="heading-4 text-espresso-100">
          Access code required
        </h2>
        <p className="body-sm text-espresso-500">
          {pending.rejected
            ? "That access code was not accepted. Please try again."
            : "Enter the access code to continue."}
        </p>
        <div>
          <label className="label" htmlFor="access-code-input">
            Access code
          </label>
          <input
            id="access-code-input"
            ref={inputRef}
            className="input"
            type="password"
            autoComplete="off"
            maxLength={200}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <button className="btn btn--secondary btn--sm" type="button" onClick={() => finish(null)}>
            Cancel
          </button>
          <button className="btn btn--primary btn--sm" type="submit" disabled={!value.trim()}>
            Continue
          </button>
        </div>
      </form>
    </div>
  );
}
