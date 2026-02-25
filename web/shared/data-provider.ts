import { ApiResponse } from "./api-types";

const BEACON_API = "https://mi3se4bxrc.execute-api.us-east-1.amazonaws.com/prod/api/beacon";
const AI_API = "https://mi3se4bxrc.execute-api.us-east-1.amazonaws.com/prod/ai";

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

  // 1. Fetch the beacon report
  const beaconUrl = `${BEACON_API}?cusip=${encodeURIComponent(cusip)}&policyDate=${encodeURIComponent(formattedDate)}`;
  console.log(`[data-provider] Fetching beacon: ${beaconUrl}`);
  const beaconRes = await fetch(beaconUrl);
  if (!beaconRes.ok) {
    const body = await beaconRes.text().catch(() => "");
    throw new Error(`Beacon API ${beaconRes.status}: ${body}`);
  }
  const rawBeacon = await beaconRes.json();
  const beaconData = typeof rawBeacon === "string" ? JSON.parse(rawBeacon) : rawBeacon;
  console.log(`[data-provider] Beacon response received`);

  // 2. Send the beacon report to the AI API to get summary + watch items
  console.log(`[data-provider] Calling AI API`);
  const aiRes = await fetch(AI_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product: JSON.stringify(beaconData) }),
  });
  if (!aiRes.ok) {
    const body = await aiRes.text().catch(() => "");
    throw new Error(`AI API ${aiRes.status}: ${body}`);
  }
  const aiData = await aiRes.json();
  console.log(`[data-provider] AI response received:`, JSON.stringify(aiData).slice(0, 200));

  return {
    summary: aiData.summary ?? "",
    watchItems: aiData.watchItems ?? [],
    beaconReport: beaconData,
    beaconReportLink: beaconData.beaconReportLink ?? null,
  };
}
