import { beforeEach, describe, expect, it, vi } from "vitest";

import { CAESAR_ORIGIN, CAESAR_SERVICE_URL, BLUERA_ORIGIN } from "../shared/nu-hosts";
import { CaesarConnectionError } from "./peoplesoft/connection";
import { fetchTextResultViaBackground } from "./remote-fetch";

const sendMessage = vi.fn();

beforeEach(() => {
  sendMessage.mockReset();
  vi.stubGlobal("chrome", { runtime: { sendMessage } });
});

describe("CAESAR connection failures", () => {
  it("recognizes Northwestern's access-page redirect as a connection failure", async () => {
    sendMessage.mockResolvedValue({
      ok: true,
      status: 200,
      text: "CAESAR service information",
      finalUrl: `${CAESAR_SERVICE_URL}?source=test`
    });

    await expect(fetchTextResultViaBackground(CAESAR_ORIGIN)).rejects.toBeInstanceOf(
      CaesarConnectionError
    );
  });

  it("surfaces a CAESAR transport failure with VPN guidance", async () => {
    sendMessage.mockResolvedValue({
      ok: false,
      error: "Failed to fetch",
      connectionFailed: true
    });

    await expect(fetchTextResultViaBackground(CAESAR_ORIGIN)).rejects.toBeInstanceOf(
      CaesarConnectionError
    );
    await expect(fetchTextResultViaBackground(BLUERA_ORIGIN)).rejects.toThrow("Failed to fetch");
  });

  it("preserves a CAESAR authentication response for the sign-in flow", async () => {
    const response = { ok: true, status: 401, text: "", finalUrl: CAESAR_ORIGIN };
    sendMessage.mockResolvedValue(response);

    await expect(fetchTextResultViaBackground(CAESAR_ORIGIN)).resolves.toEqual(response);
  });

  it("keeps other background errors separate", async () => {
    sendMessage.mockResolvedValue({ ok: false, error: "Circuit breaker tripped." });

    await expect(fetchTextResultViaBackground(CAESAR_ORIGIN)).rejects.toThrow(
      "Circuit breaker tripped."
    );
  });
});
