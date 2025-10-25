
"use client";

import * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";

import { TradeCalendar } from "@/components/trade-calendar";
import { RecentTrades } from "@/components/recent-trades";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import type { DayLog } from "@/app/log-day/log-day-form";
import { ProgressTracker } from "@/components/progress-tracker";
import { cn } from "@/lib/utils";

export default function Home() {
  const [stats, setStats] = React.useState({
      netPnl: 0,
      avgWin: 0,
      winRate: 0,
  });
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
        setIsClient(true);
  }, []);

  React.useEffect(() => {
      if (typeof window !== 'undefined') {
        const allLogsRaw = localStorage.getItem('all-trades');
        if (allLogsRaw) {
            try {
                const allLogs: DayLog[] = JSON.parse(allLogsRaw);
                const allTrades = allLogs.flatMap(log => (log.trades || []).map(t => ({...t, date: new Date(log.date)})));
                
                const relevantTrades = allTrades.filter(trade => trade.pnl !== 0);

                const netPnl = allTrades.reduce((acc, trade) => acc + (trade.pnl || 0), 0);
                const winningTrades = relevantTrades.filter(trade => (trade.pnl || 0) > 0);
                
                const avgWin = winningTrades.length > 0
                  ? winningTrades.reduce((acc, trade) => acc + (trade.pnl || 0), 0) / winningTrades.length
                  : 0;
                
                const winRate = relevantTrades.length > 0 ? (winningTrades.length / relevantTrades.length) * 100 : 0;
                
                setStats({ netPnl, avgWin, winRate });
            } catch (e) {
                console.error("Failed to parse trade logs", e);
            }
        }
      }
  }, [isClient]);

  const pnlColorClass = stats.netPnl > 0 ? "text-green-500" : stats.netPnl < 0 ? "text-red-500" : "text-foreground";
  const avgWinColorClass = stats.avgWin > 0 ? "text-green-500" : "text-foreground";


  return (
    <div className="flex flex-col min-h-screen text-foreground p-4">
      <main className="flex-1 md:px-8 md:py-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-6">
              <div className="space-y-6">
                {isClient && <TradeCalendar />}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="col-span-1">
                      <StatCard 
                          title="Net P&L" 
                          value={stats.netPnl.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0})}
                          valueClassName={pnlColorClass}
                      />
                    </div>
                    <div className="col-span-1">
                      <StatCard 
                          title="Avg Trade Win" 
                          value={stats.avgWin.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0})}
                          valueClassName={avgWinColorClass}
                        />
                    </div>
                    <div className="col-span-1">
                      <StatCard 
                          title="Win Rate" 
                          value={`${stats.winRate.toFixed(0)}%`}
                        />
                    </div>
                    <div className="col-span-1">
                      <ProgressTracker />
                    </div>
                </div>
              </div>
            </div>
            <div className="lg:col-span-1">
              <RecentTrades />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

    