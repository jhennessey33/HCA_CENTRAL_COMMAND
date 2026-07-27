import { NextResponse } from "next/server";
import { parseWellsTransactionActivityCsv } from "@/lib/ingestion/wells-transaction-activity";
import { prisma } from "@/lib/prisma";
import { detectWellsReportType } from "@/lib/ingestion/wells-detect-report";
import { parseWellsTaxLotCsv } from "@/lib/ingestion/wells-tax-lot";
import { matchManualTrade } from "@/lib/reconciliation/trade-reconciliation";
import {
  createTradeReconciliationFlag,
  getSystemFlagUserId,
} from "@/lib/reconciliation/trade-reconciliation-service";
import {
  RECONCILIATION_STATUS,
  TRADE_SOURCES,
} from "@/lib/reconciliation/trade-reconciliation-constants";


function normalizeFilename(filename: string): string {
  return filename.replace(/\s+/g, "_").trim();
}

function isRawPdfContent(content: string): boolean {
  return content.trimStart().startsWith("%PDF-");
}





async function completeIngestionRun(params: {
  id: string;
  status: string;
  message: string;
  rowsProcessed?: number;
  rowsFailed?: number;
  sourceReportDate?: Date;
  accountNumber?: string;
  details?: unknown;
}) {
  const {
    id,
    status,
    message,
    rowsProcessed = 0,
    rowsFailed = 0,
    sourceReportDate,
    accountNumber,
    details,
  } = params;

  await prisma.ingestionRun.update({
    where: { id },
    data: {
      status,
      message,
      rowsProcessed,
      rowsFailed,
      sourceReportDate,
      accountNumber,
      detailsJson: details ? JSON.stringify(details) : undefined,
      endedAt: new Date(),
    },
  });
}

