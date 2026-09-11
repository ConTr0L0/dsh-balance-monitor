/**
 * One-shot pricing-change popup (dsh-balance-monitor client).
 *
 * The host queues `state.pricingNotice` whenever a successful official-pricing
 * sync sees the published rules change. This component renders that notice as
 * a modal with the before/after diff on the client's next overview fetch (i.e.
 * the first DSH open after the change); acknowledging it — button, Esc or mask
 * click — clears it until the NEXT change.
 *
 * The Modal/Button primitives come from the host's client-module table
 * (`@deepseek-ai/dsh-client-ui-primitives`). The require is wrapped so a
 * missing module silently disables the popup instead of breaking the widget.
 */
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { getSnapshot, refreshAll, subscribe } from "./store";
import { t } from "./locales";
import type { PriceTriple, PricingNotice, RpcCall } from "./api";

declare const require: (id: string) => Record<string, unknown>;

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
};
type ButtonProps = { onClick?: () => void; disabled?: boolean; variant?: string; size?: string; children?: ReactNode };

let PrimitivesModal: ((props: ModalProps) => ReactNode) | null = null;
let PrimitivesButton: ((props: ButtonProps) => ReactNode) | null = null;
try {
  const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
  PrimitivesModal = (primitives?.Modal ?? null) as typeof PrimitivesModal;
  PrimitivesButton = (primitives?.Button ?? null) as typeof PrimitivesButton;
} catch {
  /* primitives unavailable → popup silently disabled */
}

type ModelRow = { id: string; status: "changed" | "added" | "removed"; prev: PriceTriple; next: PriceTriple };

/** Changed / added / removed models, sorted by id (unchanged rows omitted). */
function diffModels(notice: PricingNotice): ModelRow[] {
  const rows: ModelRow[] = [];
  const ids = [...new Set([...Object.keys(notice.old?.models ?? {}), ...Object.keys(notice.new?.models ?? {})])];
  for (const id of ids) {
    const prev = notice.old?.models?.[id];
    const next = notice.new?.models?.[id];
    if (!prev && next) rows.push({ id, status: "added", prev: next, next });
    else if (prev && !next) rows.push({ id, status: "removed", prev, next });
    else if (prev && next && (prev.input !== next.input || prev.cacheHit !== next.cacheHit || prev.output !== next.output)) {
      rows.push({ id, status: "changed", prev, next });
    }
  }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

const fmtWindows = (windows: string[][] | undefined) =>
  (windows ?? []).map(([start, end]) => `${start}–${end}`).join("、") || "—";

/** Old → new price cell; the old value is struck through only when it changed. */
function PriceCell({ before, after }: { before: number; after: number }) {
  const changed = before !== after;
  return (
    <span className="bm-notice-price">
      {changed && <s className="bm-notice-old">{before}</s>}
      {changed && <span aria-hidden="true"> → </span>}
      <span className="bm-notice-new" data-changed={changed || undefined}>{after}</span>
    </span>
  );
}

export function PricingChangeNotice({ rpc }: { rpc: RpcCall }) {
  const { overview } = useSyncExternalStore(subscribe, getSnapshot);
  const notice = overview?.pricingNotice ?? null;
  const [busy, setBusy] = useState(false);

  if (!notice || !PrimitivesModal || !PrimitivesButton || !rpc) return null;

  const dismiss = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await rpc("pricing-notice/ack");
    } catch {
      /* ack failed — the notice resurfaces on the next open, harmless */
    } finally {
      setBusy(false);
      void refreshAll(rpc);
    }
  };

  const rows = diffModels(notice);
  const oldRules = notice.old;
  const newRules = notice.new;
  const rules: { key: string; label: string; before: string; after: string }[] = [];
  if (oldRules && newRules) {
    if (JSON.stringify(oldRules.peakWindows) !== JSON.stringify(newRules.peakWindows)) {
      rules.push({ key: "peakWindows", label: t("rulePeakWindows"), before: fmtWindows(oldRules.peakWindows), after: fmtWindows(newRules.peakWindows) });
    }
    if (oldRules.offPeakFactor !== newRules.offPeakFactor) {
      rules.push({ key: "offPeakFactor", label: t("ruleOffPeakFactor"), before: `×${oldRules.offPeakFactor}`, after: `×${newRules.offPeakFactor}` });
    }
    if (oldRules.weekendOffPeak !== newRules.weekendOffPeak) {
      rules.push({ key: "weekendOffPeak", label: t("ruleWeekend"), before: t(oldRules.weekendOffPeak ? "on" : "off"), after: t(newRules.weekendOffPeak ? "on" : "off") });
    }
  }

  const when = new Date(notice.fetchedAt).toLocaleString();

  return (
    <PrimitivesModal
      open
      onClose={dismiss}
      title={t("noticeTitle")}
      closeLabel={t("noticeClose")}
      description={`${t("noticeDesc")} (${t("updated")} ${when})`}
      footer={
        <PrimitivesButton variant="primary" size="sm" onClick={dismiss} disabled={busy}>
          {t("noticeAck")}
        </PrimitivesButton>
      }
    >
      <div className="bm-notice">
        {rows.length > 0 ? (
          <table className="bm-notice-table">
            <thead>
              <tr>
                <th>{t("noticeColModel")}</th>
                <th>{t("noticeColHit")}</th>
                <th>{t("noticeColMiss")}</th>
                <th>{t("noticeColOut")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="bm-notice-model">{row.id}</span>
                    {row.status !== "changed" && (
                      <span className="bm-notice-tag" data-kind={row.status}>{row.status === "added" ? t("noticeAdded") : t("noticeRemoved")}</span>
                    )}
                  </td>
                  <td><PriceCell before={row.prev.cacheHit} after={row.next.cacheHit} /></td>
                  <td><PriceCell before={row.prev.input} after={row.next.input} /></td>
                  <td><PriceCell before={row.prev.output} after={row.next.output} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="bm-notice-nomodels">{t("noticeNoModels")}</div>
        )}

        {rules.length > 0 && (
          <div className="bm-notice-rules">
            <div className="bm-notice-rules-title">{t("noticeRulesTitle")}</div>
            {rules.map((rule) => (
              <div className="bm-notice-rule" key={rule.key}>
                <span className="bm-notice-rule-label">{rule.label}</span>
                <span className="bm-notice-rule-value">
                  <s className="bm-notice-old">{rule.before}</s>
                  <span aria-hidden="true">→</span>
                  <span className="bm-notice-new" data-changed="true">{rule.after}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </PrimitivesModal>
  );
}
