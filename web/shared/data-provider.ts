import { ApiResponse } from "./api-types";

interface ApiRequest {
  cusip: string;
  policyDate: string;
}

function normalizeDate(policyDate: string): string {
  // MM/DD/YYYY → YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(policyDate)) {
    const [month, day, year] = policyDate.split("/");
    return `${year}-${month}-${day}`;
  }
  // YYYY/MM/DD → YYYY-MM-DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(policyDate)) {
    return policyDate.replace(/\//g, "-");
  }
  return policyDate;
}

export async function getApiResponse(cusip: string, policyDate: string): Promise<ApiResponse> {
  const formattedDate = normalizeDate(policyDate);
  const url = new URL(
    "https://mi3se4bxrc.execute-api.us-east-1.amazonaws.com/prod/api/beacon"
  );

  url.searchParams.set("cusip", cusip);
  url.searchParams.set("policyDate", formattedDate);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Beacon API request failed (${response.status})`);
  }

  const raw = await response.json();

  return {
    summary: raw.summary,
    watchItems: raw.watchItems ?? [],
    beaconReport: raw.beaconData ?? null,
    beaconReportLink: raw.beaconReportLink ?? null,
  };
}
