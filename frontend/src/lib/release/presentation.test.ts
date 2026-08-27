import { describe, expect, it } from "vitest";

import { compactIdentity, isImmutableReleaseSha, releaseProofState } from "./presentation";

describe("release proof presentation", () => {
  it("requires a complete hexadecimal Git identity", () => {
    expect(isImmutableReleaseSha("0123456789abcdef0123456789abcdef01234567")).toBe(true);
    expect(isImmutableReleaseSha("0123456789ab")).toBe(false);
    expect(isImmutableReleaseSha("local")).toBe(false);
  });

  it("keeps local rehearsal separate from cloud proof", () => {
    expect(releaseProofState("local", "local")).toMatchObject({
      label: "Local rehearsal",
      state: "local",
    });
    expect(releaseProofState("prod", "unknown")).toMatchObject({
      label: "Release pending",
      state: "pending",
    });
  });

  it("compacts only attributable identities", () => {
    expect(compactIdentity("0123456789abcdef0123456789abcdef01234567")).toBe("0123456789ab…");
    expect(compactIdentity("local")).toBe("not proven");
  });
});
