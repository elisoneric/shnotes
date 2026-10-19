import { ensureSeedData } from "../src/lib/seed";

async function main() {
  console.log("Seeding Enterprise SHNotes data...");
  await ensureSeedData();
  console.log("Seed finished successfully.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  });
