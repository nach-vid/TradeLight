
"use client";

import *
as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { DayLog } from '@/app/log-day/log-day-form';

export function ProgressTracker() {
    const [progress, setProgress] = React.useState(0);
    const [dayCount, setDayCount] = React.useState(0);
    const goal = 30;

    const updateProgress = React.useCallback(() => {
        const allLogsRaw = localStorage.getItem('all-trades');
        if (allLogsRaw) {
            try {
                const allLogs: DayLog[] = JSON.parse(allLogsRaw);

                const loggedDays = allLogs.filter(log => {
                    const dayPnl = log.trades?.reduce((sum, trade) => sum + (trade.pnl || 0), 0) || 0;
                    const hasImage = log.trades?.some(t => !!t.chartImage || !!t.secChartImage);
                    const hasNotes = !!log.notes;
                    return dayPnl !== 0 || hasImage || hasNotes;
                });

                const loggedDaysCount = new Set(loggedDays.map(log => new Date(log.date).toDateString())).size;
                
                setDayCount(loggedDaysCount);
                setProgress((loggedDaysCount / goal) * 100);
            } catch (e) {
                console.error("Failed to parse logs for progress tracker", e);
            }
        }
    }, [goal]);

    React.useEffect(() => {
        updateProgress();
        
        const handleStorageChange = () => {
            updateProgress();
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [updateProgress]);


    return (
        <Card className="h-28 flex flex-col justify-center p-4 retro-border">
            <CardHeader className="p-0 pb-2">
                <CardTitle className="font-headline text-sm font-medium text-muted-foreground flex justify-between uppercase">
                    <span>LOG 30 DAYS</span>
                    <span>{dayCount}/{goal}</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Progress value={progress} className="h-6" indicatorClassName="bg-green-500" />
            </CardContent>
        </Card>
    );
}
