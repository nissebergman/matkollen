import { HEMKOP_SOURCE_ADAPTER, type HemkopLocation } from "./job";

export const LINKOPING_HEMKOP: HemkopLocation = {
  id: "linkoping",
  name: "Linköping",
  city: "Linköping",
};

export const LINKOPING_SNAPSHOT_ADAPTERS = [HEMKOP_SOURCE_ADAPTER] as const;
