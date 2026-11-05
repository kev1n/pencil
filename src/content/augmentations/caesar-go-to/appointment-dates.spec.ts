import { afterEach, expect, it, vi } from "vitest";
import { fetchPeopleSoftGetResult, fetchPeopleSoftResult } from "../../peoplesoft/http";
import { APPOINTMENTS_URL, loadEnrollmentDates } from "./appointment-dates";

vi.mock("../../peoplesoft/http", () => ({
  fetchPeopleSoftGetResult: vi.fn(),
  fetchPeopleSoftResult: vi.fn()
}));

const datesMarkup = `<div id="win0divNW_DERIVED_SS3_HTMLAREA">
  <h3>General Winter Registration Dates</h3>
  <ul><li>Pre-Registration opens November 9.</li><li>Regular Registration opens November 16.</li></ul>
</div>`;

afterEach(() => {
  document.body.replaceChildren();
  vi.resetAllMocks();
});

it("previews the selected term from the appointment response without navigating the cart", async () => {
  document.body.innerHTML = '<span id="DERIVED_REGFRM1_SSR_STDNTKEY_DESCR$11$">2027 Winter | Undergraduate</span>';
  vi.mocked(fetchPeopleSoftGetResult).mockResolvedValue({
    status: 200,
    finalUrl: APPOINTMENTS_URL,
    text: `<form name="win0" id="SSR_SSENRL_APPT">
      <input type="hidden" name="ICSID" value="fixture-state">
      <div id="SSR_DUMMY_RECV1$scroll$0">
        <input type="radio" id="SSR_DUMMY_RECV1$sels$0$$0" name="SSR_DUMMY_RECV1$sels$0$$0" value="0" checked>
        <span id="TERM_CAR$0">2026 Fall</span>
        <input type="radio" id="SSR_DUMMY_RECV1$sels$1$$0" name="SSR_DUMMY_RECV1$sels$1$$0" value="0">
        <span id="TERM_CAR$1">2027 Winter</span>
      </div>
      <input type="button" id="DERIVED_SSS_SCT_SSR_PB_GO" value="Continue">
    </form>`
  });
  vi.mocked(fetchPeopleSoftResult).mockResolvedValue({
    status: 200,
    finalUrl: APPOINTMENTS_URL,
    text: `<PAGE><FIELD id="win0divPSPAGECONTAINER"><![CDATA[${datesMarkup}]]></FIELD></PAGE>`
  });

  await expect(loadEnrollmentDates(document)).resolves.toEqual({
    heading: "General Winter Registration Dates",
    windows: ["Pre-Registration opens November 9.", "Regular Registration opens November 16."]
  });
  const params = vi.mocked(fetchPeopleSoftResult).mock.calls[0]![1];
  expect(params.get("ICAction")).toBe("DERIVED_SSS_SCT_SSR_PB_GO");
  expect(params.has("SSR_DUMMY_RECV1$sels$0$$0")).toBe(false);
  expect(params.get("SSR_DUMMY_RECV1$sels$1$$0")).toBe("0");
});

it("reuses visible dates from the full page without a network request", async () => {
  document.body.innerHTML = datesMarkup;
  await expect(loadEnrollmentDates(document)).resolves.toMatchObject({
    heading: "General Winter Registration Dates"
  });
  expect(fetchPeopleSoftGetResult).not.toHaveBeenCalled();
});
