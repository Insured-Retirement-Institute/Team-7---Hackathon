import { RequestHandler } from "express";
import { getApiResponse } from "../../shared/data-provider";

export const handleBeacon: RequestHandler = async (req, res) => {
  const { cusip, policyDate } = req.params;

  if (!cusip || !policyDate) {
    return res.status(400).json({ error: "Missing cusip or policyDate" });
  }

  try {
    const data = await getApiResponse(cusip, policyDate);
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err?.message ?? "Failed to fetch beacon data" });
  }
};