export async function POST(request: Request) {
  let ingestionRunId: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const fileName = normalizeFilename(file.name);
    const fileType = file.type || "text/plain";
    const rawContent = await file.text();

    const ingestionRun = await prisma.ingestionRun.create({
      data: {
        source: "WELLS_FARGO",
        status: "STARTED",
        message: `Wells Fargo ingestion started for ${fileName}`,
        fileName,
        fileType,
      },
    });

    ingestionRunId = ingestionRun.id;

    if (isRawPdfContent(rawContent)) {
      await completeIngestionRun({
        id: ingestionRun.id,
        status: "FAILED",
        message:
          "Raw PDF upload detected. PDF text extraction is required before Wells ingestion.",
        rowsProcessed: 0,
        rowsFailed: 1,
        details: {
          reason:
            "Raw PDF upload is not supported yet. Run pdftotext -layout and upload the extracted .txt file.",
        },
      });

      return NextResponse.json(
        {
          error: "PDF_TEXT_EXTRACTION_REQUIRED",
          message:
            "Raw PDF upload is not supported yet. Run pdftotext -layout and upload the extracted .txt file.",
        },
        { status: 400 }
      );
    }

    const reportType = detectWellsReportType(rawContent);

    if (reportType === "UNKNOWN") {
      await completeIngestionRun({
        id: ingestionRun.id,
        status: "FAILED",
        message: "Unrecognized Wells report type.",
        rowsProcessed: 0,
        rowsFailed: 1,
        details: {
          reason: "Report type detection returned UNKNOWN.",
        },
      });

      return NextResponse.json(
        { error: "Unrecognized Wells report type.", reportType },
        { status: 400 }
      );
    }

    if (
    reportType === "CHANGE_IN_EQUITY_PERFORMANCE" ||
    reportType === "PORTFOLIO_RISK_EXPOSURE"
  ) {
      await completeIngestionRun({
        id: ingestionRun.id,
        status: "COMPLETED",
        message: `Detected report type ${reportType}, ingestion not implemented for this milestone.`,
        rowsProcessed: 0,
        rowsFailed: 0,
        
        details: {
          reason: "Report type detected but intentionally deferred.",
        },

      });

      return NextResponse.json(
        {
          source: "WELLS_FARGO",
          reportType,
          message: "NOT_IMPLEMENTED_FOR_THIS_REPORT_TYPE",
        },
        { status: 200 }
      );
    }

    let rowsProcessed = 0;
    let rowsFailed = 0;
    let securitiesCreated = 0;
    let securitiesUpdated = 0;

    const newlyCreatedSecurities: {
      id: string;
      ticker: string;
      name: string;
    }[] = [];

    let positionsCreated = 0;
    let positionsClosed = 0;
    let positionsUpdated = 0;
    let tradesCreated = 0;
    let tradesUpdated = 0;
    let taxLotsCreated = 0;
    let taxLotsUpdated = 0;

    let resolvedSourceReportDate =
      new Date();

    const failures: string[] = [];

    if (reportType === "TAX_LOT_POSITION_PNL") {
      
      const {
        rows,
        positions,
        taxLots,
        failures: parseFailures,
      } = parseWellsTaxLotCsv(rawContent, fileName);


      
      rowsProcessed += rows.length;
      rowsFailed += parseFailures.length;
      failures.push(...parseFailures);

      const activeWellsPositionKeys = new Set<string>();
      const accountsInPositionSnapshot = new Set<string>();
      const positionSnapshotDates: Date[] = [];

      for (const position of positions) {

        if (!position.accountNumber) {
          rowsFailed += 1;
          failures.push(
            `Missing accountNumber for aggregated position ${position.securityName}`
          );
          continue;
        }

        if (!position.ticker) {
          rowsFailed += 1;
          failures.push(
            `Missing ticker for aggregated position ${position.securityName}`
          );
          continue;
        }

        let security = await prisma.security.findUnique({
          where: { ticker: position.ticker },
        });

        if (!security) {
          security = await prisma.security.create({
            data: {
              ticker: position.ticker,
              name: position.securityName,
              securityType: position.productType,
            },
          });
          newlyCreatedSecurities.push({
            id: security.id,
            ticker: security.ticker,
            name: security.name,
          });
          securitiesCreated += 1;
        } else {
          await prisma.security.update({
            where: { id: security.id },
            data: {
              name: security.name || position.securityName,
              securityType: security.securityType || position.productType,
            },
          });

          securitiesUpdated += 1;
        }

        const sourceReportDate = position.sourceReportDate
          ? new Date(position.sourceReportDate)
          : new Date();

        activeWellsPositionKeys.add(`${security.id}:${position.accountNumber}`);
        accountsInPositionSnapshot.add(position.accountNumber);
        positionSnapshotDates.push(sourceReportDate);


        const positionData = {
          securityId: security.id,
          source: "WELLS_FARGO",
          accountNumber: position.accountNumber,
          custodian: "Wells Fargo",
          costBasis: position.costBasis,
          unrealizedPnl: position.unrealizedPnl,
          sourceReportDate,
          sourceFileName: position.sourceFileName,
          sourceRowHash: position.sourceRowHash,
          ingestionRunId: ingestionRun.id,
          side: position.side,
          status: "ACTIVE",
          shares: position.shares,
          marketValue: position.marketValue,
          wap: position.wap,
          openedAt: position.openedAt ? new Date(position.openedAt) : undefined,
        };

        const existingPosition = await prisma.position.findFirst({
          where: {
            securityId: security.id,
            accountNumber: position.accountNumber,
            status: "ACTIVE",
          },
        });

        if (existingPosition) {
          await prisma.position.update({
            where: { id: existingPosition.id },
            data: positionData,
          });

          positionsUpdated += 1;
        } else {
          await prisma.position.create({
            data: positionData,
          });

          positionsCreated += 1;
        }
      }

      const latestSnapshotDate =
        positionSnapshotDates.length > 0
          ? new Date(
              Math.max(...positionSnapshotDates.map((date) => date.getTime()))
            )
          : new Date();
      resolvedSourceReportDate =
        latestSnapshotDate;

      if (activeWellsPositionKeys.size > 0 && accountsInPositionSnapshot.size > 0) {
        const previouslyActivePositions = await prisma.position.findMany({
          where: {
            source: "WELLS_FARGO",
            status: "ACTIVE",
            accountNumber: {
              in: Array.from(accountsInPositionSnapshot),
            },
          },
          select: {
            id: true,
            securityId: true,
            accountNumber: true,
          },
        });

        for (const existingPosition of previouslyActivePositions) {
          if (!existingPosition.accountNumber) continue;

          const positionKey = `${existingPosition.securityId}:${existingPosition.accountNumber}`;

          if (activeWellsPositionKeys.has(positionKey)) {
            continue;
          }

          await prisma.position.update({
            where: {
              id: existingPosition.id,
            },
            data: {
              status: "CLOSED",
              closedAt: latestSnapshotDate,
              portfolioPct: 0,
              sourceReportDate: latestSnapshotDate,
              sourceFileName: fileName,
              ingestionRunId: ingestionRun.id,
            },
          });

          positionsClosed += 1;
        }
      }

      for (const taxLot of taxLots) {
        if (!taxLot.accountNumber) {
          rowsFailed += 1;
          failures.push(`Missing accountNumber for tax lot ${taxLot.securityName}`);
          continue;
        }

        if (!taxLot.ticker) {
          rowsFailed += 1;
          failures.push(`Missing ticker for tax lot ${taxLot.securityName}`);
          continue;
        }

        let security = await prisma.security.findUnique({
          where: {
            ticker: taxLot.ticker,
          },
        });

        if (!security) {
          security = await prisma.security.create({
            
            data: {
              ticker: taxLot.ticker,
              name: taxLot.securityName,
              securityType: taxLot.productType ?? null,
            },
          });
          newlyCreatedSecurities.push({
            id: security.id,
            ticker: security.ticker,
            name: security.name,
          });
          securitiesCreated += 1;
        } else {
          await prisma.security.update({
            where: {
              id: security.id,
            },
            data: {
              name: security.name || taxLot.securityName,
              securityType: security.securityType || taxLot.productType || null,
            },
          });

          securitiesUpdated += 1;
        }

        const matchingPosition = await prisma.position.findFirst({
          where: {
            securityId: security.id,
            accountNumber: taxLot.accountNumber,
            source: "WELLS_FARGO",
            status: "ACTIVE",
          },
        });

        const existingTaxLot = await prisma.taxLot.findUnique({
          where: {
            sourceRowHash: taxLot.sourceRowHash,
          },
        });

        const taxLotData = {
          securityId: security.id,
          positionId: matchingPosition?.id ?? null,
          accountNumber: taxLot.accountNumber,
          taxLotId: taxLot.taxLotId ?? null,
          taxLotDate: taxLot.taxLotDate ? new Date(taxLot.taxLotDate) : null,
          quantity: taxLot.quantity,
          unitCost: taxLot.unitCost ?? null,
          marketPrice: taxLot.marketPrice ?? null,
          costBasis: taxLot.costBasis,
          marketValue: taxLot.marketValue,
          unrealizedPnl: taxLot.unrealizedPnl,
          roi: taxLot.roi ?? null,
          holdingPeriod: taxLot.holdingPeriod ?? null,
          daysToLongTerm: taxLot.daysToLongTerm ?? null,
          source: "WELLS_FARGO",
          sourceFileName: taxLot.sourceFileName ?? null,
          sourceRowHash: taxLot.sourceRowHash,
          sourceReportDate: taxLot.sourceReportDate
            ? new Date(taxLot.sourceReportDate)
            : null,
          ingestionRunId: ingestionRun.id,
        };

        if (existingTaxLot) {
          await prisma.taxLot.update({
            where: {
              id: existingTaxLot.id,
            },
            data: taxLotData,
          });

          taxLotsUpdated += 1;
        } else {
          await prisma.taxLot.create({
            data: taxLotData,
          });

          taxLotsCreated += 1;
        }
      }

    }

    if (reportType === "TRANSACTION_ACTIVITY") {
        const {
          rows,
          failures: parseFailures,
        } = parseWellsTransactionActivityCsv(rawContent, fileName);

        rowsProcessed += rows.length;
        rowsFailed += parseFailures.length;
        failures.push(...parseFailures);

        const supportedTradeTypes = new Set(["BUY", "SELL", "SHORT", "COVER"]);

        for (const trade of rows) {
          if (!supportedTradeTypes.has(trade.tradeType || "")) {
            continue;
          }

          if (!trade.accountNumber) {
            rowsFailed += 1;
            failures.push(`Missing accountNumber for trade ${trade.transactionId}`);
            continue;
          }

          if (!trade.ticker) {
            rowsFailed += 1;
            failures.push(
              `Missing ticker for trade ${trade.transactionId || trade.securityName}`
            );
            continue;
          }

          if (!trade.tradeDate) {
            rowsFailed += 1;
            failures.push(`Missing tradeDate for trade ${trade.transactionId}`);
            continue;
          }

          if (trade.quantity == null) {
            rowsFailed += 1;
            failures.push(`Missing quantity for trade ${trade.transactionId}`);
            continue;
          }

          let security = await prisma.security.findUnique({
            where: {
              ticker: trade.ticker,
            },
          });

          if (!security) {
            security = await prisma.security.create({
              data: {
                ticker: trade.ticker,
                name: trade.securityName || trade.ticker,
                wellsSecurityId: trade.wfSecId,
                cusip: trade.cusip,
                isin: trade.isin,
                sedol: trade.sedol,
              },
            });
            newlyCreatedSecurities.push({
              id: security.id,
              ticker: security.ticker,
              name: security.name,
            });

            securitiesCreated += 1;
          } else {
            await prisma.security.update({
              where: {
                id: security.id,
              },
              data: {
                name: security.name || trade.securityName || trade.ticker,
                wellsSecurityId: security.wellsSecurityId || trade.wfSecId,
                cusip: security.cusip || trade.cusip,
                isin: security.isin || trade.isin,
                sedol: security.sedol || trade.sedol,
              },
            });

            securitiesUpdated += 1;
          }

          const matchingPosition = await prisma.position.findFirst({
            where: {
              securityId: security.id,
              accountNumber: trade.accountNumber,
              source: "WELLS_FARGO",
              status: "ACTIVE",
            },
          });

          const tradeData = {
            securityId: security.id,
            positionId: matchingPosition?.id,
            dateTraded: new Date(trade.tradeDate),
            shares: trade.quantity,
            avgPrice: trade.price ?? 0,
            tradeType: trade.tradeType,
            settlementDate: trade.settlementDate
              ? new Date(trade.settlementDate)
              : undefined,
            postDate: trade.postDate ? new Date(trade.postDate) : undefined,
            notional:
              trade.price != null && trade.quantity != null
                ? trade.price * trade.quantity
                : undefined,
            commission: trade.commission,
            fees: trade.fees,
            accruedInterest: trade.accruedInterest,
            netAmount: trade.netAmount,
            currency: trade.currency,
            transactionId: trade.transactionId,
            clientReferenceId: trade.clientReferenceId,
            source: "WELLS_FARGO",
            sourceFileName: trade.sourceFileName,
            sourceRowHash: trade.sourceRowHash,
            sourceReportDate: trade.sourceReportDate
              ? new Date(trade.sourceReportDate)
              : undefined,
            ingestionRunId: ingestionRun.id,
          };

          const existingWellsTrade = trade.sourceRowHash
            ? await prisma.trade.findFirst({
                where: {
                  sourceRowHash: trade.sourceRowHash,
                  source: "WELLS_FARGO",
                },
              })
            : null;

          if (
            existingWellsTrade &&
            (
              existingWellsTrade.matchedTradeId ||
              existingWellsTrade.reconciliationStatus ===
                RECONCILIATION_STATUS.MATCHED ||
              existingWellsTrade.reconciliationStatus ===
                RECONCILIATION_STATUS.REVIEW_REQUIRED
            )
          ) {
            await prisma.trade.update({
              where: {
                id: existingWellsTrade.id,
              },
              data: {
                ...tradeData,

                // Preserve completed reconciliation state when
                // the same Wells source row is uploaded again.
                reconciliationStatus:
                  existingWellsTrade.reconciliationStatus,
                reconciliationGroupId:
                  existingWellsTrade.reconciliationGroupId,
                matchedTradeId:
                  existingWellsTrade.matchedTradeId,
                reconciledAt:
                  existingWellsTrade.reconciledAt,
                reconciliationNotes:
                  existingWellsTrade.reconciliationNotes,
                isHidden:
                  existingWellsTrade.isHidden,
              },
            });

            tradesUpdated += 1;
            continue;
          }
          const pendingManualTrades = await prisma.trade.findMany({
            where: {
              securityId: security.id,
              source: "MANUAL",
              reconciliationStatus: "MANUAL_PENDING",
              isHidden: false,
              ...(matchingPosition?.id
                ? {
                    positionId: matchingPosition.id,
                  }
                : {}),
            },
          });

          const matchResult = matchManualTrade({
            manualTrades: pendingManualTrades,
            wellsTrade: {
              tradeType: trade.tradeType,
              dateTraded: new Date(trade.tradeDate),
              shares: trade.quantity,
              avgPrice: trade.price ?? 0,
            },
          });

          if (matchResult.status === "EXACT") {
            const officialTrade = existingWellsTrade
              ? await prisma.trade.update({
                  where: {
                    id: existingWellsTrade.id,
                  },
                  data: {
                    ...tradeData,
                    source: "WELLS_FARGO",
                    reconciliationStatus: "MATCHED",
                    reconciledAt: new Date(),
                    matchedTradeId: matchResult.trade.id,
                    reconciliationNotes: matchResult.reason,
                    isHidden: false,
                  },
                })
              : await prisma.trade.create({
                  data: {
                    ...tradeData,
                    source: "WELLS_FARGO",
                    reconciliationStatus: "MATCHED",
                    reconciledAt: new Date(),
                    matchedTradeId: matchResult.trade.id,
                    reconciliationNotes: matchResult.reason,
                    isHidden: false,
                  },
                });

            await prisma.trade.update({
              where: {
                id: matchResult.trade.id,
              },
              data: {
                reconciliationStatus: "SUPERSEDED_BY_WELLS",
                matchedTradeId: officialTrade.id,
                reconciledAt: new Date(),
                isHidden: true,
                reconciliationNotes: matchResult.reason,
              },
            });

            if (existingWellsTrade) {
              tradesUpdated += 2;
            } else {
              tradesCreated += 1;
              tradesUpdated += 1;
            }

            continue;
          }
          

          if (
            matchResult.status === "PARTIAL"
          ) {
            const officialTrade =
              existingWellsTrade
                ? await prisma.trade.update({
                    where: {
                      id:
                        existingWellsTrade.id,
                    },
                    data: {
                      ...tradeData,
                      source:
                        TRADE_SOURCES
                          .WELLS_FARGO,
                      reconciliationStatus:
                        RECONCILIATION_STATUS
                          .REVIEW_REQUIRED,
                      matchedTradeId:
                        matchResult.trade.id,
                      reconciliationNotes:
                        "Possible partial completion detected. Automatic split is not yet enabled.",
                      isHidden: false,
                    },
                  })
                : await prisma.trade.create({
                    data: {
                      ...tradeData,
                      source:
                        TRADE_SOURCES
                          .WELLS_FARGO,
                      reconciliationStatus:
                        RECONCILIATION_STATUS
                          .REVIEW_REQUIRED,
                      matchedTradeId:
                        matchResult.trade.id,
                      reconciliationNotes:
                        "Possible partial completion detected. Automatic split is not yet enabled.",
                      isHidden: false,
                    },
                  });

            await prisma.trade.update({
              where: {
                id: matchResult.trade.id,
              },
              data: {
                reconciliationStatus:
                  RECONCILIATION_STATUS
                    .REVIEW_REQUIRED,
                matchedTradeId:
                  officialTrade.id,
                reconciliationNotes:
                  "Possible partial completion detected. Automatic split is not yet enabled.",
              },
            });

            const flagUserId =
              await getSystemFlagUserId();

            if (flagUserId) {
              await createTradeReconciliationFlag({
                securityId: security.id,
                positionId:
                  matchingPosition?.id,
                createdById: flagUserId,
                manualTradeId:
                  matchResult.trade.id,
                wellsTradeId:
                  officialTrade.id,
                wellsTransactionId:
                  trade.transactionId,
                ticker:
                  trade.ticker,
                tradeType:
                  trade.tradeType,
                reason:
                  matchResult.reason,
                differences:
                  matchResult.differences,
              });
            } else {
              failures.push(
                `Could not create reconciliation flag for ${
                  trade.ticker ||
                  trade.securityName
                }: no user found.`
              );
            }

            if (existingWellsTrade) {
              tradesUpdated += 2;
            } else {
              tradesCreated += 1;
              tradesUpdated += 1;
            }

            continue;
          }



          if (matchResult.status === "SIMILAR") {
            const officialTrade = existingWellsTrade
              ? await prisma.trade.update({
                  where: {
                    id: existingWellsTrade.id,
                  },
                  data: {
                    ...tradeData,
                    source: "WELLS_FARGO",
                    reconciliationStatus: "REVIEW_REQUIRED",
                    matchedTradeId: matchResult.trade.id,
                    reconciliationNotes: matchResult.reason,
                    isHidden: false,
                  },
                })
              : await prisma.trade.create({
                  data: {
                    ...tradeData,
                    source: "WELLS_FARGO",
                    reconciliationStatus: "REVIEW_REQUIRED",
                    matchedTradeId: matchResult.trade.id,
                    reconciliationNotes: matchResult.reason,
                    isHidden: false,
                  },
                });

            await prisma.trade.update({
              where: {
                id: matchResult.trade.id,
              },
              data: {
                reconciliationStatus: "REVIEW_REQUIRED",
                matchedTradeId: officialTrade.id,
                reconciliationNotes: matchResult.reason,
              },
            });

            const flagUserId = await getSystemFlagUserId();

              if (flagUserId) {
                await createTradeReconciliationFlag({
                  securityId: security.id,
                  positionId: matchingPosition?.id,
                  createdById: flagUserId,
                  manualTradeId: matchResult.trade.id,
                  wellsTradeId: officialTrade.id,
                  wellsTransactionId: trade.transactionId,
                  ticker: trade.ticker,
                  tradeType: trade.tradeType,
                  reason: matchResult.reason,
                  differences: matchResult.differences,
                });
              } else {
                failures.push(
                  `Could not create reconciliation flag for ${
                    trade.ticker || trade.securityName
                  }: no user found.`
                );
              }

            if (existingWellsTrade) {
              tradesUpdated += 2;
            } else {
              tradesCreated += 1;
              tradesUpdated += 1;
            }

            continue;
          }

          if (existingWellsTrade) {
            await prisma.trade.update({
              where: {
                id: existingWellsTrade.id,
              },
              data: tradeData,
            });

            tradesUpdated += 1;
            continue;
          }


         

          const existingTrade = await prisma.trade.findFirst({
            where: {
              sourceRowHash: trade.sourceRowHash,
            },
          });

          if (existingTrade) {
            await prisma.trade.update({
              where: {
                id: existingTrade.id,
              },
              data: tradeData,
            });

            tradesUpdated += 1;
          } else {
            await prisma.trade.create({
              data: tradeData,
            });

            tradesCreated += 1;
          }
        }
      }

   const finalStatus =
    rowsFailed > 0
      ? "COMPLETED_WITH_WARNINGS"
      : "COMPLETED";

    await completeIngestionRun({
      id: ingestionRun.id,
      status: finalStatus,
      message: `Wells ingestion ${reportType} completed. Processed ${rowsProcessed} rows, failed ${rowsFailed}.`,
      rowsProcessed,
      rowsFailed,
      sourceReportDate:
      resolvedSourceReportDate,
      accountNumber: undefined,
      details: { failures },
    });

    return NextResponse.json({
      source: "WELLS_FARGO",
      reportType,
      sourceReportDate:
        resolvedSourceReportDate.toISOString(),
      rowsProcessed,
      rowsFailed,
      securitiesCreated,
      newlyCreatedSecurities,
      securitiesUpdated,
      positionsCreated,
      positionsUpdated,
      positionsClosed,
      tradesCreated,
      tradesUpdated,
      failures,
      taxLotsCreated,
      taxLotsUpdated,
    });
  } catch (error) {
    console.error(error);

    if (ingestionRunId) {
      await completeIngestionRun({
        id: ingestionRunId,
        status: "FAILED",
        message: error instanceof Error ? error.message : "Unknown Wells ingestion error",
        rowsProcessed: 0,
        rowsFailed: 1,
        details: {
          error: error instanceof Error ? error.stack || error.message : String(error),
        },
      });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
