import { useEffect, useState } from "react";
import {
  SCHEMA_VERSION,
  parseSnapshot,
  type Offer,
  type Snapshot,
} from "./domain/snapshot";
import { CATEGORIES } from "./domain/categories";
import "./styles.css";

const STOCKHOLM_TIME_ZONE = "Europe/Stockholm";
type SortOrder = "price" | "discount";
type OfferView = {
  sortOrder: SortOrder;
  selectedChains: string[];
  selectedStoreIds: string[];
  selectedCategories: string[];
  searchText: string;
};

class SnapshotLoadError extends Error {
  constructor(
    message: string,
    readonly kind: "version" | "format" | "network",
  ) {
    super(message);
  }
}

function stockholmDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: STOCKHOLM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: STOCKHOLM_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: STOCKHOLM_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPrice(value: number): string {
  return `${new Intl.NumberFormat("sv-SE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} kr`;
}

function visibleOffers(snapshot: Snapshot, today: string): Offer[] {
  return snapshot.offers.filter(
    (offer) =>
      offer.validTo >= today && (!offer.validFrom || offer.validFrom <= today),
  );
}

function offerDiscount(offer: Offer): number | undefined {
  if (
    offer.unitPrice === undefined ||
    offer.regularPrice === undefined ||
    offer.priceUnit === undefined
  ) {
    return undefined;
  }
  return offer.regularPrice - offer.unitPrice;
}

function sortOffers(offers: Offer[], order: SortOrder): Offer[] {
  return [...offers].sort((left, right) => {
    const leftValue =
      order === "price" ? left.unitPrice : offerDiscount(left);
    const rightValue =
      order === "price" ? right.unitPrice : offerDiscount(right);

    if (leftValue === undefined) {
      return rightValue === undefined
        ? left.name.localeCompare(right.name, "sv")
        : 1;
    }
    if (rightValue === undefined) {
      return -1;
    }

    const valueDifference =
      order === "price" ? leftValue - rightValue : rightValue - leftValue;
    return valueDifference || left.name.localeCompare(right.name, "sv");
  });
}

function toggleSelection(selected: string[], value: string): string[] {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];
}

function readOfferViewFromAddress(
  snapshot: Snapshot,
  search: string,
): OfferView {
  const searchParams = new URLSearchParams(search);
  const selectedChains = [
    ...new Set(
      searchParams
        .getAll("chain")
        .filter((chain) =>
          snapshot.chains.some((available) => available.chain === chain),
        ),
    ),
  ];
  const availableStoreIds = new Set(
    snapshot.stores
      .filter(
        (store) =>
          selectedChains.length === 0 ||
          selectedChains.includes(store.chain),
      )
      .map((store) => store.id),
  );
  const validCategories = new Set<string>(CATEGORIES);

  return {
    sortOrder: searchParams.get("sort") === "discount" ? "discount" : "price",
    selectedChains,
    selectedStoreIds: [
      ...new Set(
        searchParams
          .getAll("store")
          .filter((storeId) => availableStoreIds.has(storeId)),
      ),
    ],
    selectedCategories: [
      ...new Set(
        searchParams
          .getAll("category")
          .filter((category) => validCategories.has(category)),
      ),
    ],
    searchText: searchParams.get("q") ?? "",
  };
}

