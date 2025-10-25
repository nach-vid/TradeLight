
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

    React.useEffect(() => {
        const allLogsRaw = localStorage.getItem('all-trades');
        if (allLogsRaw) {
            const allLogs: DayLog[] = JSON.parse(allLogsRaw);
            const flatTrades: FlatTrade[] = allLogs.flatMap((log, logIndex) => {
                // Ensure we have a valid log with trades
                if (!log.trades || log.trades.length === 0) {
                     // Handle days that were logged but had no trades.
                    const dayHasNoteOrImage = log.notes || (log.trades && log.trades.some(t => t.chartImage || t.secChartImage));
                    if (dayHasNoteOrImage) {
                         return [{
                            id: `${logIndex}-notrade`,
                            date: new Date(log.date),
                            instrument: 'No Trade',
                            profitOrLoss: 0,
                            isNoTrade: true,
                        }];
                    }
                    return [];
                }
                
                return log.trades.map((trade: TradeLog, tradeIndex: number) => ({
                    id: `${logIndex}-${tradeIndex}`,
                    date: new Date(log.date),
                    instrument: trade.symbol,
                    profitOrLoss: trade.pnl,
                    isNoTrade: (trade.chartImage || trade.secChartImage) && !trade.pnl,
                }));
            })
            .filter(trade => (trade.profitOrLoss !== undefined && trade.profitOrLoss !== 0) || trade.isNoTrade)
            .sort((a, b) => b.date.getTime() - a.date.getTime());
            
            setRecentTrades(flatTrades);
        }
    }, []);

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
