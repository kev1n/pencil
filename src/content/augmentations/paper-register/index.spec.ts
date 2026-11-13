// @vitest-environment-options {"url":"https://www.paper.nu/"}

import { afterEach, expect, it } from "vitest";
import { PaperRegisterAugmentation } from ".";

const augmentation = new PaperRegisterAugmentation();

afterEach(() => {
  augmentation.cleanup(document);
  document.body.replaceChildren();
});

it("mounts one Register button before About and removes everything on cleanup", () => {
  const banner = document.createElement("div");
  banner.className = "sticky top-0 z-30 flex w-full";
  banner.innerHTML = '<button type="button">About</button>';
  document.body.append(banner);

  augmentation.run(document);
  augmentation.run(document);
  const triggers = banner.querySelectorAll("button[popovertarget='bc-paper-register']");
  expect(triggers).toHaveLength(1);
  expect(triggers[0]?.textContent).toBe("Register");
  expect(triggers[0]?.nextElementSibling?.textContent).toBe("About");
  expect(document.querySelectorAll("#bc-paper-register")).toHaveLength(1);

  augmentation.cleanup(document);
  expect(banner.children).toHaveLength(1);
  expect(document.querySelector("#bc-paper-register")).toBeNull();
  expect(document.querySelector("#bc-paper-register-style")).toBeNull();
});
