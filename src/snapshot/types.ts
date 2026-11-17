export interface LocationConfig {
  id: string;
  name: string;
  city: string;
}

export interface SnapshotJobDependencies {
  fetcher?: typeof fetch;
  now?: () => Date;
  sleep?: (milliseconds: number) => Promise<void>;
  previousSnapshot?: unknown;
}
