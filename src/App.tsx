import { useEffect, useState } from "react";
import {
  STOCKHOLM_TIME_ZONE,
  stockholmDate,
} from "./domain/date";
import {
  SCHEMA_VERSION,
  parseSnapshot,
  type Offer,
  type Snapshot,
} from "./domain/snapshot";
import { CATEGORIES } from "./domain/categories";
import {
  aggregateOffers,
  purchasePrice,
  sortOfferGroups,
  type OfferGroup,
  type SortOrder,
} from "./domain/offer-view";
import { StorePicker } from "./components/StorePicker";
import {
  DEFAULT_LOCATION_ID,
  LOCATION_REGISTRY,
  type LocationConfig,
} from "./snapshot/config";
import "./styles.css";

type LocationOption = Pick<LocationConfig, "id" | "name">;
type OfferView = {
  sortOrder: SortOrder;
  selectedChains: string[];
  selectedStoreIds: string[] | null;
  selectedCategories: string[];
  searchText: string;
};
const PRICE_FORMATTER = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

class SnapshotLoadError extends Error {
  constructor(
    message: string,
    readonly kind: "version" | "format" | "network" | "location",
  ) {
    super(message);
  }
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
  return `${PRICE_FORMATTER.format(value)} kr`;
}

function visibleOffers(snapshot: Snapshot, today: string): Offer[] {
  return snapshot.offers.filter(
    (offer) =>
      offer.price !== 0 &&
      offer.unitPrice !== 0 &&
      offer.validTo >= today && (!offer.validFrom || offer.validFrom <= today),
  );
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
  const requestedStores = searchParams.getAll("store");
  const selectedStores = [
    ...new Set(requestedStores.filter((storeId) => availableStoreIds.has(storeId))),
  ];

  return {
    sortOrder: searchParams.get("sort") === "discount" ? "discount" : "price",
    selectedChains,
    selectedStoreIds: requestedStores.length === 1 && requestedStores[0] === "none"
      ? []
      : selectedStores.length > 0 ? selectedStores : null,
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
  if (view.selectedStoreIds?.length === 0) {
    searchParams.set("store", "none");
  } else {
    view.selectedStoreIds?.forEach((storeId) =>
      searchParams.append("store", storeId),
    );
  }
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
  group,
  stores,
  stale,
}: {
  group: OfferGroup;
  stores: Array<{ id: string; name: string }>;
  stale: boolean;
}) {
  const { offer, discountPercent: discount, regularPriceRange } = group;
  const price = purchasePrice(offer);
  const priceParts = price === undefined ? undefined : PRICE_FORMATTER.format(price).split(",");

  return (
    <article className="offer-card">
      <div className="offer-card-topline">
        <span className="chain-label">{offer.chain}</span>
        {discount !== undefined && discount >= 1 && (
          <span className="discount-badge">
            Spara {group.discountVaries ? "minst " : ""}{Math.floor(discount)}%
          </span>
        )}
      </div>
      <div className="offer-image">
        <div className="image-placeholder" role="img" aria-label="Ingen produktbild">
          <svg viewBox="0 0 96 96" fill="none" aria-hidden="true">
            <path d="m27 28 21-10 21 10v40L48 79 27 68V28Z" />
            <path d="m27 28 21 11 21-11M48 39v40M37 23l21 11M36 49v14" />
          </svg>
          <span aria-hidden="true">Bild saknas</span>
        </div>
        {priceParts && price !== undefined && (
          <p className="price-ticket">
            <span className="visually-hidden">{formatPrice(price)}</span>
            <span className="price-whole" aria-hidden="true">{priceParts[0]}</span>
            <span className="price-fraction" aria-hidden="true">
              {priceParts[1] === "00" ? ":-" : priceParts[1]}
              <small>kr</small>
            </span>
          </p>
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
          {regularPriceRange && (
            <div>
              <dt>Ordinarie pris</dt>
              <dd>
                {regularPriceRange.min === regularPriceRange.max
                  ? formatPrice(regularPriceRange.min)
                  : `${PRICE_FORMATTER.format(regularPriceRange.min)}–${formatPrice(regularPriceRange.max)}`}
                {offer.priceUnit && <span>/{offer.priceUnit}</span>}
                {!regularPriceRange.complete && " (där uppgift finns)"}
              </dd>
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
            <dd>
              <ul className="offer-stores">
                {stores.map((store) => <li key={store.id}>{store.name}</li>)}
              </ul>
            </dd>
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
  snapshotUrl,
  locations = LOCATION_REGISTRY.locations,
  defaultLocationId = DEFAULT_LOCATION_ID,
}: {
  snapshotUrl?: string;
  locations?: readonly LocationOption[];
  defaultLocationId?: string;
} = {}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<SnapshotLoadError | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<OfferView | null>(null);
  const [requestedLocationId, setRequestedLocationId] = useState(() =>
    new URLSearchParams(window.location.search).get("location"),
  );
  const activeLocation = requestedLocationId
    ? locations.find((location) => location.id === requestedLocationId)
    : locations.find((location) => location.id === defaultLocationId) ??
      (locations.length === 1 ? locations[0] : undefined);
  const locationError =
    requestedLocationId && !activeLocation
      ? `Platsen "${requestedLocationId}" finns inte konfigurerad.`
      : locations.length === 0
        ? "Ingen plats är konfigurerad."
        : "Ange en plats i sidans adress.";
  const resolvedSnapshotUrl =
    snapshotUrl ??
    (activeLocation
      ? `${import.meta.env.BASE_URL}snapshots/${encodeURIComponent(activeLocation.id)}.json`
      : undefined);

  useEffect(() => {
    const syncLocationFromAddress = () => {
      setRequestedLocationId(
        new URLSearchParams(window.location.search).get("location"),
      );
    };
    window.addEventListener("popstate", syncLocationFromAddress);
    return () => window.removeEventListener("popstate", syncLocationFromAddress);
  }, []);

  const resetFilters = () => {
    setView((current) =>
      current
        ? {
            ...current,
            selectedChains: [],
            selectedStoreIds: null,
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
    if (!activeLocation || !resolvedSnapshotUrl) {
      setSnapshot(null);
      setError(new SnapshotLoadError(locationError, "location"));
      setLoading(false);
      return () => {
        active = false;
      };
    }

    loadSnapshot(resolvedSnapshotUrl)
      .then((loaded) => {
        if (loaded.location.id !== activeLocation.id) {
          throw new SnapshotLoadError(
            "Snapshoten gäller en annan plats än den begärda.",
            "format",
          );
        }
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
  }, [
    activeLocation?.id,
    locationError,
    resolvedSnapshotUrl,
  ]);

  useEffect(() => {
    if (snapshot && view) {
      writeOfferViewToAddress(view);
    }
  }, [snapshot, view]);

  if (loading) {
    return (
      <main className="app-shell">
        <h1>
          {activeLocation
            ? `Veckans erbjudanden i ${activeLocation.name}`
            : "Veckans erbjudanden"}
        </h1>
        <p role="status">Laddar erbjudanden…</p>
      </main>
    );
  }

  if (error || !snapshot) {
    return (
      <main className="app-shell">
        <h1>
          {activeLocation
            ? `Veckans erbjudanden i ${activeLocation.name}`
            : "Veckans erbjudanden"}
        </h1>
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
      (view.selectedStoreIds === null ||
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
  const groupedOffers = aggregateOffers(matchingOffers);
  const sortedOffers = sortOfferGroups(groupedOffers, view.sortOrder);
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
  const selectLocation = (locationId: string) => {
    const nextAddress = new URL(window.location.href);
    nextAddress.searchParams.set("location", locationId);
    window.history.pushState(
      {},
      "",
      `${nextAddress.pathname}${nextAddress.search}${nextAddress.hash}`,
    );
    setRequestedLocationId(locationId);
  };

  return (
    <main className="app-shell">
      <a className="skip-link" href="#erbjudanden">Till erbjudandena</a>
      <div className="masthead">
        <a className="wordmark" href={import.meta.env.BASE_URL} aria-label="Matkollen startsida">
          <span className="wordmark-symbol" aria-hidden="true">m.</span>
          Matkollen
        </a>
        <span className="masthead-note">Ditt lokala reklamblad</span>
      </div>
      <header className="page-header">
        <div className="header-copy">
          <p className="eyebrow">God mat. Smarta köp.</p>
          <h1 aria-label={`Veckans erbjudanden i ${snapshot.location.name}`}>
            Veckans <span>erbjudanden.</span>
          </h1>
          <p className="header-intro">Alla dina matbutiker. Ett reklamblad.</p>
          <p className="location-label">Utvalt för {snapshot.location.name}</p>
          {locations.length > 1 && (
            <label className="location-picker">
              Plats
              <select
                aria-label="Plats"
                onChange={(event) => selectLocation(event.target.value)}
                value={snapshot.location.id}
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="updated-at">
            Senast uppdaterad {formatTimestamp(snapshot.generatedAt)}
          </p>
        </div>
        <div className="cover-stamp" aria-hidden="true">
          <span>Samla veckans</span>
          <strong>matfynd!</strong>
          <span>ICA · Coop · Hemköp</span>
        </div>
      </header>

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
        <div className="filter-toolbar">
          <div className="search-field">
            <label htmlFor="offer-search">Sök på produkt eller varumärke</label>
            <input
              id="offer-search"
              type="search"
              value={view.searchText}
              onChange={(event) =>
                setView((current) =>
                  current ? { ...current, searchText: event.target.value } : current,
                )
              }
              placeholder="Vad är du sugen på?"
            />
          </div>
          <StorePicker
            stores={availableStores}
            selectedStoreIds={view.selectedStoreIds}
            onChange={(selectedStoreIds) =>
              setView((current) => current ? { ...current, selectedStoreIds } : current)
            }
          />
          <button className="reset-filters" type="button" onClick={resetFilters}>
            Rensa filter
          </button>
        </div>
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
                      let selectedStoreIds = current.selectedStoreIds;
                      if (selectedStoreIds && selectedStoreIds.length > 0) {
                        const retained = selectedStoreIds.filter((id) => availableStoreIds.has(id));
                        selectedStoreIds = retained.length > 0 ? retained : null;
                      }
                      return {
                        ...current,
                        selectedChains: nextChains,
                        selectedStoreIds,
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
      </section>

      <div className="results-toolbar">
        <div>
          <p className="eyebrow">Hitta dina favoriter</p>
          <p className="offer-count" aria-live="polite">
            {groupedOffers.length} {groupedOffers.length === 1 ? "erbjudande" : "erbjudanden"}
          </p>
        </div>
        <label className="sort-control">
          <span>Sortera efter</span>
          <select
            value={view.sortOrder}
            onChange={(event) => {
              const sortOrder = event.target.value === "discount" ? "discount" : "price";
              setView((current) => current ? { ...current, sortOrder } : current);
            }}
          >
            <option value="price">Lägsta pris</option>
            <option value="discount">Störst rabatt (%)</option>
          </select>
        </label>
      </div>
      <div id="erbjudanden" tabIndex={-1}>
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
            {sortedOffers.map((group) => (
              <OfferCard
                key={group.key}
                group={group}
                stores={group.storeIds
                  .map((id) => ({ id, name: storeNames.get(id) ?? "Okänd butik" }))
                  .sort((a, b) => a.name.localeCompare(b.name, "sv"))}
                stale={staleChains.has(group.offer.chain)}
              />
            ))}
          </section>
        )}
      </div>
      <footer className="page-footer">
        <span className="footer-wordmark">Matkollen.</span>
        <p>Ett oberoende reklamblad för din vardag. Se butikens villkor för varje erbjudande.</p>
      </footer>
    </main>
  );
}
