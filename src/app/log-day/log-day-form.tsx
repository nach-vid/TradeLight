
"use client";

import * as React from "react";
import { format, differenceInMinutes, parse } from "date-fns";
import { Plus, Trash2, CalendarIcon, Upload, ChevronLeft, ChevronRight, Copy, ClipboardPaste, FileUp, X, Check, ChevronsUpDown, SlidersHorizontal } from "lucide-react";
import { useForm, useFormContext, Controller, FormProvider }from "react-hook-form";
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
import { Dialog, DialogContent, DialogTrigger, DialogClose, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";


const tradeLogSchema = z.object({
  date: z.date(),
  symbol: z.string().optional(),
  pnl: z.coerce.number().optional(),
  contracts: z.union([z.coerce.number(), z.literal("-")]).optional(),
  points: z.coerce.number().optional(),
  playbook: z.string().optional(),
  entryType: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  performance: z.string().optional(),
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
export type DayLog = {
    date: string;
    notes?: string;
    trades?: TradeLog[];
};


const defaultPointValues: Record<string, number> = {
    "MNQ": 2,
    "NQ": 20,
    "MES": 5,
    "ES": 50,
};
const defaultPlaybookOptions = ["ORB", "Trend Cont.", "Mean Reversion", "Breakout"];
const defaultEntryTypeOptions = [
    { label: "1st Entry", value: "1st_entry" },
    { label: "2nd Entry", value: "2nd_entry" },
    { label: "Continuation", value: "continuation" },
    { label: "Reversal", value: "reversal" },
];
const defaultPerformanceOptions = ["A+", "A", "B", "C", "D", "F"];


const ImagePasteCard = ({ label, fieldName }: { label: string, fieldName: "chartImage" | "secChartImage" }) => {
    const { watch, setValue } = useFormContext<TradeLog>();
    const imageUrl = watch(fieldName);
    
    return (
        <Dialog>
            <Card className="retro-border aspect-video flex items-center justify-center relative group">
                {imageUrl ? (
                    <>
                        <DialogTrigger asChild>
                            <Image src={imageUrl} alt={label} layout="fill" objectFit="cover" className="rounded-none cursor-pointer" style={{ objectPosition: 'center 85%' }} />
                        </DialogTrigger>
                        <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            onClick={() => setValue(fieldName, "", { shouldDirty: true })}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <DialogContent className="max-w-4xl h-auto bg-background border-foreground p-2">
                             <Image src={imageUrl} alt={label} width={1920} height={1080} className="w-full h-full object-contain" />
                             <DialogClose className="absolute right-2 top-2 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                                <X className="h-6 w-6 text-white bg-black rounded-full p-1" />
                                <span className="sr-only">Close</span>
                            </DialogClose>
                        </DialogContent>

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
        </Dialog>
    );
};


export default function LogDayForm() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isClient, setIsClient] = React.useState(false);
  
  const [pointValues, setPointValues] = React.useState<Record<string, number>>(defaultPointValues);
  const [playbookOptions, setPlaybookOptions] = React.useState(defaultPlaybookOptions);
  const [entryTypeOptions, setEntryTypeOptions] = React.useState(defaultEntryTypeOptions);
  const [performanceOptions, setPerformanceOptions] = React.useState(defaultPerformanceOptions);

  const [playbookSearch, setPlaybookSearch] = React.useState('');
  const [performanceSearch, setPerformanceSearch] = React.useState('');
  const [entryTypeSearch, setEntryTypeSearch] = React.useState('');
  const [symbolSearch, setSymbolSearch] = React.useState('');
  
  const [isSymbolDialogOpen, setIsSymbolDialogOpen] = React.useState(false);
  const [newSymbolName, setNewSymbolName] = React.useState("");
  const [newSymbolValue, setNewSymbolValue] = React.useState<number | string>("");

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof tradeLogSchema>>({
    resolver: zodResolver(tradeLogSchema),
    defaultValues: {
      date: undefined, 
      symbol: "MNQ",
      pnl: undefined,
      contracts: "-",
      points: undefined,
      playbook: "-",
      entryType: [],
      performance: "-",
      tp: undefined,
      sl: undefined,
      maxTp: undefined,
      maxSl: undefined,
      entryTime: "",
      exitTime: "",
      totalTime: "",
      chartImage: "",
      secChartImage: "",
      notes: "",
    },
  });
  
  const { control, getValues, setValue, watch, reset, formState: {isDirty, dirtyFields} } = form;

    React.useEffect(() => {
        setIsClient(true);

        const dateParam = searchParams.get('date');
        const initialDate = dateParam ? new Date(dateParam) : new Date();

        const savedPlaybooks = localStorage.getItem('playbook-options');
        const currentPlaybookOptions = savedPlaybooks ? JSON.parse(savedPlaybooks) : defaultPlaybookOptions;
        setPlaybookOptions(currentPlaybookOptions);

        const savedEntryTypes = localStorage.getItem('entry-type-options');
        const currentEntryTypeOptions = savedEntryTypes ? JSON.parse(savedEntryTypes) : defaultEntryTypeOptions;
        setEntryTypeOptions(currentEntryTypeOptions);

        const savedPerformance = localStorage.getItem('performance-options');
        const currentPerformanceOptions = savedPerformance ? JSON.parse(savedPerformance) : defaultPerformanceOptions;
        setPerformanceOptions(currentPerformanceOptions);

        const savedPointValues = localStorage.getItem('point-values');
        const currentPointValues = savedPointValues ? JSON.parse(savedPointValues) : defaultPointValues;
        setPointValues(currentPointValues);
    
        const key = `trade-log-${format(initialDate, 'yyyy-MM-dd')}`;
        const savedData = localStorage.getItem(key);

        const emptyLog: TradeLog = {
            date: initialDate,
            symbol: "MNQ", 
            pnl: undefined, 
            contracts: "-",
            points: undefined, 
            playbook: "-", 
            entryType: [], 
            performance: "-",
            tp: undefined, 
            sl: undefined, 
            maxTp: undefined, 
            maxSl: undefined,
            entryTime: "", 
            exitTime: "", 
            totalTime: "",
            chartImage: "", 
            secChartImage: "", 
            notes: "",
        };
        
        let dataToLoad = emptyLog;
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                const tradeData = parsedData.trades?.[0] || {};
                
                const loadedPlaybook = tradeData.playbook || "";
                if (loadedPlaybook && !currentPlaybookOptions.includes(loadedPlaybook)) {
                    setPlaybookOptions(prev => [...prev, loadedPlaybook]);
                }
                const loadedEntryTypes = tradeData.entryType || [];
                const newEntryTypes = loadedEntryTypes.filter((et: {label: string, value: string}) => !currentEntryTypeOptions.some(o => o.value === et.value));
                if (newEntryTypes.length > 0) {
                    setEntryTypeOptions(prev => [...prev, ...newEntryTypes]);
                }
                const loadedPerformance = tradeData.performance || "";
                if (loadedPerformance && !currentPerformanceOptions.includes(loadedPerformance)) {
                    setPerformanceOptions(prev => [...prev, loadedPerformance]);
                }
            
                dataToLoad = { 
                    ...emptyLog, 
                    ...parsedData, 
                    ...tradeData, 
                    date: new Date(parsedData.date), 
                    notes: parsedData.notes 
                };
            } catch (e) {
                // Failed to parse
            }
        } 
        reset(dataToLoad);

        const handlePaste = (event: ClipboardEvent) => {
            const items = event.clipboardData?.items;
            if (!items) return;

            const activeElement = document.activeElement;
            const isNotesArea = activeElement?.id === 'notes-textarea';

            if (isNotesArea) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    const blob = items[i].getAsFile();
                    if (!blob) continue;

                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const newImageSrc = e.target?.result as string;
                        const currentChartImage = getValues('chartImage');
                        const currentSecChartImage = getValues('secChartImage');

                        if (!currentChartImage) {
                            setValue('chartImage', newImageSrc, { shouldDirty: true });
                            toast({ title: "Image Pasted!", description: "Chart image has been added." });
                        } else if (!currentSecChartImage) {
                            setValue('secChartImage', newImageSrc, { shouldDirty: true });
                            toast({ title: "Image Pasted!", description: "Secondary chart image has been added." });
                        } else {
                            setValue('chartImage', newImageSrc, { shouldDirty: true });
                            toast({ title: "Image Pasted!", description: "Chart image has been updated." });
                        }
                    };
                    reader.readAsDataURL(blob);
                    event.preventDefault(); 
                    return; 
                }
            }
        };

        document.addEventListener("paste", handlePaste);
        return () => {
            document.removeEventListener("paste", handlePaste);
        };
    }, [searchParams, reset, toast, getValues, setValue]);


    const saveChanges = React.useCallback((values: TradeLog) => {
        if (!values.date) return;
        
        const logDateStr = format(values.date, 'yyyy-MM-dd');
        
        const dataToSave: DayLog = {
          date: values.date.toISOString(),
          notes: values.notes,
          trades: [
            {
              symbol: values.symbol,
              pnl: values.pnl,
              contracts: values.contracts,
              points: values.points,
              playbook: values.playbook,
              entryType: values.entryType,
              performance: values.performance,
              tp: values.tp,
              sl: values.sl,
              maxTp: values.maxTp,
              maxSl: values.maxSl,
              entryTime: values.entryTime,
              exitTime: values.exitTime,
              totalTime: values.totalTime,
              chartImage: values.chartImage,
              secChartImage: values.secChartImage,
            }
          ]
        };

        const allTradesRaw = localStorage.getItem('all-trades') || '[]';
        let allTrades: DayLog[] = [];
        try {
            allTrades = JSON.parse(allTradesRaw);
        } catch {
            allTrades = [];
        }

        const dayIndex = allTrades.findIndex(log => log.date && format(new Date(log.date), 'yyyy-MM-dd') === logDateStr);

        if (dayIndex > -1) {
            allTrades[dayIndex] = dataToSave;
        } else {
            allTrades.push(dataToSave);
        }
        
        localStorage.setItem(`trade-log-${logDateStr}`, JSON.stringify(dataToSave));
        localStorage.setItem('all-trades', JSON.stringify(allTrades));
        localStorage.setItem('playbook-options', JSON.stringify(playbookOptions));
        localStorage.setItem('performance-options', JSON.stringify(performanceOptions));
        localStorage.setItem('entry-type-options', JSON.stringify(entryTypeOptions.map(o => ({label: o.label, value: o.value}))));
        localStorage.setItem('point-values', JSON.stringify(pointValues));
        
        window.dispatchEvent(new Event('storage'));
  }, [playbookOptions, entryTypeOptions, pointValues, performanceOptions]);

  const debouncedSaveChanges = useDebouncedCallback(saveChanges, 1000);

  React.useEffect(() => {
    if (!isClient) return;
    const subscription = watch((values, { name, type }) => {
        if (isDirty) {
            const watchedValues = getValues() as TradeLog;
            
            if (name !== 'pnl' && (dirtyFields.points || dirtyFields.contracts || dirtyFields.symbol)) {
                const points = watchedValues.points ?? 0;
                const contracts = watchedValues.contracts ?? 0;
                const symbol = watchedValues.symbol ?? "";
                const pointValue = pointValues[symbol] || 0;
                
                if (contracts !== '-') {
                    const newPnl = points * pointValue * (contracts as number);
                    if (watchedValues.pnl !== newPnl) {
                        setValue('pnl', newPnl, { shouldDirty: true, shouldValidate: true });
                    }
                } else {
                     setValue('pnl', 0, { shouldDirty: true, shouldValidate: true });
                }
            }
            
            if (name === 'entryTime' || name === 'exitTime') {
                const { entryTime, exitTime } = watchedValues;
                if (entryTime && exitTime) {
                    try {
                        const today = new Date();
                        const entryDateTime = parse(entryTime, 'HH:mm', today);
                        const exitDateTime = parse(exitTime, 'HH:mm', today);

                        if (!isNaN(entryDateTime.getTime()) && !isNaN(exitDateTime.getTime())) {
                            let diff = differenceInMinutes(exitDateTime, entryDateTime);
                            if (diff < 0) diff += 24 * 60; 
                            
                            const hours = Math.floor(diff / 60);
                            const minutes = diff % 60;
                            
                            let timeString = "";
                            if (hours > 0) timeString += `${hours}h `;
                            if (minutes > 0) timeString += `${minutes}m`;

                            setValue('totalTime', timeString.trim() || "0m", { shouldDirty: true, shouldValidate: true });
                        }
                    } catch(e) {
                        // Could not parse time
                    }
                } else {
                     setValue('totalTime', '', { shouldDirty: true, shouldValidate: true });
                }
            }
            debouncedSaveChanges(watchedValues);
        }
    });
    return () => subscription.unsubscribe();
  }, [isClient, watch, debouncedSaveChanges, setValue, getValues, pointValues, isDirty, dirtyFields]);

  const handleBackClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if(isDirty) {
        await saveChanges(form.getValues());
        toast({
        title: "Changes Saved!",
        description: "Your recap has been updated.",
        });
    }
    const basePath = process.env.NODE_ENV === 'production' ? '/tradelight' : '';
    router.push(`${basePath}/`);
  };

  const pnlValue = watch("pnl") || 0;
  const pnlColorClass = pnlValue > 0 ? 'text-green-500' : pnlValue < 0 ? 'text-red-500' : 'text-foreground';

  const dateValue = watch("date");
  
  function navigateDays(offset: number) {
    if (dateValue) {
        if(isDirty) saveChanges(form.getValues());
        const newDate = new Date(dateValue);
        newDate.setDate(newDate.getDate() + offset);
        router.push(`/log-day?date=${format(newDate, 'yyyy-MM-dd')}`);
    }
  }

  const handleDeletePlaybookOption = (e: React.MouseEvent, option: string) => {
    e.stopPropagation();
    e.preventDefault();
    setPlaybookOptions(prev => prev.filter(item => item !== option));
  };

  const handleDeletePerformanceOption = (e: React.MouseEvent, option: string) => {
    e.stopPropagation();
    e.preventDefault();
    setPerformanceOptions(prev => prev.filter(item => item !== option));
  };
  
  const handleDeleteEntryTypeOption = (e: React.MouseEvent, value: string) => {
    e.stopPropagation();
    e.preventDefault();
    setEntryTypeOptions(prev => prev.filter(item => item.value !== value));
  };

  const handleDeleteSymbol = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    e.preventDefault();
    const newPointValues = { ...pointValues };
    delete newPointValues[symbol];
    setPointValues(newPointValues);
    if (getValues("symbol") === symbol) {
      setValue("symbol", Object.keys(newPointValues)[0] || "", { shouldDirty: true });
    }
  };

  const handleAddNewSymbol = () => {
    if (newSymbolName && (newSymbolValue || newSymbolValue === 0)) {
        const numericValue = typeof newSymbolValue === 'string' ? parseFloat(newSymbolValue) : newSymbolValue;
        if (!isNaN(numericValue)) {
            const updatedPointValues = { ...pointValues, [newSymbolName]: numericValue };
            setPointValues(updatedPointValues);
            setValue("symbol", newSymbolName, { shouldDirty: true });
            setIsSymbolDialogOpen(false);
            setNewSymbolName("");
            setNewSymbolValue("");
        } else {
             toast({ title: "Invalid Value", description: "Point value must be a number.", variant: "destructive" });
        }
    }
  };


  const handleCopyNotes = async () => {
    const notes = getValues("notes");
    if (notes) {
      await navigator.clipboard.writeText(notes);
      toast({ title: "Copied!", description: "Notes copied to clipboard." });
    }
  };

  const handlePasteNotes = async () => {
    const text = await navigator.clipboard.readText();
    if (text) {
      const currentNotes = getValues("notes") || "";
      setValue("notes", currentNotes + text, { shouldDirty: true });
      toast({ title: "Pasted!", description: "Text pasted into notes." });
    }
  };

  const handleUploadNotes = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setValue("notes", text, { shouldDirty: true });
        toast({ title: "File Loaded!", description: "Notes loaded from file." });
      };
      reader.readAsText(file);
    }
  };
  
  if (!isClient) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 w-full flex flex-col">
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
            <Button variant="ghost" size="icon" onClick={() => navigateDays(-1)}><ChevronLeft/></Button>
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
                            if(isDirty) saveChanges(form.getValues());
                            router.push(`/log-day?date=${format(d, 'yyyy-MM-dd')}`);
                        }
                    }}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                    initialFocus
                />
                </PopoverContent>
            </Popover>
             <Button variant="ghost" size="icon" onClick={() => navigateDays(1)}><ChevronRight/></Button>
        </div>
        <div className="flex justify-end w-20">
        </div>
      </header>

      <main className="flex-1">
        <FormProvider {...form}>
          <form className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
            
            <div className="md:col-span-1 flex flex-col gap-4">
                <div>
                    <h2 className="font-headline text-sm uppercase text-muted-foreground mb-2">PNL</h2>
                    <FormField
                        control={control}
                        name="pnl"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center font-bold text-lg text-muted-foreground">$</span>
                                    <Input 
                                        type="number"
                                        {...field}
                                        value={field.value ?? ""}
                                        onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
                                        className={cn(pnlColorClass, 'font-bold text-2xl border-0 bg-transparent h-auto p-0 pl-7 text-left focus-visible:ring-0')}
                                        placeholder="0" 
                                    />
                                </div>
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={control} name="contracts" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Contracts</FormLabel>
                            <FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)} placeholder="-" /></FormControl>
                        </FormItem>
                    )}/>
                    <FormField
                        control={control}
                        name="symbol"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Symbol</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                    {field.value || "Select Symbol..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                <CommandInput placeholder="Search or create symbol..." value={symbolSearch} onValueChange={setSymbolSearch} />
                                <CommandList>
                                    <CommandEmpty>
                                        { isClient && symbolSearch.length > 0 && 
                                            <div className="cursor-pointer p-2 hover:bg-muted"
                                                onClick={() => {
                                                    setNewSymbolName(symbolSearch);
                                                    setIsSymbolDialogOpen(true);
                                                    setSymbolSearch("");
                                                }}>
                                                Create "{symbolSearch}"
                                            </div>
                                        }
                                    </CommandEmpty>
                                    <CommandGroup>
                                    {Object.keys(pointValues).map((symbol) => (
                                        <CommandItem
                                            value={symbol}
                                            key={symbol}
                                            onSelect={() => {
                                                setValue("symbol", symbol, { shouldDirty: true, shouldValidate: true });
                                            }}
                                            className="flex justify-between items-center aria-selected:bg-muted hover:aria-selected:bg-muted">
                                            <div className="flex items-center">
                                                <Check className={cn("mr-2 h-4 w-4", symbol === field.value ? "opacity-100" : "opacity-0")}/>
                                                {symbol}
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-destructive/50" onClick={(e) => handleDeleteSymbol(e, symbol)}>
                                                <Trash2 className="h-3 w-3 text-destructive" />
                                            </Button>
                                        </CommandItem>
                                    ))}
                                    </CommandGroup>
                                </CommandList>
                                </Command>
                            </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField control={control} name="points" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Points</FormLabel>
                            <FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)} placeholder="-" /></FormControl>
                        </FormItem>
                    )}/>
                    <FormField
                        control={control}
                        name="playbook"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Playbook</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn(
                                                "w-full justify-between",
                                                !field.value && "text-muted-foreground"
                                            )}
                                            >
                                            {field.value || "-"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command>
                                            <CommandInput placeholder="Search or create..." value={playbookSearch} onValueChange={setPlaybookSearch}/>
                                            <CommandList>
                                                <CommandEmpty>
                                                    { isClient && playbookSearch.length > 0 && <div
                                                        className="cursor-pointer p-2 hover:bg-muted"
                                                        onClick={() => {
                                                            const newValue = playbookSearch;
                                                            if (newValue && !playbookOptions.includes(newValue)) {
                                                                setPlaybookOptions(prev => [...prev, newValue]);
                                                                setValue("playbook", newValue, { shouldDirty: true, shouldValidate: true });
                                                                setPlaybookSearch("");
                                                            }
                                                        }}
                                                        >
                                                        Create "{playbookSearch}"
                                                    </div>}
                                                </CommandEmpty>
                                                <CommandGroup>
                                                    {playbookOptions.map((option) => (
                                                    <CommandItem
                                                        value={option}
                                                        key={option}
                                                        onSelect={(currentValue) => {
                                                            const newValue = currentValue === field.value ? "" : currentValue;
                                                            setValue("playbook", newValue, { shouldDirty: true, shouldValidate: true });
                                                        }}
                                                        className="flex justify-between items-center aria-selected:bg-muted hover:aria-selected:bg-muted"
                                                    >
                                                        <div className="flex items-center">
                                                        <Check className={cn("mr-2 h-4 w-4", field.value === option ? "opacity-100" : "opacity-0")} />
                                                        {option}
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-destructive/50" onClick={(e) => handleDeletePlaybookOption(e, option)}>
                                                            <Trash2 className="h-3 w-3 text-destructive" />
                                                        </Button>
                                                    </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                </div>

                <FormField
                    control={control}
                    name="entryType"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Entry Type</FormLabel>
                                <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="h-auto min-h-10 justify-start">
                                        <div className="flex gap-1 flex-wrap">
                                        {field.value && field.value.length > 0 ? (
                                            field.value.map((item) => (
                                                <Badge
                                                    variant="outline"
                                                    key={item.value}
                                                    className="text-base cursor-pointer hover:bg-destructive/50"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setValue('entryType', field.value?.filter(i => i.value !== item.value), { shouldDirty: true, shouldValidate: true });
                                                    }}
                                                >
                                                    {item.label}
                                                    <X className="ml-1 h-3 w-3" />
                                                </Badge>
                                            ))
                                        ) : (
                                            <span className="text-muted-foreground">{field.value?.length === 0 ? "Select Entry Types..." : "-"}</span>
                                        )}
                                        </div>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search or create..." value={entryTypeSearch} onValueChange={setEntryTypeSearch} />
                                        <CommandList>
                                            <CommandEmpty>
                                                {isClient && entryTypeSearch.length > 0 && <div
                                                    className="cursor-pointer p-2 hover:bg-muted"
                                                    onClick={() => {
                                                        const newValue = entryTypeSearch;
                                                        const newOption = { label: newValue, value: newValue.toLowerCase().replace(/\s+/g, '_') };
                                                        if (newValue && !entryTypeOptions.some(o => o.value === newOption.value)) {
                                                            setEntryTypeOptions(prev => [...prev, newOption]);
                                                            setValue('entryType', [...(field.value || []), newOption], { shouldDirty: true, shouldValidate: true });
                                                        }
                                                        setEntryTypeSearch("");
                                                    }}
                                                >
                                                    Create "{entryTypeSearch}"
                                                </div>}
                                            </CommandEmpty>
                                            <CommandGroup>
                                                {entryTypeOptions.map((option) => {
                                                    const isSelected = field.value?.some(item => item.value === option.value) || false;
                                                    return (
                                                        <CommandItem
                                                            key={option.value}
                                                            onSelect={() => {
                                                                if (isSelected) {
                                                                    setValue('entryType', field.value?.filter(item => item.value !== option.value), { shouldDirty: true, shouldValidate: true });
                                                                } else {
                                                                    setValue('entryType', [...(field.value || []), option], { shouldDirty: true, shouldValidate: true });
                                                                }
                                                            }}
                                                            className="flex justify-between items-center aria-selected:bg-muted hover:aria-selected:bg-muted"
                                                        >
                                                            <div className="flex items-center">
                                                                <div
                                                                    className={cn(
                                                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                                    isSelected
                                                                        ? "bg-primary text-primary-foreground"
                                                                        : "opacity-50 [&_svg]:invisible"
                                                                    )}
                                                                >
                                                                    <Check className={cn("h-4 w-4")} />
                                                                </div>
                                                                <span>{option.label}</span>
                                                            </div>
                                                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-destructive/50" onClick={(e) => handleDeleteEntryTypeOption(e, option.value)}>
                                                                <Trash2 className="h-3 w-3 text-destructive" />
                                                            </Button>
                                                        </CommandItem>
                                                    )
                                                })}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                                </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                    />

                <FormField
                        control={control}
                        name="performance"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Performance</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn(
                                                "w-full justify-between",
                                                !field.value && "text-muted-foreground"
                                            )}
                                            >
                                            {field.value || "-"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command>
                                            <CommandInput placeholder="Search or create..." value={performanceSearch} onValueChange={setPerformanceSearch}/>
                                            <CommandList>
                                                <CommandEmpty>
                                                    { isClient && performanceSearch.length > 0 && <div
                                                        className="cursor-pointer p-2 hover:bg-muted"
                                                        onClick={() => {
                                                            const newValue = performanceSearch;
                                                            if (newValue && !performanceOptions.includes(newValue)) {
                                                                setPerformanceOptions(prev => [...prev, newValue]);
                                                                setValue("performance", newValue, { shouldDirty: true, shouldValidate: true });
                                                                setPerformanceSearch("");
                                                            }
                                                        }}
                                                        >
                                                        Create "{performanceSearch}"
                                                    </div>}
                                                </CommandEmpty>
                                                <CommandGroup>
                                                    {performanceOptions.map((option) => (
                                                    <CommandItem
                                                        value={option}
                                                        key={option}
                                                        onSelect={(currentValue) => {
                                                            const newValue = currentValue === field.value ? "" : currentValue;
                                                            setValue("performance", newValue, { shouldDirty: true, shouldValidate: true });
                                                        }}
                                                        className="flex justify-between items-center aria-selected:bg-muted hover:aria-selected:bg-muted"
                                                    >
                                                        <div className="flex items-center">
                                                        <Check className={cn("mr-2 h-4 w-4", field.value === option ? "opacity-100" : "opacity-0")} />
                                                        {option}
                                                        </div>
                                                        <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-destructive/50" onClick={(e) => handleDeletePerformanceOption(e, option)}>
                                                            <Trash2 className="h-3 w-3 text-destructive" />
                                                        </Button>
                                                    </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                
                <Card className="retro-border">
                    <CardHeader>
                        <CardTitle>R-Multiple</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                        <FormField control={control} name="tp" render={({ field }) => (<FormItem><FormLabel>TP</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)} /></FormControl></FormItem>)}/>
                        <FormField control={control} name="sl" render={({ field }) => (<FormItem><FormLabel>SL</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)} /></FormControl></FormItem>)}/>
                        <FormField control={control} name="maxTp" render={({ field }) => (<FormItem><FormLabel>Max TP</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)} /></FormControl></FormItem>)}/>
                        <FormField control={control} name="maxSl" render={({ field }) => (<FormItem><FormLabel>Max SL</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)} /></FormControl></FormItem>)}/>
                        <FormField control={control} name="entryTime" render={({ field }) => (<FormItem><FormLabel>Entry.T</FormLabel><FormControl><Input type="time" {...field} value={field.value ?? ""} /></FormControl></FormItem>)}/>
                        <FormField control={control} name="exitTime" render={({ field }) => (<FormItem><FormLabel>Exit.T</FormLabel><FormControl><Input type="time" {...field} value={field.value ?? ""} /></FormControl></FormItem>)}/>
                        <div className="col-span-2">
                            <FormField control={control} name="totalTime" render={({ field }) => (<FormItem><FormLabel>Total.T</FormLabel><FormControl><Input {...field} value={field.value ?? ""} readOnly className="cursor-default bg-muted/50" /></FormControl></FormItem>)}/>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="md:col-span-2 flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ImagePasteCard label="Chart (Paste Image)" fieldName="chartImage" />
                    <ImagePasteCard label="Sec Chart (Paste Image)" fieldName="secChartImage" />
                </div>
                <div className="flex-1 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                        <h2 className="font-headline text-sm uppercase text-muted-foreground">Free Notes</h2>
                        <div className="flex items-center gap-2">
                            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={handleCopyNotes}><Copy className="h-4 w-4"/></Button>
                            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={handlePasteNotes}><ClipboardPaste className="h-4 w-4"/></Button>
                            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={handleUploadNotes}><FileUp className="h-4 w-4"/></Button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".txt,.md" className="hidden" />
                        </div>
                    </div>
                    <FormField
                      control={control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Textarea 
                                id="notes-textarea" 
                                className="bg-transparent retro-border p-2 focus-visible:ring-0 text-base h-full resize-none font-rtl" 
                                placeholder="Start writing your notes..." 
                                {...field} 
                                value={field.value ?? ""}
                                dir="auto"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                </div>
            </div>
          </form>
        </FormProvider>
      </main>

       <Dialog open={isSymbolDialogOpen} onOpenChange={setIsSymbolDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Symbol: {newSymbolName}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="point-value" className="text-right">
                Point Value
              </Label>
              <Input
                id="point-value"
                type="number"
                value={newSymbolValue}
                onChange={(e) => setNewSymbolValue(e.target.value)}
                className="col-span-3"
                placeholder="e.g., 2 for MNQ, 20 for NQ"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddNewSymbol}>Save Symbol</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    