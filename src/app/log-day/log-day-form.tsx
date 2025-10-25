
"use client";

import * as React from "react";
import { format, differenceInMinutes, parse } from "date-fns";
import { Plus, Trash2, CalendarIcon, Upload, ChevronLeft, ChevronRight, Copy, ClipboardPaste, FileUp, X, Check, ChevronsUpDown } from "lucide-react";
import { useForm, useFormContext, Controller, FormProvider }from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Image from "next/image";
import { MultiSelect } from "react-multi-select-component";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";


const tradeLogSchema = z.object({
  date: z.date(),
  symbol: z.string().optional(),
  pnl: z.coerce.number().optional(),
  contracts: z.coerce.number().optional(),
  points: z.coerce.number().optional(),
  playbook: z.string().optional(),
  entryType: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
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

// --- Configuration for PNL Calculation ---
const pointValues: Record<string, number> = {
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


const ImagePasteCard = ({ label, fieldName }: { label: string, fieldName: "chartImage" | "secChartImage" }) => {
    const { watch, setValue } = useFormContext<TradeLog>();
    const imageUrl = watch(fieldName);
    
    return (
        <Dialog>
            <Card className="retro-border aspect-video flex items-center justify-center relative group">
                {imageUrl ? (
                    <>
                        <DialogTrigger asChild>
                            <Image src={imageUrl} alt={label} layout="fill" objectFit="cover" className="rounded-none cursor-pointer" />
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
  const [playbookOptions, setPlaybookOptions] = React.useState(defaultPlaybookOptions);
  const [entryTypeOptions, setEntryTypeOptions] = React.useState(defaultEntryTypeOptions);


  React.useEffect(() => {
    setIsClient(true);
    const savedPlaybooks = localStorage.getItem('playbook-options');
    if (savedPlaybooks) {
        setPlaybookOptions(JSON.parse(savedPlaybooks));
    }
    const savedEntryTypes = localStorage.getItem('entry-type-options');
    if (savedEntryTypes) {
        setEntryTypeOptions(JSON.parse(savedEntryTypes));
    }
  }, []);

  const form = useForm<z.infer<typeof tradeLogSchema>>({
    resolver: zodResolver(tradeLogSchema),
    defaultValues: {
      date: new Date(),
      symbol: "MNQ",
      pnl: 0,
      contracts: 0,
      points: 0,
      playbook: "",
      entryType: [],
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

    React.useEffect(() => {
        if (!isClient) return;

        const handlePaste = (event: ClipboardEvent) => {
            const items = event.clipboardData?.items;
            if (!items) return;

            // Do not paste if the active element is an input or textarea
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || (activeElement as HTMLElement).isContentEditable)) {
                return;
            }

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
    }, [isClient, getValues, setValue, toast]);


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
        localStorage.setItem('playbook-options', JSON.stringify(playbookOptions));
        localStorage.setItem('entry-type-options', JSON.stringify(entryTypeOptions));

  }, [playbookOptions, entryTypeOptions]);

  const debouncedSaveChanges = useDebouncedCallback(saveChanges, 1000);

  React.useEffect(() => {
    if (!isClient) return;
    const subscription = watch((values, { name, type }) => {
        const watchedValues = values as TradeLog;
        
        if (name === 'points' || name === 'contracts' || name === 'symbol') {
            const points = watchedValues.points ?? 0;
            const contracts = watchedValues.contracts ?? 0;
            const symbol = watchedValues.symbol ?? "";
            const pointValue = pointValues[symbol] || 0;
            const newPnl = points * pointValue * contracts;
            if (watchedValues.pnl !== newPnl) {
                setValue('pnl', newPnl, { shouldDirty: true, shouldValidate: true });
            }
        }
        
        if (name === 'entryTime' || name === 'exitTime') {
            const { entryTime, exitTime } = watchedValues;
            if (entryTime && exitTime) {
                const today = new Date();
                const entryDateTime = parse(entryTime, 'HH:mm', today);
                const exitDateTime = parse(exitTime, 'HH:mm', today);

                if (!isNaN(entryDateTime.getTime()) && !isNaN(exitDateTime.getTime())) {
                    const diff = differenceInMinutes(exitDateTime, entryDateTime);
                    setValue('totalTime', `${diff} min`, { shouldDirty: true, shouldValidate: true });
                }
            }
        }

        debouncedSaveChanges(watchedValues);
    });
    return () => subscription.unsubscribe();
  }, [isClient, watch, debouncedSaveChanges, setValue]);

    React.useEffect(() => {
        if (!isClient) return;
        const dateParam = searchParams.get('date');
        const date = dateParam ? new Date(dateParam) : new Date();
        const key = `trade-log-${format(date, 'yyyy-MM-dd')}`;
        const savedData = localStorage.getItem(key);

        const emptyLog = {
            date: date,
            symbol: "MNQ", 
            pnl: 0, 
            contracts: 0,
            points: 0, 
            playbook: "", 
            entryType: [], 
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
            const loadedPlaybook = tradeData.playbook || "";
            if (loadedPlaybook && !playbookOptions.includes(loadedPlaybook)) {
                setPlaybookOptions(prev => [...prev, loadedPlaybook]);
            }
             const loadedEntryTypes = tradeData.entryType || [];
             const newEntryTypes = loadedEntryTypes.filter((et: {label: string, value: string}) => !entryTypeOptions.some(o => o.value === et.value));
             if (newEntryTypes.length > 0) {
                 setEntryTypeOptions(prev => [...prev, ...newEntryTypes]);
             }
            reset({ ...emptyLog, ...parsedData, ...tradeData, date: new Date(parsedData.date) });
        } else {
             reset(emptyLog);
        }
    }, [searchParams, reset, isClient, playbookOptions, entryTypeOptions]);


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

  const handleDeletePlaybookOption = (e: React.MouseEvent, option: string) => {
    e.stopPropagation();
    setPlaybookOptions(prev => prev.filter(item => item !== option));
  };
  
  const handleDeleteEntryTypeOption = (e: React.MouseEvent, value: string) => {
    e.stopPropagation();
    setEntryTypeOptions(prev => prev.filter(item => item.value !== value));
  };
  
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
                                                readOnly
                                                className={cn(pnlColorClass, 'font-bold text-2xl border-0 bg-transparent h-auto p-0 pl-7 text-left focus-visible:ring-0 cursor-default')}
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
                                    <FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? '' : e.target.valueAsNumber)} className="text-xl"/></FormControl>
                                </FormItem>
                             )}/>
                             <FormField control={control} name="symbol" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs uppercase text-muted-foreground">Symbol</FormLabel>
                                    <FormControl>
                                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                            <SelectTrigger className="text-xl">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.keys(pointValues).map(symbol => (
                                                    <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                </FormItem>
                             )}/>
                        </div>
                         <FormField control={control} name="points" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs uppercase text-muted-foreground">Points</FormLabel>
                                <FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? '' : e.target.valueAsNumber)} className="text-xl"/></FormControl>
                            </FormItem>
                         )}/>
                         <FormField
                            control={control}
                            name="playbook"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-xs uppercase text-muted-foreground">Playbook</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className={cn(
                                                    "w-full justify-between text-xl h-10",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                                >
                                                {field.value ? field.value : ""}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search or create..." />
                                                <CommandList>
                                                    <CommandEmpty>
                                                         <div
                                                            className="cursor-pointer p-2"
                                                            onClick={() => {
                                                                const input = document.querySelector('[cmdk-input]') as HTMLInputElement;
                                                                const newValue = input.value;
                                                                if (newValue && !playbookOptions.includes(newValue)) {
                                                                    setPlaybookOptions(prev => [...prev, newValue]);
                                                                    setValue("playbook", newValue, { shouldDirty: true, shouldValidate: true });
                                                                }
                                                            }}
                                                            >
                                                            Create "{ (document.querySelector('[cmdk-input]') as HTMLInputElement)?.value }"
                                                        </div>
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
                                                            className="flex justify-between items-center"
                                                        >
                                                          <div className="flex items-center">
                                                            <Check className={cn("mr-2 h-4 w-4", field.value === option ? "opacity-100" : "opacity-0")} />
                                                            {option}
                                                          </div>
                                                           <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => handleDeletePlaybookOption(e, option)} onSelect={(e) => e.preventDefault()}>
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
                         <FormField
                            control={control}
                            name="entryType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs uppercase text-muted-foreground">Entry Type</FormLabel>
                                     <FormControl>
                                        <MultiSelect
                                            options={entryTypeOptions}
                                            value={field.value || []}
                                            onChange={field.onChange}
                                            labelledBy="Select Entry Types"
                                            className="multi-select-override"
                                            overrideStrings={{ "selectSomeItems": " " }}
                                            ItemRenderer={({ checked, option, onClick }) => (
                                                <div className="flex justify-between items-center w-full item-renderer p-2 cursor-pointer" onClick={onClick}>
                                                    <div className="flex items-center">
                                                        <input type="checkbox" checked={checked} onChange={() => {}} className="mr-2" />
                                                        <span>{option.label}</span>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => handleDeleteEntryTypeOption(e, option.value)} >
                                                        <Trash2 className="h-3 w-3 text-destructive" />
                                                    </Button>
                                                </div>
                                            )}
                                            onCreateOption={(value) => {
                                                const newOption = { label: value, value: value.toLowerCase().replace(/\s+/g, '_') };
                                                setEntryTypeOptions([...entryTypeOptions, newOption]);
                                                setValue('entryType', [...(field.value || []), newOption]);
                                            }}
                                            isCreatable={true}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                            />
                    </CardContent>
                </Card>
                <Card className="retro-border">
                    <CardHeader className="p-4"><CardTitle className="font-headline text-sm uppercase text-muted-foreground">Performance</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={control} name="tp" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase text-muted-foreground">TP</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? '' : e.target.valueAsNumber)} /></FormControl></FormItem>)}/>
                            <FormField control={control} name="sl" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase text-muted-foreground">SL</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? '' : e.target.valueAsNumber)} /></FormControl></FormItem>)}/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={control} name="maxTp" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase text-muted-foreground">Max TP</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? '' : e.target.valueAsNumber)} /></FormControl></FormItem>)}/>
                            <FormField control={control} name="maxSl" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase text-muted-foreground">Max SL</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === '' ? '' : e.target.valueAsNumber)} /></FormControl></FormItem>)}/>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <FormField control={control} name="entryTime" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase text-muted-foreground">Entry Time</FormLabel><FormControl><Input type="time" {...field} value={field.value ?? ""} /></FormControl></FormItem>)}/>
                            <FormField control={control} name="exitTime" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase text-muted-foreground">Exit Time</FormLabel><FormControl><Input type="time" {...field} value={field.value ?? ""} /></FormControl></FormItem>)}/>
                        </div>
                         <FormField control={control} name="totalTime" render={({ field }) => (<FormItem><FormLabel className="text-xs uppercase text-muted-foreground">Total Time</FormLabel><FormControl><Input {...field} value={field.value ?? ""} readOnly className="cursor-default" /></FormControl></FormItem>)}/>
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

    

    

    