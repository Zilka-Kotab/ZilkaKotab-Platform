export type ClaimRefreshInput = {
  claimNumber: string;
  claimText: string;
  claimType: "INDEPENDENT" | "DEPENDENT" | "UNKNOWN";
  dependsOnClaimNumber: string | null;
};

type ExistingClaimVersion = {
  claimNumber: string;
  version: number;
  selectedForMonitoring: boolean;
};

type ClaimRefreshMetadata = {
  patentId: number;
  source: string;
  sourceIdentifier: string;
  retrievedAt: Date;
  createdById: number;
};

type ClaimRefreshInsert = ClaimRefreshInput & ClaimRefreshMetadata & {
  version: number;
  verificationStatus: "PENDING";
  selectedForMonitoring: boolean;
};

export function planClaimRefresh<Existing extends ExistingClaimVersion>(
  existingClaims: Existing[],
  incomingClaims: readonly ClaimRefreshInput[],
  metadata: ClaimRefreshMetadata,
) {
  const currentByNumber = new Map<string, Existing>();
  for (const claim of existingClaims) {
    const current = currentByNumber.get(claim.claimNumber);
    if (!current || claim.version > current.version) currentByNumber.set(claim.claimNumber, claim);
  }

  const newVersions: ClaimRefreshInsert[] = incomingClaims.map((claim) => {
    const existing = currentByNumber.get(claim.claimNumber);
    return {
      ...claim,
      ...metadata,
      version: (existing?.version ?? 0) + 1,
      verificationStatus: "PENDING",
      selectedForMonitoring: existing?.selectedForMonitoring ?? false,
    };
  });

  return {
    priorVersions: [...existingClaims],
    newVersions,
  };
}