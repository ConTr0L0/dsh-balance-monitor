/**
 * The balance monitor as a full main-area page.
 *
 * DSH's shell exposes a global panel as a pair: a `sidebar.panellist` row (the
 * left rail, beside the shipped panels) and a `main` keyed-slot component whose
 * key equals that row's `id`. Clicking the row calls the layout's
 * `selectPanel(id)`, which mounts this component in place of the Conversation —
 * the same seat the Plugins and Usage-statistics pages occupy.
 *
 * This is why the Settings section is gone: the rail row is the entry point, and
 * the page renders the very same `SettingsCard` body, only inside a page frame
 * (title, intro, back control) instead of a settings pane. Nothing is
 * duplicated, so both entries can never drift apart.
 */
import type { RpcCall } from "./api";
import { t as i18n } from "./locales";
import { SettingsCard } from "./settings";

export interface BalanceMonitorPageProps {
  rpc: RpcCall;
  /** Return to the panel (or the Conversation) the reader came from. */
  goBack: () => void;
}

/** The rail row's glyph; the sidebar owns the button, label and active state. */
export function BalancePanelIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M16 14.5h2" />
    </svg>
  );
}

export function BalanceMonitorPage({ rpc, goBack }: BalanceMonitorPageProps) {
  return (
    <div className="bm-page">
      <div className="bm-page-head">
        <div className="bm-page-heading">
          <h1 className="bm-page-title">{i18n("name")}</h1>
          <p className="bm-page-intro">{i18n("pageIntro")}</p>
        </div>
        <button type="button" className="bm-back" onClick={goBack}>
          <svg
            viewBox="0 0 24 24"
            width={14}
            height={14}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          {i18n("back")}
        </button>
      </div>
      <SettingsCard rpc={rpc} />
    </div>
  );
}
