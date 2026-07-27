import {
    Prisma,
} from "@prisma/client";

import {
    evaluatePtProximity,
    PT_ALERT_FLAG_TYPE,
    type PtAlertTargetKind,
} from "@/lib/alerts/pt-proximity";

import { prisma } from "@/lib/prisma";

import {
    getSystemFlagUserId,
} from "@/lib/reconciliation/trade-reconciliation-service";

export type EvaluateSecurityPtAlertsInput = {
    securityId: string;
    ticker: string;
    currentPrice: number;
    marketDataSource?: string | null;
    marketDataAsOf: Date;
};

export type EvaluateSecurityPtAlertsResult = {
    evaluatedCount: number;
    withinRangeCount: number;
    createdCount: number;
    skippedDuplicateCount: number;
    skippedNoUserCount: number;
    createdFlagIds: string[];
};

type PtTargetCandidate = {
    targetKind: PtAlertTargetKind;
    targetPrice: number;
};

function getTargetCandidates(
    entry: {
        targetPrice: number | null;
        entryTargetPrice: number | null;
        exitTargetPrice: number | null;
    }
): PtTargetCandidate[] {
    const candidates: PtTargetCandidate[] = [];

    const entryTargetPrice =
        entry.entryTargetPrice ??
        entry.targetPrice;

    if (
        entryTargetPrice != null &&
        Number.isFinite(
            Number(entryTargetPrice)
        ) &&
        Number(entryTargetPrice) > 0
    ) {
        candidates.push({
            targetKind: "ENTRY",
            targetPrice:
                Number(entryTargetPrice),
        });
    }

    if (
        entry.exitTargetPrice != null &&
        Number.isFinite(
            Number(entry.exitTargetPrice)
        ) &&
        Number(entry.exitTargetPrice) > 0
    ) {
        candidates.push({
            targetKind: "EXIT",
            targetPrice:
                Number(entry.exitTargetPrice),
        });
    }

    return candidates;
}

function buildDescription({
    ticker,
    targetLabel,
    currentPrice,
    targetPrice,
    distancePercent,
}: {
    ticker: string;
    targetLabel: string;
    currentPrice: number;
    targetPrice: number;
    distancePercent: number;
}) {
    return `${ticker} is within ${distancePercent.toFixed(
        2
    )}% of its ${targetLabel}. Current price: $${currentPrice.toFixed(
        2
    )}. Target price: $${targetPrice.toFixed(
        2
    )}.`;
}

