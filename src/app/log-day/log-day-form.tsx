
"use client";

import * as React from "react";
import { format } from "date-fns";
import { Plus, Trash2, CalendarIcon, Upload, ChevronLeft, ChevronRight, Copy, ClipboardPaste, FileUp } from "lucide-react";
import { useForm, useFormContext, Controller, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";

const tradeLogSchema = z.object({
  date: z.date(),
  symbol: z.string().optional(),
  pnl: z.coerce.number().optional(),
  contracts: z.coerce.number().optional(),
  points: z.coerce.number().optional(),
  playbook: z.string().optional(),
  entryType: z.string().optional(),
  tp: z.coerce.number().optional(),
  sl: z.coerce.number().optional(),
  maxTp: z.coerce.number().optional(),
  maxSl: z.coerce.number().optional(),
  entryTime: z.string().optional(),
  exitTime: z.string().optional(),
  totalTime: z.string().optional(),
  chartImage: z.string().optional(),
  secChartImage: z.string().optional(),
  notes: z.string().optional(),
});

export type TradeLog = z.infer<typeof tradeLogSchema>;

const ImagePasteCard = ({ label, fieldName }: { label: string, fieldName: "chartImage" | "secChartImage" }) => {
    const { watch, setValue } = useFormContext<TradeLog>();
    const imageUrl = watch(fieldName);
    const { toast } = useToast();

    // This effect will listen for paste events on the whole document
    React.useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            const items = event.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    const blob = items[i].getAsFile();
                    if (!blob) continue;

                    const reader = new FileReader();
                    reader.onload = (e) => {
                        // Check which field is empty and paste there, or default to the first one
                        const currentChartImage = watch('chartImage');
                        const currentSecChartImage = watch('secChartImage');

                        if (fieldName === 'chartImage' && !currentChartImage) {
                            setValue(fieldName, e.target?.result as string, { shouldDirty: true });
                            toast({ title: "Image Pasted!", description: "The image from your clipboard has been added." });
                        } else if (fieldName === 'secChartImage' && !currentSecChartImage) {
                             setValue(fieldName, e.target?.result as string, { shouldDirty: true });
                            toast({ title: "Image Pasted!", description: "The image from your clipboard has been added." });
                        } else if (fieldName === 'chartImage') { // Default to overwriting the first one if both have images
                             setValue(fieldName, e.target?.result as string, { shouldDirty: true });
                             toast({ title: "Image Pasted!", description: "The image from your clipboard has been added." });
                        }
                    };
                    reader.readAsDataURL(blob);
                    event.preventDefault(); // Prevent the image from being pasted elsewhere
                    return; // Stop after handling the first image
                }
            }
        };

        document.addEventListener("paste", handlePaste);
        return () => {
            document.removeEventListener("paste", handlePaste);
        };
    }, [setValue, toast, watch, fieldName]);
    
    return (
        <Card className="retro-border aspect-video flex items-center justify-center relative group">
            {imageUrl ? (
                <>
                    <Image src={imageUrl} alt={label} layout="fill" objectFit="cover" className="rounded-none" />
                    <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        onClick={() => setValue(fieldName, "", { shouldDirty: true })}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </>
            ) : (
                <div className="text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                         <ClipboardPaste className="h-8 w-8" />
                         <span className="text-sm font-headline uppercase">{label}</span>
                    </div>
                </div>
            )}
        </Card>
    );
};


