import { useEffect, useRef } from "react";
import type { Store } from "../domain/snapshot";

export function StorePicker({
  stores,
  selectedStoreIds,
  onChange,
}: {
  stores: readonly Store[];
  selectedStoreIds: readonly string[] | null;
  onChange: (selection: string[] | null) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectedCount = selectedStoreIds === null
    ? stores.length
    : stores.filter((store) => selectedStoreIds.includes(store.id)).length;
  const allSelected = selectedCount === stores.length && stores.length > 0;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedCount > 0 && !allSelected;
    }
  }, [selectedCount, allSelected]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (details && event.target instanceof Node && !details.contains(event.target)) {
        details.open = false;
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const details = detailsRef.current;
      if (event.key === "Escape" && details?.open) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <details className="store-picker" ref={detailsRef}>
      <summary>
        <span className="store-picker-label">Butiker</span>
        <span className="store-picker-value">
          {allSelected
            ? `Alla ${stores.length} valda`
            : `${selectedCount} av ${stores.length} valda`}
        </span>
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m5 7 5 5 5-5" />
        </svg>
      </summary>
      <fieldset className="store-options">
        <legend className="visually-hidden">Välj butiker</legend>
        <label className="store-option store-select-all">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allSelected}
            onChange={(event) => onChange(event.target.checked ? null : [])}
          />
          <span>Välj alla butiker</span>
        </label>
        <div className="store-options-list">
          {stores.map((store) => (
            <label className="store-option" key={store.id}>
              <input
                type="checkbox"
                aria-label={`${store.name} (${store.chain})`}
                checked={selectedStoreIds === null || selectedStoreIds.includes(store.id)}
                onChange={() => {
                  const selected = selectedStoreIds ?? stores.map(({ id }) => id);
                  const next = selected.includes(store.id)
                    ? selected.filter((id) => id !== store.id)
                    : [...selected, store.id];
                  onChange(next.length === stores.length ? null : next);
                }}
              />
              <span>{store.name} ({store.chain})</span>
            </label>
          ))}
        </div>
      </fieldset>
    </details>
  );
}
