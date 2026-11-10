// @vitest-environment-options {"url":"https://www.paper.nu/"}

import { afterEach, expect, it } from "vitest";
import { PaperEnrollmentDatesAugmentation } from ".";

const augmentation = new PaperEnrollmentDatesAugmentation();

afterEach(() => {
  augmentation.cleanup(document);
  document.body.replaceChildren();
});

it("mounts one Enrollment Dates button in the banner and restores it after navigation", () => {
  const banner = document.createElement("div");
  banner.className = "sticky top-0 z-30 flex w-full";
  const about = '<button type="button">About</button>';
  banner.innerHTML = about;
  document.body.append(banner);

  augmentation.run(document);
  augmentation.run(document);
  const trigger = banner.querySelector("button[popovertarget='bc-paper-enrollment-dates']");
  expect(trigger?.previousElementSibling).toBe(banner.firstElementChild);
  expect(trigger?.textContent).toBe("Enrollment Dates");
  const link = document.querySelector<HTMLAnchorElement>("#bc-paper-enrollment-dates a");
  expect(link?.hostname).toBe("caesar.ent.northwestern.edu");
  expect(link?.target).toBe("_blank");

  banner.innerHTML = about;
  augmentation.run(document);
  expect(banner.querySelectorAll("[popovertarget]")).toHaveLength(1);
  expect(document.querySelectorAll("#bc-paper-enrollment-dates")).toHaveLength(1);

  augmentation.cleanup(document);
  expect(banner.children).toHaveLength(1);
  expect(document.querySelector("#bc-paper-enrollment-dates")).toBeNull();
  expect(document.querySelector("#bc-paper-enrollment-dates-style")).toBeNull();
});
