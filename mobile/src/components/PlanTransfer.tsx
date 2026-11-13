// Keeps the plan the same across a student's devices: turn sync on, pair
// another device with the QR code or link, or bring in a one-off plan link
// from Pencil or Paper.nu.
import { IonContent, IonModal } from "@ionic/react";
import qrcode from "qrcode-generator";
import { useEffect, useMemo, useRef, useState } from "react";
import { importPlan, incomingLink } from "../data/share";
import { useStore } from "../data/store";
import { joinSync, leaveSync, pairingLink, readPairingLink, syncNow, turnOnSync, useSync } from "../data/sync";
import { useWide } from "../platform/wide";
import { Section, timeAgo } from "./bits";

function QrCode({ text }: { text: string }) {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    let d = "";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
    }
    return { size: count, path: d };
  }, [text]);
  return (
    <svg className="qr" viewBox={`-2 -2 ${size + 4} ${size + 4}`} role="img" aria-label="QR code that pairs another device">
      <path d={path} />
    </svg>
  );
}

export function PlanTransfer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sync = useSync();
  const wide = useWide();
  const linkBox = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  // A pairing secret waiting for the student to agree to combine plans.
  const [asking, setAsking] = useState<string | null>(null);

  const link = sync.secret ? pairingLink(sync.secret) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      linkBox.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
  }

  async function bringIn(text = pasted) {
    setBusy(true);
    setNote("");
    try {
      const secret = readPairingLink(text);
      if (secret) {
        if (secret !== sync.secret) setAsking(secret);
        else setNote("This device already syncs with that one.");
      } else {
        const result = await importPlan(text);
        const parts = [`Added ${result.added} ${result.added === 1 ? "class" : "classes"}.`];
        if (result.already > 0) parts.push(`${result.already} already planned.`);
        if (result.missing > 0) parts.push(`${result.missing} no longer offered.`);
        setNote(parts.join(" "));
      }
      setPasted("");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "That link couldn’t be read.");
    }
    setBusy(false);
  }

  async function combine(secret: string) {
    setAsking(null);
    setBusy(true);
    try {
      await joinSync(secret);
      setNote("This device now syncs with your others.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Pairing didn’t go through.");
    }
    setBusy(false);
  }

  // A link the app was opened with is handled straight away.
  const incoming = useStore(incomingLink);
  useEffect(() => {
    if (!incoming) return;
    void bringIn(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  useEffect(() => {
    if (open) void syncNow();
  }, [open]);

  return (
    <IonModal
      className="sheet"
      isOpen={open}
      onDidDismiss={onClose}
      {...(wide ? {} : { initialBreakpoint: 0.9, breakpoints: [0, 0.9] })}
    >
      <IonContent>
        <div className="sheet-body">
          <Section first title="Sync your devices" ctx={<button className="link" onClick={onClose}>Done</button>}>
            {link ? (
              <div className="transfer">
                <QrCode text={link} />
                <p className="text">
                  Scan this with your other device’s camera, or paste the link into Pencil there. Use it only for your
                  own devices: anyone who has it can see and change your plan.
                </p>
                <div className="transfer-row">
                  <input ref={linkBox} className="bc-input" readOnly value={link} onFocus={(e) => e.target.select()} />
                  <button className="bc-btn bc-btn--compact" onClick={() => void copy()}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text">
                  {sync.problem ?? (sync.syncedAt ? `Synced ${timeAgo(sync.syncedAt)}.` : "Syncing…")}{" "}
                  <button className="link" onClick={() => { leaveSync(); setNote(""); }}>Stop syncing on this device</button>
                </p>
              </div>
            ) : (
              <div className="transfer">
                <p className="text">
                  Keep your planned classes the same on your phone and computer. Your plan is locked on your devices
                  before it leaves them, so the service that passes it along can’t read it.
                </p>
                <div>
                  <button className="bc-btn bc-btn--primary bc-btn--compact" onClick={() => void turnOnSync()}>
                    Turn on sync
                  </button>
                </div>
              </div>
            )}
          </Section>

          <Section title="Bring a plan in">
            <div className="transfer">
              <p className="text">
                Paste a sync link from another device, or a Paper.nu share link to add its classes to what’s here.
              </p>
              <div className="transfer-row">
                <input
                  className="bc-input"
                  placeholder="https://…"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
                <button
                  className="bc-btn bc-btn--primary bc-btn--compact"
                  disabled={busy || !pasted.trim()}
                  onClick={() => void bringIn()}
                >
                  {busy ? "Adding…" : "Add"}
                </button>
              </div>
              {asking && (
                <div className="transfer">
                  <p className="text">
                    Combine plans? The classes planned here and on the other device become one plan, on every device
                    paired with either of them. This can’t be undone.
                  </p>
                  <div className="transfer-row">
                    <button className="bc-btn bc-btn--primary bc-btn--compact" onClick={() => void combine(asking)}>
                      Combine
                    </button>
                    <button className="bc-btn bc-btn--compact" onClick={() => setAsking(null)}>Cancel</button>
                  </div>
                </div>
              )}
              {note && <p className="text">{note}</p>}
            </div>
          </Section>
        </div>
      </IonContent>
    </IonModal>
  );
}
