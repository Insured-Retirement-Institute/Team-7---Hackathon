import fs from "fs";
import path from "path";
import { ApiResponse } from "./api-types";

interface ApiRequest {
  cusip: string;
  policyDate: string;
}

function normalizeDate(policyDate: string): string {
  // Convert MM/DD/YYYY → YYYY-MM-DD if needed
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(policyDate)) {
    const [month, day, year] = policyDate.split("/");
    return `${year}-${month}-${day}`;
  }
  return policyDate;
}

export function getApiResponse(cusip: string, policyDate: string): ApiResponse {
  const formattedDate = normalizeDate(policyDate);
  const fileName = `beacon-${cusip}-${formattedDate}.json`;
  const filePath = path.resolve(process.cwd(), "../data", fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Beacon file not found: ${fileName}`);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  return {
    summary: raw.summary,
    watchItems: raw.watchItems ?? [],
    beaconReport: raw.beaconData ?? null,
  };
}
