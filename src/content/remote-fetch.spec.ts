import { beforeEach, describe, expect, it, vi } from "vitest";

import { CAESAR_ORIGIN, CAESAR_SERVICE_URL, BLUERA_ORIGIN } from "../shared/nu-hosts";
import { CaesarConnectionError } from "./peoplesoft/connection";
import { fetchTextResultViaBackground } from "./remote-fetch";

const sendMessage = vi.fn();

beforeEach(() => {
  sendMessage.mockReset();
  vi.stubGlobal("chrome", { runtime: { sendMessage } });
});

describe("CAESAR background window", () => {
  it("keeps background requests out of the window the user is browsing in", async () => {
    sendMessage.mockResolvedValue({
      ok: true,
      status: 200,
      text: "<form name='win37'><div id='win37divPAGECONTAINER'>submitAction_win37(document.win37,'X')</div></form>",
      finalUrl: `${CAESAR_ORIGIN}/psc/csnu_37/EMPLOYEE/SA/c/X.GBL`
    });

    const response = await fetchTextResultViaBackground(
      `${CAESAR_ORIGIN}/psc/csnu/EMPLOYEE/SA/c/X.GBL?Page=Y`
    );

    expect(sendMessage.mock.calls[0][0].url).toBe(
      `${CAESAR_ORIGIN}/psc/csnu_37/EMPLOYEE/SA/c/X.GBL?Page=Y`
    );
    expect(response.text).toBe(
      "<form name='win0'><div id='win0divPAGECONTAINER'>submitAction_win0(document.win0,'X')</div></form>"
    );
  });

  it("leaves other windows and other hosts alone", async () => {
    sendMessage.mockResolvedValue({ ok: true, status: 200, text: "win37", finalUrl: BLUERA_ORIGIN });

    await fetchTextResultViaBackground(`${CAESAR_ORIGIN}/psc/csnu_5/EMPLOYEE/SA/c/X.GBL`);
    expect(sendMessage.mock.calls[0][0].url).toBe(`${CAESAR_ORIGIN}/psc/csnu_5/EMPLOYEE/SA/c/X.GBL`);
    await expect(fetchTextResultViaBackground(BLUERA_ORIGIN)).resolves.toMatchObject({ text: "win37" });
  });
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
