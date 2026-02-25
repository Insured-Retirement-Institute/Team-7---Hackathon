export interface WatchItem {
  priority: number;
  title: string;
  description: string;
}

export interface ApiResponse {
  summary: string;
  watchItems: Array<WatchItem>;
  beaconReport: any;
}
