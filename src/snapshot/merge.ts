import {
  CHAINS,
  SnapshotSchema,
  type Snapshot,
} from "../domain/snapshot";

export function mergeChainSnapshot(
  previous: Snapshot | undefined,
  refreshed: Snapshot,
): Snapshot {
  if (previous && previous.location.id !== refreshed.location.id) {
    throw new Error("Snapshots för olika Locations kan inte slås ihop.");
  }

  const updatedChains = new Set(refreshed.chains.map(({ chain }) => chain));
  const chains = [
    ...(previous?.chains.filter(({ chain }) => !updatedChains.has(chain)) ?? []),
    ...refreshed.chains,
  ].sort((left, right) => CHAINS.indexOf(left.chain) - CHAINS.indexOf(right.chain));

  return SnapshotSchema.parse({
    ...refreshed,
    chains,
    stores: [
      ...(previous?.stores.filter((store) => !updatedChains.has(store.chain)) ?? []),
      ...refreshed.stores,
    ],
    offers: [
      ...(previous?.offers.filter((offer) => !updatedChains.has(offer.chain)) ?? []),
      ...refreshed.offers,
    ],
  });
}
