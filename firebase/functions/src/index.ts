import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import crypto from "node:crypto";

initializeApp();

const db = getFirestore();

type ClaimPerxRequest = {
  businessId: string;
  clientLocation?: { latitude: number; longitude: number };
  clientTimestamp?: number;
};

type CreateRedemptionRequest = {
  businessId: string;
  amountCents: number;
};

type FinalizeRedemptionRequest = {
  redemptionCode: string;
  purchaseTotalCents: number;
};

function requireAuth(context: { auth?: { uid: string } | null }) {
  if (!context.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  return context.auth.uid;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function dayKeyForTimezone(date: Date, timezone?: string) {
  // MVP: rely on UTC day keys. If you store timezone later, format with it.
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function randomCode(): string {
  // 10 chars base32-ish for cashier entry; not guessable like PERX-####.
  const buf = crypto.randomBytes(8);
  return buf.toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export const claimPerx = onCall<ClaimPerxRequest>(async (request) => {
  const uid = requireAuth(request);
  const businessId = (request.data?.businessId ?? "").trim();
  if (!businessId) {
    throw new HttpsError("invalid-argument", "businessId is required.");
  }

  const businessRef = db.collection("businesses").doc(businessId);
  const userRef = db.collection("users").doc(uid);
  const claimAttemptRef = userRef.collection("claimAttempts").doc(businessId);

  const claimedAt = nowSeconds();

  const result = await db.runTransaction(async (tx) => {
    const [businessSnap, userSnap, attemptSnap] = await Promise.all([
      tx.get(businessRef),
      tx.get(userRef),
      tx.get(claimAttemptRef),
    ]);

    if (!businessSnap.exists) {
      throw new HttpsError("not-found", "Business not found.");
    }

    const business = businessSnap.data() as any;
    if (!business.active) {
      throw new HttpsError("failed-precondition", "Business is not active.");
    }

    const rewardCents = Number(business.rewardCents ?? 0);
    if (!Number.isFinite(rewardCents) || rewardCents <= 0) {
      throw new HttpsError("failed-precondition", "Business reward is not configured.");
    }

    // Anti-abuse policy (MVP defaults)
    const cooldownSeconds = Number(business.cooldownSeconds ?? 60 * 10); // 10 min default
    const dailyCapCents = Number(business.dailyCapCents ?? rewardCents * 4); // 4x claims/day default

    const lastClaimedAt = Number(attemptSnap.exists ? attemptSnap.data()?.lastClaimedAt : 0) || 0;
    if (claimedAt - lastClaimedAt < cooldownSeconds) {
      return {
        ok: false,
        reason: "cooldown",
        cooldownRemainingSeconds: Math.max(0, cooldownSeconds - (claimedAt - lastClaimedAt)),
      };
    }

    const todayKey = dayKeyForTimezone(new Date(), business.timezone);
    const dayTotalByKey = (attemptSnap.exists ? (attemptSnap.data()?.dayTotals ?? {}) : {}) as Record<
      string,
      number
    >;
    const todayTotal = Number(dayTotalByKey[todayKey] ?? 0) || 0;
    if (todayTotal + rewardCents > dailyCapCents) {
      return { ok: false, reason: "dailyCap" };
    }

    // Ensure user doc exists.
    if (!userSnap.exists) {
      tx.create(userRef, {
        createdAt: FieldValue.serverTimestamp(),
        perxBalanceCents: 0,
      });
    }

    const claimCode = randomCode();
    const claimId = `${businessId}_${uid}_${claimedAt}_${crypto.randomBytes(3).toString("hex")}`;
    const claimRef = userRef.collection("claims").doc(claimId);

    const expiresAt = claimedAt + Number(business.claimTtlSeconds ?? 60 * 60 * 24 * 7); // 7 days default

    tx.create(claimRef, {
      businessId,
      businessName: String(business.name ?? "Unknown"),
      rewardCents,
      claimedAt,
      expiresAt,
      status: "active",
      redemptionCodeHash: hashCode(claimCode),
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.set(
      attemptSnap.ref,
      {
        lastClaimedAt: claimedAt,
        dayTotals: {
          ...dayTotalByKey,
          [todayKey]: todayTotal + rewardCents,
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(
      userRef,
      {
        perxBalanceCents: FieldValue.increment(rewardCents),
        lastSeenAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      ok: true,
      claim: {
        id: claimId,
        businessId,
        businessName: String(business.name ?? "Unknown"),
        rewardCents,
        claimedAt,
        expiresAt,
        redemptionCode: claimCode,
      },
    };
  });

  return result;
});

export const createRedemption = onCall<CreateRedemptionRequest>(async (request) => {
  const uid = requireAuth(request);
  const businessId = (request.data?.businessId ?? "").trim();
  const amountCents = Number(request.data?.amountCents ?? 0);
  if (!businessId || !Number.isFinite(amountCents) || amountCents <= 0) {
    throw new HttpsError("invalid-argument", "businessId and positive amountCents are required.");
  }

  const businessRef = db.collection("businesses").doc(businessId);
  const userRef = db.collection("users").doc(uid);

  const createdAt = nowSeconds();
  const expiresAt = createdAt + 60 * 5; // 5 minutes

  const redemptionCode = randomCode();
  const redemptionId = `${businessId}_${uid}_${createdAt}_${crypto.randomBytes(3).toString("hex")}`;
  const redemptionRef = db.collection("redemptions").doc(redemptionId);

  await db.runTransaction(async (tx) => {
    const [businessSnap, userSnap] = await Promise.all([tx.get(businessRef), tx.get(userRef)]);
    if (!businessSnap.exists) throw new HttpsError("not-found", "Business not found.");
    const business = businessSnap.data() as any;
    if (!business.active) throw new HttpsError("failed-precondition", "Business is not active.");

    const minSpendCents = Number(business.minSpendCents ?? 0);
    const balance = Number(userSnap.exists ? userSnap.data()?.perxBalanceCents : 0) || 0;

    if (amountCents > balance) throw new HttpsError("failed-precondition", "Insufficient balance.");
    if (minSpendCents > 0 && amountCents <= 0) {
      throw new HttpsError("failed-precondition", "Invalid redemption amount.");
    }

    tx.create(redemptionRef, {
      uid,
      businessId,
      businessName: String(business.name ?? "Unknown"),
      amountCents,
      minSpendCents,
      status: "created",
      redemptionCodeHash: hashCode(redemptionCode),
      createdAt,
      expiresAt,
      createdAtServer: FieldValue.serverTimestamp(),
    });
  });

  return {
    ok: true,
    redemption: {
      id: redemptionId,
      businessId,
      amountCents,
      expiresAt,
      redemptionCode,
    },
  };
});

export const finalizeRedemption = onCall<FinalizeRedemptionRequest>(async (request) => {
  // MVP assumption: business-side app (or admin) uses Firebase Auth too.
  // You can later restrict this further via custom claims / allowlist.
  requireAuth(request);

  const redemptionCode = (request.data?.redemptionCode ?? "").trim().toUpperCase();
  const purchaseTotalCents = Number(request.data?.purchaseTotalCents ?? 0);
  if (!redemptionCode || !Number.isFinite(purchaseTotalCents) || purchaseTotalCents <= 0) {
    throw new HttpsError("invalid-argument", "redemptionCode and positive purchaseTotalCents are required.");
  }

  const codeHash = hashCode(redemptionCode);
  const now = nowSeconds();

  // Lookup redemption by code hash (MVP: query). For scale, use a dedicated lookup collection.
  const q = await db
    .collection("redemptions")
    .where("redemptionCodeHash", "==", codeHash)
    .where("status", "==", "created")
    .limit(1)
    .get();

  if (q.empty) throw new HttpsError("not-found", "Redemption not found or already finalized.");
  const redemptionSnap = q.docs[0];
  const redemption = redemptionSnap.data() as any;

  if (Number(redemption.expiresAt ?? 0) < now) {
    throw new HttpsError("failed-precondition", "Redemption expired.");
  }

  const minSpendCents = Number(redemption.minSpendCents ?? 0);
  if (minSpendCents > 0 && purchaseTotalCents < minSpendCents) {
    throw new HttpsError("failed-precondition", "Minimum spend not met.");
  }

  const uid = String(redemption.uid ?? "");
  const amountCents = Number(redemption.amountCents ?? 0);
  if (!uid || !Number.isFinite(amountCents) || amountCents <= 0) {
    throw new HttpsError("failed-precondition", "Invalid redemption record.");
  }

  const userRef = db.collection("users").doc(uid);

  await db.runTransaction(async (tx) => {
    const [freshRedemptionSnap, userSnap] = await Promise.all([tx.get(redemptionSnap.ref), tx.get(userRef)]);
    if (!freshRedemptionSnap.exists) throw new HttpsError("not-found", "Redemption not found.");
    const fresh = freshRedemptionSnap.data() as any;
    if (fresh.status !== "created") throw new HttpsError("failed-precondition", "Redemption already finalized.");
    if (Number(fresh.expiresAt ?? 0) < now) throw new HttpsError("failed-precondition", "Redemption expired.");

    const balance = Number(userSnap.exists ? userSnap.data()?.perxBalanceCents : 0) || 0;
    if (balance < amountCents) throw new HttpsError("failed-precondition", "Insufficient balance.");

    tx.set(
      userRef,
      {
        perxBalanceCents: FieldValue.increment(-amountCents),
        lastSeenAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(
      freshRedemptionSnap.ref,
      {
        status: "redeemed",
        redeemedAt: now,
        redeemedAtServer: FieldValue.serverTimestamp(),
        purchaseTotalCents,
      },
      { merge: true }
    );
  });

  return { ok: true };
});

