import { abortPeopleSoftTasks } from "../../peoplesoft/traffic";
import { REQUEST_OWNER as CTEC_LINKS_REQUEST_OWNER } from "../ctec-links/constants";
import type {
  AuthPopupClosedMessage,
  OpenAuthPopupMessage,
  OpenAuthPopupResponse
} from "../../../shared/messages";
import type { PaperCtecStatusBarData } from "./types";
import { hideAuthModal, renderAuthModal } from "./auth-modal";
import { hideStatusBar } from "./ui";

const DISMISSED_KEY = "better-caesar:paper-ctec:auth-modal-dismissed";
const PENDING_KEY = "better-caesar:paper-ctec:auth-pending";

type AuthFlowHooks = {
  // Augmentation should clear cached fetch state and re-run.
  onInvalidate: (doc: Document) => void;
};

// Owns the pending/auto-show/dismissed/generation state behind the
// "Northwestern login required" modal. Coordinates the popup tab opened by
// the background script and aborts wedged PeopleSoft fetches when the auth
// state changes.
export class AuthFlow {
  private generation = 0;
  private pendingActive = false;
  private modalOpen = false;
  private modalAutoShown = false;
  private modalDismissed = false;
  private storageLoaded = false;
  private awaitingRetry = false;

  constructor(private readonly hooks: AuthFlowHooks) {
    this.attachPopupListener();
    void this.loadStorage();
  }

  getGeneration(): number {
    return this.generation;
  }

  shouldRetryOnFocus(): boolean {
    return this.awaitingRetry || this.pendingActive;
  }

  isAwaitingRetry(): boolean {
    return this.awaitingRetry;
  }

  // Called from the chip on a schedule card. Caller is expected to re-run
  // syncStatusBar so the modal actually renders.
  openManually(): void {
    this.modalOpen = true;
    this.modalAutoShown = true;
    this.setDismissed(false);
  }

  // Side-card analytics callout opens its own login link; this lets it tag the
  // augmentation as awaiting a focus-event retry.
  markAwaitingRetry(): void {
    this.awaitingRetry = true;
  }

  // Called from augmentation.syncStatusBar with the current status snapshot.
  syncFromStatus(
    doc: Document,
    status: PaperCtecStatusBarData | null
  ): void {
    if (!status) {
      hideStatusBar(doc);
      if (this.pendingActive) {
        this.renderModal(doc, undefined);
      } else {
        hideAuthModal(doc);
      }
      return;
    }

    if (status.state === "auth-required") {
      const canAutoShow =
        this.storageLoaded &&
        !this.modalAutoShown &&
        !this.modalDismissed &&
        !this.pendingActive;
      if (canAutoShow) {
        this.modalAutoShown = true;
        this.modalOpen = true;
      }
    } else if (status.state === "ready") {
      if (this.pendingActive) this.completePending();
      this.modalOpen = false;
      this.modalAutoShown = false;
    } else if (!this.pendingActive) {
      this.modalOpen = false;
    }

    if (this.modalOpen || this.pendingActive) {
      this.renderModal(doc, status.loginUrl);
    } else {
      hideAuthModal(doc);
    }
  }

  // Focus event triggered a retry (visibilitychange / window focus).
  retry(doc: Document): void {
    this.invalidate("Aborted because Better CAESAR is retrying after auth state change.");

    if (this.pendingActive) {
      hideStatusBar(doc);
      this.hooks.onInvalidate(doc);
      return;
    }

    this.awaitingRetry = false;
    this.modalOpen = false;
    this.modalAutoShown = false;
    this.setDismissed(false);
    hideAuthModal(doc);
    hideStatusBar(doc);
    this.hooks.onInvalidate(doc);
  }

  private renderModal(doc: Document, loginUrl: string | undefined): void {
    renderAuthModal(
      doc,
      {
        loginUrl,
        awaitingAuthRetry: this.awaitingRetry,
        pending: this.pendingActive
      },
      {
        onLogin: () => this.startPending(doc, loginUrl),
        onDismiss: () => {
          this.modalOpen = false;
          this.setDismissed(true);
          hideAuthModal(doc);
        },
        onCancelPending: () => this.cancelPending(doc)
      }
    );
  }

  private startPending(doc: Document, loginUrl: string | undefined): void {
    if (!loginUrl) return;

    const request: OpenAuthPopupMessage = { type: "open-auth-popup", loginUrl };
    void chrome.runtime
      .sendMessage(request)
      .then((response: OpenAuthPopupResponse | undefined) => {
        if (!response?.ok) window.open(loginUrl, "_blank");
      })
      .catch(() => {
        window.open(loginUrl, "_blank");
      });

    this.pendingActive = true;
    this.awaitingRetry = true;
    this.modalOpen = true;
    this.modalAutoShown = true;
    this.setDismissed(false);
    this.persistPending(true);
    this.renderModal(doc, loginUrl);
  }

  private cancelPending(doc: Document): void {
    this.pendingActive = false;
    this.awaitingRetry = false;
    this.modalOpen = false;
    this.setDismissed(true);
    this.persistPending(false);
    hideAuthModal(doc);
  }

  private completePending(): void {
    this.pendingActive = false;
    this.awaitingRetry = false;
    this.persistPending(false);
  }

  // Background notified us that the popup tab settled on a post-auth URL.
  private finalizeSuccess(doc: Document): void {
    this.invalidate("Aborted because Northwestern login completed.");
    this.pendingActive = false;
    this.awaitingRetry = false;
    this.modalOpen = false;
    this.persistPending(false);
    // Don't reset autoShown/dismissed: if cookies haven't propagated and the
    // refetch still returns auth-required, the chip is the manual re-trigger.
    hideAuthModal(doc);
    hideStatusBar(doc);
    this.hooks.onInvalidate(doc);
  }

  // Bumps the generation token and aborts any wedged PeopleSoft fetches so
  // the new round can actually start.
  private invalidate(reason: string): void {
    this.generation += 1;
    abortPeopleSoftTasks(reason, (task) => task.owner === CTEC_LINKS_REQUEST_OWNER);
  }

  private setDismissed(value: boolean): void {
    this.modalDismissed = value;
    void chrome.storage.local.set({ [DISMISSED_KEY]: value });
  }

  private persistPending(value: boolean): void {
    void chrome.storage.local.set({ [PENDING_KEY]: value });
  }

  private async loadStorage(): Promise<void> {
    const result = await chrome.storage.local.get([DISMISSED_KEY, PENDING_KEY]);
    this.modalDismissed = result[DISMISSED_KEY] === true;
    if (result[PENDING_KEY] === true) {
      this.pendingActive = true;
      this.modalOpen = true;
      this.modalAutoShown = true;
      this.awaitingRetry = true;
    }
    this.storageLoaded = true;
    this.hooks.onInvalidate(document);
  }

  private attachPopupListener(): void {
    chrome.runtime.onMessage.addListener((message: unknown) => {
      if (
        !message ||
        typeof message !== "object" ||
        (message as { type?: string }).type !== "auth-popup-closed"
      ) return;
      // Only act if we're actually waiting — stale events would otherwise
      // tear down state for an unrelated session.
      if (!this.pendingActive) return;
      if ((message as AuthPopupClosedMessage).reason === "succeeded") {
        this.finalizeSuccess(document);
      }
    });
  }
}
