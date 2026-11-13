import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enrollFromCart = vi.fn();
vi.mock("./flow", () => ({
  enrollFromCart: (...args: unknown[]) => enrollFromCart(...args),
  loadCartRows: () => Promise.resolve({ rows: [], message: null })
}));
vi.mock("../../shared/toast", () => ({ showToast: vi.fn() }));
vi.mock("../augmentations/class-search/auth-recovery", () => ({
  createAuthRecovery: () => ({}),
  withAuthRecovery: (_recovery: unknown, _isAuth: unknown, action: () => Promise<unknown>) => action()
}));

import { createRegisterButton } from "./register-button";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createRegisterButton", () => {
  let now = 0;
  beforeEach(() => {
    enrollFromCart.mockReset();
    enrollFromCart.mockResolvedValue({ kind: "done", results: [{ label: "COMP_SCI 211-0-1 (12345)", ok: true, message: "Success" }] });
    now = 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
  });
  afterEach(() => vi.restoreAllMocks());

  const make = (classNumber: string | null = "12345") =>
    createRegisterButton({ doc: document, termId: "4960", classNumber: () => classNumber, className: "x" });

  it("asks first, then enrolls the class in the row's term on the second press", async () => {
    const button = make();
    button.click();
    await flush();
    expect(button.textContent).toBe("Confirm: enroll me");
    expect(enrollFromCart).not.toHaveBeenCalled();

    now += 2000;
    button.click();
    await flush();
    expect(enrollFromCart).toHaveBeenCalledTimes(1);
    expect(enrollFromCart).toHaveBeenCalledWith("4960", ["12345"], "register-button");
    expect(button.textContent).toBe("Enrolled");
    expect(button.disabled).toBe(true);
  });

  it("does not take a double-click as the confirming press", async () => {
    const button = make();
    button.click();
    await flush();
    now += 150;
    button.click();
    await flush();
    expect(enrollFromCart).not.toHaveBeenCalled();
    expect(button.textContent).toBe("Confirm: enroll me");
  });

  it("enrolls nothing when the class is no longer in the cart", async () => {
    const button = make(null);
    button.click();
    await flush();
    now += 2000;
    button.click();
    await flush();
    expect(enrollFromCart).not.toHaveBeenCalled();
    expect(button.textContent).toBe("Register");
  });
});
