
"use client";

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DayLog, TradeLog } from '@/app/log-day/log-day-form';

interface FlatTrade {
    id: string;
    date: Date;
    instrument: string | undefined;
    profitOrLoss: number | undefined;
    isNoTrade: boolean;
}

export function RecentTrades() {
    const [recentTrades, setRecentTrades] = React.useState<FlatTrade[]>([]);

    const updateRecentTrades = React.useCallback(() => {
        const allLogsRaw = localStorage.getItem('all-trades');
        if (allLogsRaw) {
            try {
                const allLogs: DayLog[] = JSON.parse(allLogsRaw);
                const flatTrades: FlatTrade[] = allLogs.flatMap((log, logIndex) => {
                    const dayPnl = log.trades?.reduce((sum, trade) => sum + (trade.pnl || 0), 0) || 0;
                    const dayHasNoteOrImage = !!log.notes || (log.trades && log.trades.some(t => t.chartImage || t.secChartImage));
                    const isNoTradeDay = dayHasNoteOrImage && dayPnl === 0 && log.trades?.every(t => !t.pnl);

                    if (isNoTradeDay) {
                         return [{
                            id: `${logIndex}-notrade`,
                            date: new Date(log.date),
                            instrument: 'Journal / Note',
                            profitOrLoss: 0,
                            isNoTrade: true,
                        }];
                    }
                    
                    if (!log.trades) return [];
                    
                    return log.trades
                        .filter((trade: TradeLog) => trade.pnl)
                        .map((trade: TradeLog, tradeIndex: number) => ({
                            id: `${logIndex}-${tradeIndex}`,
                            date: new Date(log.date),
                            instrument: trade.symbol,
                            profitOrLoss: trade.pnl,
                            isNoTrade: false,
                        }));
                })
                .sort((a, b) => b.date.getTime() - a.date.getTime());
                
                setRecentTrades(flatTrades);
            } catch (e) {
                console.error("Failed to parse logs for recent trades", e);
            }
        }
    }, []);

    React.useEffect(() => {
        updateRecentTrades();

        const handleStorageChange = () => {
            updateRecentTrades();
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [updateRecentTrades]);

  return (
    <Card className="h-full flex flex-col retro-border">
      <CardHeader className="border-b">
        <CardTitle className="font-headline text-lg uppercase">Recent Trades</CardTitle>
      </CardHeader>
      <CardContent className="pt-2 flex-1 min-h-0">
        <ScrollArea className="h-full">
            {recentTrades.length > 0 ? (
                <ul className="space-y-3 pr-4">
                    {recentTrades.map(trade => {
                        const pnl = trade.profitOrLoss || 0;
                        return (
                            <li key={trade.id} className="flex justify-between items-center gap-4">
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="w-10 text-center">
                                        <p className="font-bold text-sm">{format(trade.date, "d")}</p>
                                        <p className="text-xs text-muted-foreground">{format(trade.date, "MMM")}</p>
                                    </div>
                                    <p className="font-semibold text-sm w-16 truncate">{trade.instrument}</p>
                                </div>
                                {trade.isNoTrade ? (
                                    <p className="text-sm text-muted-foreground text-right min-w-[80px]">No Trade</p>
                                ) : (
                                    <p className={cn("font-bold text-sm text-right min-w-[80px]", pnl > 0 ? "text-green-500" : "text-red-500")}>
                                        {pnl.toLocaleString("en-US", { style: "currency", currency: "USD"})}
                                    </p>
                                )}
                            </li>
                        )
                    })}
                </ul>
            ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>No recent trades</p>
                </div>
            )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
