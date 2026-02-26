import { RequestHandler } from "express";
import { getApiResponse } from "../../shared/data-provider";

export const handleBeacon: RequestHandler = async (req, res) => {
  const { cusip, policyDate } = req.params;

  try {
    const data = await getApiResponse(cusip, policyDate);
    res.json(data);
  } catch (err: any) {
    console.error(`[beacon] Error for ${cusip}/${policyDate}:`, err.message);
    res.status(404).json({ error: err.message });
  }
};
