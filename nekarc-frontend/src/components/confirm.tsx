import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Icon from "./Icon";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmFn>(() => Promise.resolve(false));
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setState({ opts, resolve })),
    []
  );

  const close = useCallback(
    (value: boolean) => {
      setState((s) => {
        s?.resolve(value);
        return null;
      });
    },
    []
  );

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, close]);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-overlay" onClick={() => close(false)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className={`modal-icon ${state.opts.danger ? "danger" : ""}`}>
                <Icon name={state.opts.danger ? "alert" : "check"} size={18} />
              </span>
              <div className="modal-title">{state.opts.title}</div>
            </div>
            {state.opts.message && <div className="modal-msg">{state.opts.message}</div>}
            <div className="modal-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => close(false)}>
                {state.opts.cancelLabel || "Cancel"}
              </button>
              <button
                className={`btn btn-sm ${state.opts.danger ? "btn-solid-danger" : "btn-primary"}`}
                autoFocus
                onClick={() => close(true)}
              >
                {state.opts.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
