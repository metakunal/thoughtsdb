import { searchSaves } from "../lib/search.js";

export default async function handler(req, res) {
  const { q, userId } = req.query;
  if (!q || !userId) return res.status(400).json({ error: "Missing params" });

  const results = await searchSaves(userId, q);
  return res.status(200).json({ results });
}