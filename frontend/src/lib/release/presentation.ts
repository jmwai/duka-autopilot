export function isImmutableReleaseSha(value: string | null | undefined) {
  return Boolean(value && /^[0-9a-f]{40}$/u.test(value));
}

export function compactIdentity(value: string | null | undefined, fallback = "not proven") {
  if (!value || ["local", "unknown", "local-build"].includes(value)) return fallback;
  return value.length > 14 ? `${value.slice(0, 12)}…` : value;
}

export function releaseProofState(environment: string, releaseSha: string | null | undefined) {
  if (environment.toLowerCase() === "local") {
    return {
      label: "Local rehearsal",
      state: "local" as const,
      description: "Useful for product review; not Google Cloud execution evidence.",
    };
  }
  if (isImmutableReleaseSha(releaseSha)) {
    return {
      label: "Immutable release",
      state: "proven" as const,
      description: "Runtime identity is present; linked artifacts still prove execution.",
    };
  }
  return {
    label: "Release pending",
    state: "pending" as const,
    description: "This runtime does not expose a full immutable release SHA.",
  };
}
