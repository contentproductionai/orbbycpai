import { neon } from "@neondatabase/serverless";
import * as fs from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const sql = neon(DATABASE_URL);

// Find the most recent HubSpot brand profile
const rows = await sql`
  SELECT domain, brand_profile, scraped_at
  FROM brands
  WHERE domain ILIKE '%hubspot%'
  ORDER BY scraped_at DESC
  LIMIT 1
`;

if (rows.length === 0) {
  // Try generations table
  const genRows = await sql`
    SELECT brand_url, brand_profile, created_at
    FROM generations
    WHERE brand_url ILIKE '%hubspot%'
      AND brand_profile IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (genRows.length === 0) {
    console.log("No HubSpot profile found in brands or generations tables");
    process.exit(1);
  }
  console.log("Found in generations table, created:", genRows[0].created_at);
  fs.writeFileSync("/tmp/hubspot-profile.json", JSON.stringify(genRows[0].brand_profile, null, 2));
  console.log("Saved to /tmp/hubspot-profile.json");
} else {
  console.log("Found in brands table, scraped:", rows[0].scraped_at);
  fs.writeFileSync("/tmp/hubspot-profile.json", JSON.stringify(rows[0].brand_profile, null, 2));
  console.log("Saved to /tmp/hubspot-profile.json");
}