export async function evaluateSecurityPtAlerts({
    securityId,
    ticker,
    currentPrice,
    marketDataSource,
    marketDataAsOf,
}: EvaluateSecurityPtAlertsInput): Promise<EvaluateSecurityPtAlertsResult> {
    const result:
        EvaluateSecurityPtAlertsResult = {
        evaluatedCount: 0,
        withinRangeCount: 0,
        createdCount: 0,
        skippedDuplicateCount: 0,
        skippedNoUserCount: 0,
        createdFlagIds: [],
    };

    const watchlistEntries =
        await prisma.watchlistEntry.findMany({
            where: {
                securityId,
                archivedAt: null,
                OR: [
                    {
                        entryTargetPrice: {
                            not: null,
                        },
                    },
                    {
                        targetPrice: {
                            not: null,
                        },
                    },
                    {
                        exitTargetPrice: {
                            not: null,
                        },
                    },
                ],
            },
            select: {
                id: true,
                securityId: true,
                side: true,
                targetPrice: true,
                entryTargetPrice: true,
                exitTargetPrice: true,
            },
        });

    if (!watchlistEntries.length) {
        return result;
    }

    const systemUserId =
        await getSystemFlagUserId();

    for (
        const entry
        of watchlistEntries
    ) {
        if (
            entry.side !== "LONG" &&
            entry.side !== "SHORT"
        ) {
            continue;
        }

        const candidates =
            getTargetCandidates(entry);

        for (
            const candidate
            of candidates
        ) {
            result.evaluatedCount += 1;

            const evaluation =
                evaluatePtProximity({
                    context: "WATCHLIST",
                    contextId: entry.id,
                    securityId,
                    ticker,
                    side: entry.side,
                    targetKind:
                        candidate.targetKind,
                    targetPrice:
                        candidate.targetPrice,
                    currentPrice,
                    marketDataSource,
                    marketDataAsOf,
                });

            if (
                !evaluation.isEligible ||
                !evaluation
                    .isWithinTriggerRange ||
                !evaluation.alertKey ||
                evaluation.targetPrice == null ||
                evaluation.currentPrice == null ||
                evaluation.distancePercent ==
                null
            ) {
                continue;
            }

            const alertKey =
                evaluation.alertKey;

            const evaluatedTargetPrice =
                evaluation.targetPrice;

            const evaluatedCurrentPrice =
                evaluation.currentPrice;

            const evaluatedDistancePercent =
                evaluation.distancePercent;

            result.withinRangeCount += 1;

            if (!systemUserId) {
                result.skippedNoUserCount += 1;
                continue;
            }

            const duplicateSearchValue =
                `"alertKey":"${alertKey}"`;

            const createdFlag =
                await prisma.$transaction(
                    async (
                        tx: Prisma.TransactionClient
                    ) => {
                        const existingFlag =
                            await tx.flag.findFirst({
                                where: {
                                    flagType:
                                        PT_ALERT_FLAG_TYPE,
                                    metadataJson: {
                                        contains:
                                            duplicateSearchValue,
                                    },
                                },
                                select: {
                                    id: true,
                                },
                            });

                        if (existingFlag) {
                            return null;
                        }

                        const metadata = {
                            alertKey,
                            alertType:
                                "PT_PROXIMITY",
                            context:
                                "WATCHLIST",
                            contextId:
                                entry.id,
                            watchlistEntryId:
                                entry.id,
                            positionId: null,
                            securityId,
                            ticker,
                            side:
                                entry.side,
                            targetKind:
                                candidate.targetKind,
                            targetLabel:
                                evaluation.targetLabel,
                            targetPrice:
                                evaluatedTargetPrice,
                            currentPrice:
                                evaluatedCurrentPrice,
                            distancePercent:
                                evaluatedDistancePercent,
                            triggerPercent:
                                evaluation.triggerPercent,
                            marketDataSource:
                                marketDataSource ||
                                null,
                            marketDataAsOf:
                                marketDataAsOf.toISOString(),
                            triggeredAt:
                                new Date().toISOString(),
                        };

                        const flag =
                            await tx.flag.create({
                                data: {
                                    securityId,
                                    watchlistEntryId:
                                        entry.id,
                                    positionId: null,
                                    flagType:
                                        PT_ALERT_FLAG_TYPE,
                                    description:
                                        buildDescription({
                                            ticker,
                                            targetLabel:
                                                evaluation.targetLabel,
                                            currentPrice:
                                                evaluatedCurrentPrice,
                                            targetPrice:
                                                evaluatedTargetPrice,
                                            distancePercent:
                                                evaluatedDistancePercent,
                                        }),
                                    reminderAt: null,
                                    priority: "HIGH",
                                    status: "OPEN",
                                    createdById:
                                        systemUserId,
                                    metadataJson:
                                        JSON.stringify(
                                            metadata
                                        ),
                                },
                            });

                        await tx.auditLog.create({
                            data: {
                                actorId:
                                    systemUserId,
                                action:
                                    "PT_PROXIMITY_ALERT_CREATED",
                                entityType:
                                    "FLAG",
                                entityId:
                                    flag.id,
                                newValueJson:
                                    JSON.stringify({
                                        flagId:
                                            flag.id,
                                        ...metadata,
                                    }),
                            },
                        });

                        return flag;
                    }
                );

            if (!createdFlag) {
                result.skippedDuplicateCount += 1;
                continue;
            }

            result.createdCount += 1;

            result.createdFlagIds.push(
                createdFlag.id
            );
        }
    }

    return result;
}