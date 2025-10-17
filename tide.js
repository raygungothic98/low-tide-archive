// tide.js  —  Netlify Serverless Function
// Fetches live tide data for Sand Heads (07745), Fraser River delta.
// Falls back to a sinusoidal simulated tide if the API is unreachable.

import fetch from "node-fetch";

export default async (req, res) => {
  const stationCode = "07745"; // Sand Heads, BC
  const hours = 6;             // last 6 hours of water-level data
  const end = new Date().toISOString();
  const start = new Date(Date.now() - hours * 3600e3).toISOString();

  const url =
    `https://api-iwls.dfo-mpo.gc.ca/api/v1/data?code=${stationCode}` +
    `&parameter=wlo&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;

  try {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0)
      throw new Error("No data returned");

    const values = data
      .map(d => parseFloat(d.v))
      .filter(v => Number.isFinite(v));

    const min = Math.min(...values);
    const max = Math.max(...values);
    const latest = values[values.length - 1];
    const normalized = (latest - min) / (max - min || 1); // 0..1

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({
      station: {
        code: stationCode,
        name: "Sand Heads (Mouth of the Fraser River)",
        provider: "DFO IWLS",
      },
      height_m: latest,
      range_m: { min, max },
      normalized,
      simulated: false,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // graceful fallback: simulate a tide curve
    const simulated = (Math.sin(Date.now() * 0.0001) + 1) * 0.5;
    return res.status(200).json({
      station: {
        code: stationCode,
        name: "Sand Heads (Simulated)",
        provider: "Fallback sine wave",
      },
      height_m: null,
      range_m: { min: 0, max: 0 },
      normalized: simulated,
      simulated: true,
      timestamp: new Date().toISOString(),
    });
  }
};