/**
 * Seed Firestore with a few sample businesses.
 *
 * Usage (with emulator running):
 *   node seedBusinesses.js
 *
 * Usage (against real project):
 *   set FIREBASE_PROJECT_ID=your-project-id
 *   node seedBusinesses.js
 */

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID || "demo-perx",
});

const db = getFirestore();

async function main() {
  const businesses = [
    {
      id: "cafe_1",
      name: "Perx Coffee",
      latitude: 37.785834,
      longitude: -122.406417,
      radiusMeters: 200,
      rewardCents: 50,
      cooldownSeconds: 600,
      dailyCapCents: 200,
      minSpendCents: 500,
      claimTtlSeconds: 60 * 60 * 24 * 7,
      active: true,
    },
    {
      id: "pizza_1",
      name: "Perx Pizza",
      latitude: 37.781,
      longitude: -122.41,
      radiusMeters: 220,
      rewardCents: 100,
      cooldownSeconds: 600,
      dailyCapCents: 300,
      minSpendCents: 1200,
      claimTtlSeconds: 60 * 60 * 24 * 7,
      active: true,
    },
    {
      id: "shop_1",
      name: "Perx Shop",
      latitude: 37.788,
      longitude: -122.402,
      radiusMeters: 180,
      rewardCents: 25,
      cooldownSeconds: 600,
      dailyCapCents: 100,
      minSpendCents: 0,
      claimTtlSeconds: 60 * 60 * 24 * 3,
      active: true,
    },
  ];

  for (const b of businesses) {
    await db.collection("businesses").doc(b.id).set(b, { merge: true });
  }

  console.log(`Seeded ${businesses.length} businesses.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

