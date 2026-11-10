// @vitest-environment-options {"url":"https://caesar.ent.northwestern.edu/"}

import { afterEach, expect, it, vi } from "vitest";
import { fetchPeopleSoftGet, fetchPeopleSoftGetResult, fetchPeopleSoftResult } from "../peoplesoft/http";
import { APPOINTMENTS_URL, loadEnrollmentDates } from "./appointment-dates";
import { googleCalendarUrl } from "./appointments";

vi.mock("../peoplesoft/http", () => ({
  fetchPeopleSoftGet: vi.fn(),
  fetchPeopleSoftGetResult: vi.fn(),
  fetchPeopleSoftResult: vi.fn()
}));

const datesMarkup = `<div id="win0divNW_DERIVED_SS3_HTMLAREA">
  <h3>General Winter Registration Dates</h3>
  <ul><li>Pre-Registration opens November 9.</li><li>Regular Registration opens November 16.</li></ul>
</div>`;
const appointmentMarkup = `<table id="STDNT_ENRL_A_VW$scroll$0"><tr>
  <td><table><tr>
    <td><span id="NW_DERIVED_SS_DESCR50$0">Regular Registration</span></td>
    <td><span id="ENRL_START$0">November 16, 2026<br>12:00PM</span></td>
    <td><span id="ENRL_END$0">January 3, 2027<br>12:59PM</span></td>
  </tr></table></td>
</tr></table>`;
const termPicker = `<form name="win0" id="SSR_SSENRL_APPT">
  <input type="hidden" name="ICSID" value="fixture-state">
  <div id="SSR_DUMMY_RECV1$scroll$0">
    <input type="radio" id="SSR_DUMMY_RECV1$sels$0$$0" name="SSR_DUMMY_RECV1$sels$0$$0" value="0" checked>
    <span id="TERM_CAR$0">2026 Fall</span>
    <input type="radio" id="SSR_DUMMY_RECV1$sels$1$$0" name="SSR_DUMMY_RECV1$sels$1$$0" value="0">
    <span id="TERM_CAR$1">2027 Winter</span>
  </div>
  <input type="button" id="DERIVED_SSS_SCT_SSR_PB_GO" value="Continue">
</form>`;

afterEach(() => {
  document.body.replaceChildren();
  vi.resetAllMocks();
});

it.each([undefined, "2027 Winter"])("previews the selected term (requested: %s)", async (requestedTerm) => {
  if (!requestedTerm) {
    document.body.innerHTML = '<span id="DERIVED_REGFRM1_SSR_STDNTKEY_DESCR$11$">2027 Winter | Undergraduate</span>';
  }
  vi.mocked(fetchPeopleSoftGetResult).mockResolvedValue({
    status: 200,
    finalUrl: APPOINTMENTS_URL,
    text: termPicker
  });
  vi.mocked(fetchPeopleSoftResult).mockResolvedValue({
    status: 200,
    finalUrl: APPOINTMENTS_URL,
    text: `<PAGE>
      <FIELD id="win0divPSPAGECONTAINER"><![CDATA[${datesMarkup}]]></FIELD>
      <FIELD id="win0divSTDNT_ENRL_A_VW$0"><![CDATA[${appointmentMarkup}]]></FIELD>
    </PAGE>`
  });

  await expect(loadEnrollmentDates(document, requestedTerm)).resolves.toEqual({
    heading: "General Winter Registration Dates",
    windows: ["Pre-Registration opens November 9.", "Regular Registration opens November 16."],
    appointments: [{
      label: "Regular Registration",
      startsAt: Date.parse("2026-11-16T18:00:00Z"),
      endsAt: Date.parse("2027-01-03T18:59:00Z")
    }]
  });
  const params = vi.mocked(fetchPeopleSoftResult).mock.calls[0]![1];
  expect(params.get("ICAction")).toBe("DERIVED_SSS_SCT_SSR_PB_GO");
  expect(params.has("SSR_DUMMY_RECV1$sels$0$$0")).toBe(false);
  expect(params.get("SSR_DUMMY_RECV1$sels$1$$0")).toBe("0");
});

it("does not substitute CAESAR's default quarter for an unavailable Paper.nu quarter", async () => {
  vi.mocked(fetchPeopleSoftGetResult).mockResolvedValue({
    status: 200,
    finalUrl: APPOINTMENTS_URL,
    text: termPicker
  });

  await expect(loadEnrollmentDates(document, "2027 Spring")).resolves.toBeNull();
  expect(fetchPeopleSoftResult).not.toHaveBeenCalled();
});

it("reuses visible dates from the full page without a network request", async () => {
  document.body.innerHTML = datesMarkup;
  await expect(loadEnrollmentDates(document)).resolves.toMatchObject({
    heading: "General Winter Registration Dates"
  });
  expect(fetchPeopleSoftGetResult).not.toHaveBeenCalled();
});

it("opens a Google Calendar draft at the assigned time during Central daylight time", async () => {
  document.body.innerHTML = appointmentMarkup.replace("November 16, 2026", "September 16, 2026");
  const dates = await loadEnrollmentDates(document);
  const appointment = dates?.appointments[0];
  expect(appointment).toBeDefined();

  const url = new URL(googleCalendarUrl(appointment!));
  expect(url.origin).toBe("https://calendar.google.com");
  expect(url.searchParams.get("action")).toBe("TEMPLATE");
  expect(url.searchParams.get("dates")).toBe("20260916T170000Z/20260916T171500Z");
  expect(url.searchParams.get("stz")).toBe("America/Chicago");
});

it("retries the appointment request after refreshing an expired CAESAR session", async () => {
  vi.mocked(fetchPeopleSoftGet).mockResolvedValue("");
  vi.mocked(fetchPeopleSoftGetResult)
    .mockResolvedValueOnce({
      status: 200, finalUrl: "https://prd-nusso.it.northwestern.edu/", text: ""
    })
    .mockResolvedValueOnce({
      status: 200, finalUrl: APPOINTMENTS_URL, text: datesMarkup + appointmentMarkup
    });

  const result = await loadEnrollmentDates(document);
  expect(result?.appointments).toHaveLength(1);
  expect(fetchPeopleSoftGet).toHaveBeenCalledOnce();
  expect(fetchPeopleSoftGetResult).toHaveBeenCalledTimes(2);
});
