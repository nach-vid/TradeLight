
"use client";

import * as React from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  add,
  sub,
  isToday as isTodayDateFns,
  isSameDay
} from "date-fns";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { DayLog, TradeLog } from "@/app/log-day/log-day-form";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface DailyPnl {
  pnl: number;
  tradeCount: number;
  isLogged: boolean;
}

export function TradeCalendar() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [dailyPnl, setDailyPnl] = React.useState<Record<string, DailyPnl>>({});

  const initializeCalendar = React.useCallback(() => {
      const allLogsRaw = localStorage.getItem('all-trades');
      const pnl: Record<string, DailyPnl> = {};
      if (allLogsRaw) {
        try {
          const allLogs: DayLog[] = JSON.parse(allLogsRaw);
          allLogs.forEach((log) => {
            if (!log.date) return;
            const logDate = new Date(log.date);
            const dayKey = format(logDate, "yyyy-MM-dd");
            
            if (!pnl[dayKey]) {
              pnl[dayKey] = { pnl: 0, tradeCount: 0, isLogged: false };
            }

            const dayPnl = log.trades?.reduce((sum, trade) => sum + (trade.pnl || 0), 0) || 0;
            const hasImage = log.trades?.some(t => !!t.chartImage || !!t.secChartImage);
            const hasNotes = !!log.notes;
            
            pnl[dayKey].pnl += dayPnl;
            pnl[dayKey].tradeCount += log.trades?.filter(t => t.pnl).length || 0;
            
            pnl[dayKey].isLogged = dayPnl !== 0 || hasImage || hasNotes;
          });
        } catch (error) {
          console.error("Failed to parse trade logs from localStorage", error);
        }
      }
      setDailyPnl(pnl);
  }, []);

  React.useEffect(() => {
    initializeCalendar();

    const handleStorageChange = () => {
        initializeCalendar();
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
        window.removeEventListener('storage', handleStorageChange);
    }
  }, [initializeCalendar]);

  const firstDayOfCurrentMonth = startOfMonth(currentDate);

  const startOfCalendar = startOfWeek(firstDayOfCurrentMonth, { weekStartsOn: 0 });
  const endOfCalendar = endOfWeek(endOfMonth(firstDayOfCurrentMonth), { weekStartsOn: 0 });

  const days = eachDayOfInterval({
    start: startOfCalendar,
    end: endOfCalendar
  });

  const calendarWeeks = [];
  for (let i = 0; i < days.length; i += 7) {
    calendarWeeks.push(days.slice(i, i + 7));
  }

  const lastWeek = calendarWeeks[calendarWeeks.length - 1];
  if (lastWeek && calendarWeeks.length > 5) {
      const allDaysInLastWeekOutsideMonth = lastWeek.every(day => !isSameMonth(day, currentDate));
      if (allDaysInLastWeekOutsideMonth) {
        calendarWeeks.pop();
      }
  }

  const calendarDays = calendarWeeks.flat();

  function nextMonth() {
    setCurrentDate(add(currentDate, { months: 1 }));
  }

  function prevMonth() {
    setCurrentDate(sub(currentDate, { months: 1 }));
  }
  
  const isToday = (day: Date) => {
    return isTodayDateFns(day);
  }

  const handleDayClick = (day: Date) => {
    const dayKey = format(day, "yyyy-MM-dd");
    router.push(`/log-day?date=${dayKey}`);
  };
  
  const handleDownloadCsv = () => {
    const allLogsRaw = localStorage.getItem('all-trades');
    if (!allLogsRaw) {
      alert("No trade data to export.");
      return;
    }

    try {
        const allLogs: DayLog[] = JSON.parse(allLogsRaw);

        const headers = [
            "Date", "Symbol", "PNL", "Contracts", "Points", "Playbook", 
            "EntryType", "TP", "SL", "Max TP", "Max SL", 
            "Entry Time", "Exit Time", "Total Time", "Notes"
        ];
        
        const rows: (string | number | undefined)[][] = [];

        const filteredLogs = allLogs.filter(log => {
            const hasTrades = log.trades && log.trades.some(trade => 
                trade.pnl || trade.contracts || trade.points || trade.playbook || 
                (trade.entryType && trade.entryType.length > 0) || 
                trade.tp || trade.sl || trade.maxTp || trade.maxSl || 
                trade.entryTime || trade.exitTime || trade.chartImage || trade.secChartImage
            );
            return hasTrades || log.notes;
        });


        filteredLogs
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .forEach(log => {
                const date = format(new Date(log.date), "yyyy-MM-dd");
                
                const hasPnlTrades = log.trades?.some(t => t.pnl);
                
                if (!hasPnlTrades) {
                     if (log.notes || (log.trades && log.trades.some(t => t.chartImage || t.secChartImage))) {
                        rows.push([date, "NO TRADE", 0, "", "", "", "", "", "", "", "", "", "", "", `"${(log.notes || "").replace(/"/g, '""')}"`]);
                     }
                } else {
                    log.trades?.forEach(trade => {
                        if (trade.pnl) { // Only export trades with PNL
                            const entryTypes = trade.entryType?.map(et => et.label).join(', ') || "";
                            const tradeNote = log.notes;
                            rows.push([
                                date,
                                trade.symbol,
                                trade.pnl,
                                trade.contracts,
                                trade.points,
                                trade.playbook,
                                entryTypes,
                                trade.tp,
                                trade.sl,
                                trade.maxTp,
                                trade.maxSl,
                                trade.entryTime,
                                trade.exitTime,
                                trade.totalTime,
                                `"${(tradeNote || "").replace(/"/g, '""')}"`
                            ]);
                        }
                    });
                }
        });

      if (rows.length === 0) {
        alert("No data to export.");
        return;
      }

      const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.map(field => {
            const str = String(field ?? '');
            if (str.includes(',') || str.includes('"')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(",")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "trade_logs.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error("Failed to generate CSV", error);
      alert("An error occurred while generating the CSV file.");
    }
  };


  return (
    <div className="border border-foreground">
      <div className="flex items-center justify-between p-2">
        <h2 className="text-lg font-bold font-headline uppercase">
          {format(currentDate, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-2">
           <Button variant="outline" asChild>
                <Link href="/log-day">Log Day</Link>
           </Button>
            <Button variant="outline" size="icon" className="h-10 w-10" onClick={handleDownloadCsv}>
                <Download className="h-4 w-4" />
                <span className="sr-only">Download CSV</span>
            </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
       <div className="grid grid-cols-7 text-xs text-center font-semibold text-muted-foreground border-b border-t border-foreground -mr-px -mb-px">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="py-2 border-r border-foreground">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 -mr-px -mb-px">
        {calendarDays.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const pnlData = dailyPnl[dayKey];
          const isCurrentMonth = isSameMonth(day, currentDate);
          
          let pnlColor = '';
          if (pnlData) {
            if (pnlData.pnl > 0) pnlColor = 'hsl(142.1 76.2% 36.3%)'; // green-600
            else if (pnlData.pnl < 0) pnlColor = 'hsl(var(--destructive))';
            else if (pnlData.isLogged) pnlColor = 'hsl(var(--muted))';
          }
          const pnlTextColorClass = pnlData ? (pnlData.pnl > 0 ? 'text-green-500' : pnlData.pnl < 0 ? 'text-red-500' : 'text-muted-foreground') : '';

          const isNoTradeDay = pnlData?.isLogged && pnlData.pnl === 0 && pnlData.tradeCount === 0;

          return (
            <div
              key={day.toString()}
              onClick={() => isCurrentMonth && handleDayClick(day)}
              className={cn(
                "relative flex flex-col justify-center items-center text-xs transition-colors h-20 p-1 border-b border-r border-foreground",
                isCurrentMonth && "cursor-pointer",
                !isCurrentMonth && "bg-transparent pointer-events-none",
                isCurrentMonth && !pnlData?.isLogged && "hover:bg-accent/50"
              )}
               style={pnlData?.isLogged && isCurrentMonth ? { boxShadow: `inset 0 0 0 2px ${pnlColor}` } : {}}
            >
              {isCurrentMonth ? (
                <>
                  <time
                      dateTime={format(day, "yyyy-MM-dd")}
                      className={cn(
                        "absolute top-1.5 left-1.5 font-semibold text-xs h-5 w-5 flex items-center justify-center z-10",
                        isToday(day) && "rounded-full bg-white text-black",
                        pnlData?.pnl === 0 ? "text-muted-foreground" : pnlTextColorClass
                      )}
                    >
                      {format(day, "d")}
                    </time>

                  {pnlData?.isLogged ? (
                    <div className="p-1 text-center">
                      {isNoTradeDay ? (
                        <span className="font-bold text-sm text-muted-foreground">NO TRADE</span>
                      ) : (
                        <span className={cn("font-bold text-base", pnlTextColorClass)}>
                            {pnlData.pnl.toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 0,
                            })}
                        </span>
                      )}
                    </div>
                  ) : null}
                  {!pnlData?.isLogged ? <div className="h-full w-full"></div> : null}
                </>
              ) : <div className="h-full w-full bg-transparent"></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
