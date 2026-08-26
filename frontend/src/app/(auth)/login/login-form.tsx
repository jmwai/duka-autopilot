"use client";

import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.status === 429) {
        setError("Too many attempts. Wait a minute, then try again.");
        return;
      }
      if (!response.ok) {
        setError("That password did not open the control room.");
        return;
      }
      const requested = searchParams.get("next") ?? "/";
      const destination = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
      router.replace(destination);
      router.refresh();
    } catch {
      setError("The control room is temporarily unavailable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-5">
      <div>
        <label htmlFor="password" className="text-sm font-semibold">Owner password</label>
        <div className="relative mt-2">
          <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={500}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
            className="h-12 w-full rounded-lg border bg-background pl-10 pr-12 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            placeholder="Enter the judging password"
          />
          <button
            type="button"
            onClick={() => setShow((value) => !value)}
            className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
          </button>
        </div>
        {error ? <p id="login-error" role="alert" className="mt-2 text-sm font-medium text-destructive">{error}</p> : null}
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending || !password}>
        {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
        {pending ? "Opening control room…" : "Open morning brief"}
      </Button>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        The password is exchanged for an HttpOnly owner session. It is never stored in browser JavaScript.
      </p>
    </form>
  );
}