export default function LogDayForm() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const form = useForm<z.infer<typeof tradeLogSchema>>({
    resolver: zodResolver(tradeLogSchema),
    defaultValues: {
      date: new Date(),
      symbol: "",
      pnl: 0,
      contracts: 0,
      points: 0,
      playbook: "",
      entryType: "",
      tp: 0,
      sl: 0,
      maxTp: 0,
      maxSl: 0,
      entryTime: "",
      exitTime: "",
      totalTime: "",
      chartImage: "",
      secChartImage: "",
      notes: "",
    },
  });

  const { control, getValues, setValue, watch, reset } = form;

    const saveChanges = React.useCallback((values: TradeLog) => {
        if (!values.date) return;
        
        const key = `trade-log-${format(values.date, 'yyyy-MM-dd')}`;
        
        const dataToSave = {
          ...values,
          date: values.date.toISOString(),
          trades: [
            {
              symbol: values.symbol,
              pnl: values.pnl,
              contracts: values.contracts,
              points: values.points,
              playbook: values.playbook,
              entryType: values.entryType,
              tp: values.tp,
              sl: values.sl,
              maxTp: values.maxTp,
              maxSl: values.maxSl,
              entryTime: values.entryTime,
              exitTime: values.exitTime,
              chartImage: values.chartImage,
              secChartImage: values.secChartImage,
            }
          ]
        };

        const allTradesRaw = localStorage.getItem('all-trades') || '[]';
        let allTrades: any[] = [];
        try {
            allTrades = JSON.parse(allTradesRaw);
        } catch {
            allTrades = [];
        }

        const logDateStr = format(values.date, 'yyyy-MM-dd');
        const dayIndex = allTrades.findIndex(log => log.date && format(new Date(log.date), 'yyyy-MM-dd') === logDateStr);

        if (dayIndex > -1) {
            allTrades[dayIndex] = dataToSave;
        } else {
            allTrades.push(dataToSave);
        }
        
        localStorage.setItem(`trade-log-${logDateStr}`, JSON.stringify(dataToSave));
        localStorage.setItem('all-trades', JSON.stringify(allTrades));

  }, [watch]);

  const debouncedSaveChanges = useDebouncedCallback(saveChanges, 1000);

  React.useEffect(() => {
    if (!isClient) return;
    const subscription = watch((value) => {
        debouncedSaveChanges(value as TradeLog);
    });
    return () => subscription.unsubscribe();
  }, [isClient, watch, debouncedSaveChanges]);

    React.useEffect(() => {
        if (!isClient) return;
        const dateParam = searchParams.get('date');
        const date = dateParam ? new Date(dateParam) : new Date();
        const key = `trade-log-${format(date, 'yyyy-MM-dd')}`;
        const savedData = localStorage.getItem(key);

        const emptyLog = {
            date: date,
            symbol: "", 
            pnl: 0, 
            contracts: 0,
            points: 0, 
            playbook: "", 
            entryType: "",
            tp: 0, 
            sl: 0, 
            maxTp: 0, 
            maxSl: 0,
            entryTime: "", 
            exitTime: "", 
            totalTime: "",
            chartImage: "", 
            secChartImage: "", 
            notes: "",
        };
        
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            const tradeData = parsedData.trades?.[0] || {};
            reset({ ...emptyLog, ...parsedData, ...tradeData, date: new Date(parsedData.date) });
        } else {
             reset(emptyLog);
        }
    }, [searchParams, reset, isClient]);


  const handleBackClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    await saveChanges(form.getValues());
    toast({
      title: "Changes Saved!",
      description: "Your recap has been updated.",
    });
    router.push('/');
  };

  const pnlValue = watch("pnl") || 0;
  const pnlColorClass = pnlValue > 0 ? 'text-green-500' : pnlValue < 0 ? 'text-red-500' : 'text-foreground';

  const dateValue = watch("date");
  
  function nextDay() {
    if (dateValue) {
        saveChanges(form.getValues());
        const newDate = new Date(dateValue);
        newDate.setDate(newDate.getDate() + 1);
        router.push(`/log-day?date=${format(newDate, 'yyyy-MM-dd')}`);
    }
  }

  function prevDay() {
     if (dateValue) {
        saveChanges(form.getValues());
        const newDate = new Date(dateValue);
        newDate.setDate(newDate.getDate() - 1);
        router.push(`/log-day?date=${format(newDate, 'yyyy-MM-dd')}`);
    }
  }
  
  return (
    <div className="max-w-7xl mx-auto p-4 w-full min-h-screen flex flex-col">
      <header className="flex-shrink-0 flex items-center justify-between h-16 mb-4">
        <div className="flex items-center justify-start w-20">
            <Button variant="ghost" size="icon" asChild>
                <a href="/" onClick={handleBackClick}>
                    <ChevronLeft className="h-6 w-6" />
                    <span className="sr-only">Back</span>
                </a>
            </Button>
        </div>
        <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon" onClick={prevDay}><ChevronLeft/></Button>
             <Popover>
                <PopoverTrigger asChild>
                    <Button
                    variant={"outline"}
                    className={cn("w-64 justify-center text-center font-bold text-base", !dateValue && "text-muted-foreground")}
                    >
                    {dateValue ? format(dateValue, "EEEE, d MMMM yyyy") : <span>Pick a date</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 retro-border" align="center">
                <Calendar
                    mode="single"
                    selected={dateValue}
                    onSelect={(d) => {
                        if (d) {
                            saveChanges(form.getValues());
                            router.push(`/log-day?date=${format(d, 'yyyy-MM-dd')}`);
                        }
                    }}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                    initialFocus
                />
                </PopoverContent>
            </Popover>
             <Button variant="ghost" size="icon" onClick={nextDay}><ChevronRight/></Button>
        </div>
        <div className="flex justify-end w-20">
            {/* Empty div for spacing */}
        </div>
      </header>

      <main className="flex-1">
        <FormProvider {...form}>
          <form className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
            
            <div className="col-span-1 flex flex-col gap-4">
                <Card className="retro-border">
                    <CardContent className="p-4 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <FormField
                                control={control}
                                name="pnl"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs uppercase text-muted-foreground">PNL</FormLabel>
                                        <FormControl>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 font-bold text-lg text-muted-foreground">$</span>
                                            <Input 
                                                type="number"
                                                {...field}
                                                value={field.value ?? ""}
                                                onChange={e => field.onChange(e.target.valueAsNumber)}
                                                className={cn(pnlColorClass, 'font-bold text-2xl border-0 bg-transparent h-auto p-0 pl-7 text-left focus-visible:ring-0')}
                                                placeholder="0" 
                                            />
                                        </div>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                             <FormField control={control} name="contracts" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs uppercase text-muted-foreground">Contracts</FormLabel>
                                    <FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.valueAsNumber)} className="text-xl"/></FormControl>
                                </FormItem>
                             )}/>
                             <FormField control={control} name="symbol" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs uppercase text-muted-foreground">Symbol</FormLabel>
                                    <FormControl><Input {...field} value={field.value ?? ""} className="text-xl"/></FormControl>
                                </FormItem>
                             )}/>
                        </div>
                         <FormField control={control} name="points" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs uppercase text-muted-foreground">Points</FormLabel>
                                <FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.valueAsNumber)} className="text-xl"/></FormControl>
                            </FormItem>
                         )}/>
                         <FormField control={control} name="playbook" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs uppercase text-muted-foreground">Playbook</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ""} className="text-xl"/></FormControl>
                            </FormItem>
                         )}/>
                         <FormField control={control} name="entryType" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs uppercase text-muted-foreground">Entry Type</FormLabel>
                                <FormControl><Input {...field} value={field.value ?? ""} className="text-xl"/></FormControl>
                            </FormItem>
                         )}/>
                    </CardContent>
                </Card>
                <Card className="retro-border">
                    <CardHeader className="p-4"><CardTitle className="font-headline text-sm uppercase text-muted-foreground">Performance</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={control} name="tp" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase text-muted-foreground">TP</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.valueAsNumber)} /></FormControl></FormItem>)}/>
                            <FormField control={control} name="sl" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase text-muted-foreground">SL</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.valueAsNumber)} /></FormControl></FormItem>)}/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={control} name="maxTp" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase text-muted-foreground">Max TP</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.valueAsNumber)} /></FormControl></FormItem>)}/>
                            <FormField control={control} name="maxSl" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase text-muted-foreground">Max SL</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.valueAsNumber)} /></FormControl></FormItem>)}/>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <FormField control={control} name="entryTime" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase text-muted-foreground">Entry Time</FormLabel><FormControl><Input type="time" {...field} value={field.value ?? ""} /></FormControl></FormItem>)}/>
                            <FormField control={control} name="exitTime" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase text-muted-foreground">Exit Time</FormLabel><FormControl><Input type="time" {...field} value={field.value ?? ""} /></FormControl></FormItem>)}/>
                        </div>
                         <FormField control={control} name="totalTime" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase text-muted-foreground">Total Time</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl></FormItem>)}/>
                    </CardContent>
                </Card>
            </div>

            <div className="col-span-2 flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-6">
                    <ImagePasteCard label="Chart (Paste Image)" fieldName="chartImage" />
                    <ImagePasteCard label="Sec Chart (Paste Image)" fieldName="secChartImage" />
                </div>
                <Card className="retro-border flex-1 flex flex-col">
                  <CardHeader className="p-2 border-b flex-row items-center justify-between">
                    <CardTitle className="font-headline text-sm uppercase text-muted-foreground">Free Notes</CardTitle>
                    <div className="flex items-center gap-2">
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6"><Copy className="h-4 w-4"/></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6"><ClipboardPaste className="h-4 w-4"/></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6"><FileUp className="h-4 w-4"/></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 flex-1">
                    <FormField
                      control={control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem className="h-full">
                          <FormControl>
                            <Textarea className="bg-transparent border-0 p-2 focus-visible:ring-0 text-base h-full resize-none" placeholder="Start writing your notes..." {...field} value={field.value ?? ""} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
            </div>
          </form>
        </FormProvider>
      </main>
    </div>
  );
}

    