function writeOfferViewToAddress(view: OfferView): void {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  for (const name of ["chain", "store", "category", "q", "sort"]) {
    searchParams.delete(name);
  }
  view.selectedChains.forEach((chain) => searchParams.append("chain", chain));
  view.selectedStoreIds.forEach((storeId) =>
    searchParams.append("store", storeId),
  );
  view.selectedCategories.forEach((category) =>
    searchParams.append("category", category),
  );
  if (view.searchText) {
    searchParams.set("q", view.searchText);
  }
  if (view.sortOrder !== "price") {
    searchParams.set("sort", view.sortOrder);
  }

  const query = searchParams.toString();
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${query ? `?${query}` : ""}${url.hash}`,
  );
}

async function loadSnapshot(snapshotUrl: string): Promise<Snapshot> {
  let response: Response;
  try {
    response = await fetch(snapshotUrl, {
      headers: { Accept: "application/json" },
      credentials: "omit",
    });
  } catch {
    throw new SnapshotLoadError(
      "Erbjudandena kunde inte hämtas. Kontrollera anslutningen och försök igen.",
      "network",
    );
  }
  if (!response.ok) {
    throw new SnapshotLoadError(
      `Snapshoten kunde inte hämtas (HTTP ${response.status}).`,
      "network",
    );
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new SnapshotLoadError("Snapshoten innehåller inte giltig JSON.", "format");
  }
  if (typeof value !== "object" || value === null || !("schemaVersion" in value)) {
    throw new SnapshotLoadError("Snapshoten har ett ogiltigt format.", "format");
  }
  if (value.schemaVersion !== SCHEMA_VERSION) {
    throw new SnapshotLoadError(
      "Snapshot-versionen stöds inte av den här appen.",
      "version",
    );
  }
  try {
    return parseSnapshot(value);
  } catch {
    throw new SnapshotLoadError("Snapshoten har ett ogiltigt format.", "format");
  }
}

function OfferCard({
  offer,
  storeName,
  stale,
}: {
  offer: Offer;
  storeName: string;
  stale: boolean;
}) {
  return (
    <article className="offer-card">
      <div className="offer-image">
        {offer.imageUrl ? (
          <img src={offer.imageUrl} alt={offer.name} loading="lazy" />
        ) : (
          <div className="image-placeholder" role="img" aria-label="Ingen produktbild">
            <span aria-hidden="true">Bild saknas</span>
          </div>
        )}
      </div>
      <div className="offer-content">
        <p className="offer-category">{offer.category}</p>
        <h2>{offer.name}</h2>
        {(offer.brand || offer.packageSize) && (
          <p className="product-details">
            {[offer.brand, offer.packageSize].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="mechanic">{offer.mechanicText}</p>
        {stale && <p className="stale-marker">Kan vara inaktuellt</p>}
        <dl className="offer-details">
          {offer.comparisonPriceText && (
            <div>
              <dt>Jämförpris</dt>
              <dd>{offer.comparisonPriceText}</dd>
            </div>
          )}
          {offer.regularPrice !== undefined && (
            <div>
              <dt>Ordinarie pris</dt>
              <dd>{formatPrice(offer.regularPrice)}</dd>
            </div>
          )}
          {offer.limitText && (
            <div>
              <dt>Köplimit</dt>
              <dd>{offer.limitText}</dd>
            </div>
          )}
          <div>
            <dt>Kedja</dt>
            <dd>{offer.chain}</dd>
          </div>
          <div>
            <dt>Butik</dt>
            <dd>{storeName}</dd>
          </div>
          <div>
            <dt>Giltigt</dt>
            <dd>t.o.m. {formatDate(offer.validTo)}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

export function App({
  snapshotUrl = "/snapshots/linkoping.json",
}: {
  snapshotUrl?: string;
} = {}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<SnapshotLoadError | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<OfferView | null>(null);

  const resetFilters = () => {
    setView((current) =>
      current
        ? {
            ...current,
            selectedChains: [],
            selectedStoreIds: [],
            selectedCategories: [],
            searchText: "",
          }
        : current,
    );
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    loadSnapshot(snapshotUrl)
      .then((loaded) => {
        if (active) {
          setSnapshot(loaded);
          setView(readOfferViewFromAddress(loaded, window.location.search));
          setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof SnapshotLoadError
              ? cause
              : new SnapshotLoadError(
                  "Snapshoten kunde inte läsas.",
                  "format",
                ),
          );
          setSnapshot(null);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [snapshotUrl]);

  useEffect(() => {
    if (snapshot && view) {
      writeOfferViewToAddress(view);
    }
  }, [snapshot, view]);

  if (loading) {
    return (
      <main className="app-shell">
        <h1>Veckans erbjudanden</h1>
        <p role="status">Laddar erbjudanden…</p>
      </main>
    );
  }

  if (error || !snapshot) {
    return (
      <main className="app-shell">
        <h1>Veckans erbjudanden</h1>
        <p className="error-message" role="alert">
          {error?.message ?? "Snapshoten kunde inte läsas."}
        </p>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="app-shell">
        <h1>Veckans erbjudanden</h1>
        <p role="status">Laddar erbjudanden…</p>
      </main>
    );
  }

  const currentOffers = visibleOffers(snapshot, stockholmDate(new Date()));
  const searchTerms = view.searchText
    .trim()
    .toLocaleLowerCase("sv-SE")
    .split(/\s+/)
    .filter(Boolean);
  const availableStores = snapshot.stores.filter(
    (store) =>
      view.selectedChains.length === 0 ||
      view.selectedChains.includes(store.chain),
  );
  const matchingOffers = currentOffers.filter(
    (offer) =>
      (view.selectedChains.length === 0 ||
        view.selectedChains.includes(offer.chain)) &&
      (view.selectedStoreIds.length === 0 ||
        view.selectedStoreIds.includes(offer.storeId)) &&
      (view.selectedCategories.length === 0 ||
        view.selectedCategories.includes(offer.category)) &&
      searchTerms.every((term) =>
        `${offer.name} ${offer.brand ?? ""}`
          .toLocaleLowerCase("sv-SE")
          .includes(term),
      ),
  );
  const chainChoices = snapshot.chains.map(({ chain }) => chain);
  const categoryChoices = CATEGORIES.filter((category) =>
    currentOffers.some((offer) => offer.category === category) ||
    view.selectedCategories.includes(category),
  );
  const sortedOffers = sortOffers(matchingOffers, view.sortOrder);
  const storeNames = new Map(snapshot.stores.map((store) => [store.id, store.name]));
  const staleChains = new Set(
    snapshot.chains
      .filter((chain) => chain.status === "stale")
      .map((chain) => chain.chain),
  );
  const unhealthyChains = snapshot.chains.filter(
    (chain) => chain.status !== "ok",
  );
  const isFixtureSnapshot = snapshot.chains.some(
    (chain) => chain.source === "hemkop-fixture",
  );

  return (
    <main className="app-shell">
      <header className="page-header">
        <p className="eyebrow">Matapp · Linköping</p>
        <h1>Veckans erbjudanden i {snapshot.location.name}</h1>
        <p className="offer-count" aria-live="polite">
          {matchingOffers.length} {matchingOffers.length === 1 ? "erbjudande" : "erbjudanden"}
        </p>
        <p className="updated-at">
          Senast uppdaterad {formatTimestamp(snapshot.generatedAt)}
        </p>
      </header>

      <label className="sort-control">
        <span>Sortera efter</span>
        <select
          value={view.sortOrder}
          onChange={(event) =>
            setView((current) =>
              current
                ? {
                    ...current,
                    sortOrder: event.target.value as SortOrder,
                  }
                : current,
            )
          }
        >
          <option value="price">Lägsta pris</option>
          <option value="discount">Största rabatt</option>
        </select>
      </label>

      {isFixtureSnapshot && (
        <aside className="fixture-notice" role="note">
          Exempeldata från testfixturer — ingen liveuppdatering har körts.
        </aside>
      )}

      {unhealthyChains.map((chain) => (
        <aside className="source-warning" role="alert" key={chain.chain}>
          <strong>{chain.chain} kunde inte uppdateras.</strong>{" "}
          {chain.lastSuccessAt
            ? `Senast lyckad uppdatering: ${formatTimestamp(chain.lastSuccessAt)}.`
            : "Ingen tidigare lyckad uppdatering finns."}{" "}
          {chain.status === "stale" && "Tidigare giltiga erbjudanden visas."}
          {chain.error && <span className="source-error"> {chain.error}</span>}
        </aside>
      ))}

      <section className="filter-panel" aria-label="Filtrera erbjudanden">
        <fieldset className="filter-group">
          <legend>Kedjor</legend>
          <div className="filter-options">
            {chainChoices.map((chain) => (
              <label className="filter-option" key={chain}>
                <input
                  type="checkbox"
                  checked={view.selectedChains.includes(chain)}
                  onChange={() => {
                    setView((current) => {
                      if (!current) {
                        return current;
                      }
                      const nextChains = toggleSelection(
                        current.selectedChains,
                        chain,
                      );
                      const availableStoreIds = new Set(
                        snapshot.stores
                          .filter(
                            (store) =>
                              nextChains.length === 0 ||
                              nextChains.includes(store.chain),
                          )
                          .map((store) => store.id),
                      );
                      return {
                        ...current,
                        selectedChains: nextChains,
                        selectedStoreIds: current.selectedStoreIds.filter(
                          (storeId) => availableStoreIds.has(storeId),
                        ),
                      };
                    });
                  }}
                />
                <span>{chain}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="filter-group">
          <legend>Butiker</legend>
          <div className="filter-options">
            {availableStores.map((store) => (
              <label className="filter-option" key={store.id}>
                <input
                  type="checkbox"
                  checked={view.selectedStoreIds.includes(store.id)}
                  onChange={() =>
                    setView((current) =>
                      current
                        ? {
                            ...current,
                            selectedStoreIds: toggleSelection(
                              current.selectedStoreIds,
                              store.id,
                            ),
                          }
                        : current,
                    )
                  }
                />
                <span>
                  {store.name} ({store.chain})
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="filter-group">
          <legend>Kategorier</legend>
          <div className="filter-options">
            {categoryChoices.map((category) => (
              <label className="filter-option" key={category}>
                <input
                  type="checkbox"
                  checked={view.selectedCategories.includes(category)}
                  onChange={() =>
                    setView((current) =>
                      current
                        ? {
                            ...current,
                            selectedCategories: toggleSelection(
                              current.selectedCategories,
                              category,
                            ),
                          }
                        : current,
                    )
                  }
                />
                <span>{category}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="search-field">
          <label htmlFor="offer-search">Sök på produkt eller varumärke</label>
          <input
            id="offer-search"
            type="search"
            value={view.searchText}
            onChange={(event) =>
              setView((current) =>
                current
                  ? { ...current, searchText: event.target.value }
                  : current,
              )
            }
            placeholder="Sök erbjudanden"
          />
        </div>
        <button className="reset-filters" type="button" onClick={resetFilters}>
          Rensa filter
        </button>
      </section>

      {matchingOffers.length === 0 ? (
        <section className="empty-state" aria-live="polite">
          <h2>
            {currentOffers.length === 0
              ? "Inga erbjudanden just nu"
              : "Inga erbjudanden matchar dina filter"}
          </h2>
          <p>
            {currentOffers.length === 0
              ? "Det finns inga giltiga erbjudanden att visa för tillfället."
              : "Ändra filtren eller välj Rensa filter för att visa alla erbjudanden."}
          </p>
        </section>
      ) : (
        <section className="offer-list" aria-label="Erbjudanden">
          {sortedOffers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              storeName={storeNames.get(offer.storeId) ?? "Okänd butik"}
              stale={staleChains.has(offer.chain)}
            />
          ))}
        </section>
      )}
    </main>
  );
}
