import { startAccessGate } from "./access-gate";
import { mountAccessGateToast } from "./access-gate/toast";
import { augmentationRegistry } from "./augmentations/registry";
import { AugmentationRunner } from "./framework";
import { registerLookupMessageHandler } from "./messaging";

injectEarlyTermPageMask();
registerLookupMessageHandler();
void startAccessGate();
mountAccessGateToast();
new AugmentationRunner(augmentationRegistry).start();

function injectEarlyTermPageMask(): void {
  const url = new URL(window.location.href);
  const page = url.searchParams.get("PAGE") ?? url.searchParams.get("Page");
  if (page !== "SSR_SSENRL_TERM") return;

  const style = document.createElement("style");
  style.id = "better-caesar-early-term-mask";
  style.textContent = `
    body > * { visibility: hidden !important; }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      background: #ffffff;
      z-index: 2147483646;
    }
    body::after {
      content: "Switching term...";
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 2147483647;
      color: #66023c;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.2px;
      font-family: Helvetica, Arial, sans-serif;
    }
  `;

  const host = document.head ?? document.documentElement ?? document.body;
  if (!host) return;
  host.appendChild(style);
}
