import { RequestHandler } from "express";
import { getApiResponse } from "../../shared/data-provider";

export const handleBeacon: RequestHandler = (req, res) => {
  const { cusip, policyDate } = req.params;

  try {
    const data = getApiResponse(cusip, policyDate);
    res.json(data);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
};
