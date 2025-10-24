
"use client";

import * as React from "react";
import { format } from "date-fns";
import { Plus, Trash2, CalendarIcon, Upload, ChevronDown, X, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { useFieldArray, useForm } from "react-hook-form";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDebouncedCallback }from "use-debounce";
import { Separator } from "@/components/ui/separator";


const tradeSchema = z.object({
  instrument: z.string().min(1, "Instrument is required."),
  pnl: z.coerce.number(),
  entryTime: z.string().optional().default(""),
  exitTime: z.string().optional().default(""),
  contracts: z.coerce.number().optional(),
  tradeTp: z.coerce.number().optional(),
  tradeSl: z.coerce.number().optional(),
  totalPoints: z.coerce.number().optional(),
  analysisImage: z.string().optional().default(""),
});

const dayLogSchema = z.object({
  date: z.date(),
  notes: z.string().optional().default(""),
  trades: z.array(tradeSchema),
});

export type DayLog = z.infer<typeof dayLogSchema>;

const instrumentOptions = ["MNQ", "NQ", "ES", "MES"];
const instrumentPointValues: { [key: string]: number } = {
    "MNQ": 2,
    "NQ": 20,
    "ES": 50,
    "MES": 5,
};

const SimpleArrowLeft = () => (
    <svg width="8" height="12" viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7.41 1.41L6 0L0 6L6 12L7.41 10.59L2.83 6L7.41 1.41Z" fill="hsl(var(--foreground))"/>
    </svg>
);


const TradeDataField = ({ label, children }: { label: string, children: React.ReactNode }) => {
    return (
        <div className="space-y-1">
            <FormLabel className="text-xs font-medium tracking-widest uppercase text-muted-foreground">{label}</FormLabel>
            <div className='relative'>
                {children}
                <Separator className="bg-border" />
            </div>
        </div>
    );
};


export default function LogDayForm() {
    const { toast } = useToast();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isEditingPnl, setIsEditingPnl] = React.useState(false);
    const pnlInputRef = React.useRef<HTMLInputElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isClient, setIsClient] = React.useState(false);
    
    React.useEffect(() => {
        setIsClient(true);
    }, []);

    const form = useForm<z.infer<typeof dayLogSchema>>({
        resolver: zodResolver(dayLogSchema),
        defaultValues: {
            date: new Date(),
            notes: "",
            trades: [{ 
                instrument: "NQ", 
                pnl: 0, 
                analysisImage: "",
                entryTime: "",
                exitTime: "",
                contracts: undefined,
                tradeTp: undefined,
                tradeSl: undefined,
                totalPoints: undefined,
            }],
        },
    });
    
    const { control, getValues, setValue, watch } = form;

    const { fields, update } = useFieldArray({
        control: form.control,
        name: "trades",
    });
    
    const saveChanges = React.useCallback((values: DayLog) => {
        const key = `trade-log-${format(values.date, 'yyyy-MM-dd')}`;
        
        const dataToSave = {
            ...values,
            date: values.date.toISOString(), 
        };
        localStorage.setItem(key, JSON.stringify(dataToSave));
        
        const allLogs = Object.keys(localStorage)
            .filter(k => k.startsWith('trade-log-'))
            .map(k => {
                try {
                    return JSON.parse(localStorage.getItem(k) as string)
                } catch {
                    return null;
                }
            }).filter(Boolean);

        localStorage.setItem('all-trades', JSON.stringify(allLogs));
    }, []);

    const debouncedSaveChanges = useDebouncedCallback(saveChanges, 2000);
    
    React.useEffect(() => {
        if (!isClient) return;
        const subscription = watch((value) => {
            debouncedSaveChanges(value as DayLog);
        });
        return () => subscription.unsubscribe();
    }, [isClient, watch, debouncedSaveChanges]);

    const calculatePnl = () => {
        const values = getValues();
        const watchedInstrument = values.trades[0].instrument;
        const watchedPoints = values.trades[0].totalPoints;
        const watchedContracts = values.trades[0].contracts;

        const pointValue = instrumentPointValues[watchedInstrument] || 0;
        const points = watchedPoints || 0;
        const contracts = watchedContracts || 0;
        
        if (points !== 0 && contracts !== 0) {
            const calculatedPnl = points * pointValue * contracts;
            if (getValues("trades.0.pnl") !== calculatedPnl) {
                setValue("trades.0.pnl", calculatedPnl, { shouldDirty: true });
            }
        }
    };


    React.useEffect(() => {
        if (!isClient) return;
        const dateParam = searchParams.get('date');
        const date = dateParam ? new Date(dateParam) : new Date();
        const key = `trade-log-${format(date, 'yyyy-MM-dd')}`;
        const savedData = localStorage.getItem(key);

        const emptyTrade = {
            instrument: "NQ",
            pnl: 0,
            analysisImage: "",
            entryTime: "",
            exitTime: "",
            contracts: undefined,
            tradeTp: undefined,
            tradeSl: undefined,
            totalPoints: undefined,
        };
        
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            parsedData.date = new Date(parsedData.date);
            
            const tradeWithDefaults = {
                ...emptyTrade,
                ...(parsedData.trades?.[0] || {}),
            };

            const dataWithDefaults = {
                date: parsedData.date,
                notes: parsedData.notes || "",
                trades: [tradeWithDefaults],
            };
            
            form.reset(dataWithDefaults);
        } else {
             form.reset({
                date: date,
                notes: "",
                trades: [emptyTrade],
             });
        }
    }, [searchParams, form, isClient]);
    
    const handleImagePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
        const items = event.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        form.setValue("trades.0.analysisImage", e.target?.result as string, { shouldDirty: true });
                    };
                    reader.readAsDataURL(file);
                }
            }
        }
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                form.setValue("trades.0.analysisImage", e.target?.result as string, { shouldDirty: true });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        form.setValue("trades.0.analysisImage", "", { shouldDirty: true });
    };
    
    const handleBackClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        await saveChanges(form.getValues());
        toast({
            title: "Changes Saved!",
            description: "Your recap has been updated.",
        });
        router.push('/');
    };
    
    const allTrades = form.watch("trades");
    const totalPnl = allTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
    const analysisImage = form.watch("trades.0.analysisImage");


    const handlePnlDoubleClick = () => {
        setIsEditingPnl(true);
    };

    const handlePnlBlur = () => {
        setIsEditingPnl(false);
    };

    const handlePnlKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            const newPnl = parseFloat(event.currentTarget.value);
            if (!isNaN(newPnl) && fields[0]) {
                update(0, {...fields[0], pnl: newPnl });
            }
            setIsEditingPnl(false);
        } else if (event.key === 'Escape') {
            setIsEditingPnl(false);
        }
    };
    
    React.useEffect(() => {
        if (isEditingPnl && pnlInputRef.current) {
            pnlInputRef.current.focus();
            pnlInputRef.current.select();
        }
    }, [isEditingPnl]);
    
        
    const pnlValue = fields[0]?.pnl ?? totalPnl;
    const pnlColorClass = pnlValue > 0 ? 'text-green-500' : pnlValue < 0 ? 'text-red-500' : 'text-foreground';


  return (
    <div className="flex flex-col h-screen max-h-screen text-foreground bg-background p-4">
        <header className="relative flex-shrink-0 flex items-center justify-between h-12 px-4 md:px-0 border-b">
            <Button variant="ghost" size="icon" asChild className="absolute left-0 top-1/2 -translate-y-1/2">
                <a href="/" onClick={handleBackClick}>
                    <SimpleArrowLeft />
                    <span className="sr-only">Back</span>
                </a>
            </Button>
            <h1 className="text-base font-bold font-headline uppercase mx-auto">
                {isClient ? `Recap ${format(form.watch("date"), "M/d/yy")}` : ' '}
            </h1>
            <div className="w-10"></div>
        </header>

        <main className="flex-1 overflow-hidden py-6">
            <Form {...form}>
                <form className="h-full">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                        <div className="flex flex-col space-y-6">
                           <Card className="retro-border">
                                <CardContent className="p-4">
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                        
                                        <div className="col-span-1 space-y-1">
                                            <FormLabel className="text-xs font-medium tracking-widest uppercase text-muted-foreground">PNL</FormLabel>
                                            <div onDoubleClick={handlePnlDoubleClick} className="relative">
                                                {isEditingPnl ? (
                                                    <Input
                                                        ref={pnlInputRef}
                                                        type="number"
                                                        defaultValue={pnlValue}
                                                        onBlur={handlePnlBlur}
                                                        onKeyDown={handlePnlKeyDown}
                                                        className={cn(
                                                            `text-2xl font-bold h-auto p-0 border-0 focus-visible:ring-0 bg-transparent`,
                                                            `[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`,
                                                            pnlColorClass
                                                        )}
                                                    />
                                                ) : (
                                                    <p className={cn(`text-2xl font-bold`, pnlColorClass)}>
                                                        {pnlValue.toLocaleString("en-US", { style: "currency", currency: "USD"})}
                                                    </p>
                                                )}
                                                <Separator className="bg-border" />
                                            </div>
                                        </div>

                                        <div className="col-span-1">
                                            <FormField
                                                control={form.control}
                                                name="date"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col space-y-1">
                                                        <FormLabel className="text-xs font-medium tracking-widest uppercase text-muted-foreground">Date</FormLabel>
                                                        <div className="relative">
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                <FormControl>
                                                                    <Button
                                                                    variant={"ghost"}
                                                                    className={cn(
                                                                        "w-full justify-start text-left font-normal p-0 h-auto text-base hover:bg-transparent hover:text-foreground",
                                                                        !field.value && "text-muted-foreground"
                                                                    )}
                                                                    >
                                                                    <div className="flex-1">
                                                                        {field.value && isClient ? (
                                                                            format(field.value, "PPP")
                                                                        ) : (
                                                                            <span>Pick a date</span>
                                                                        )}
                                                                    </div>
                                                                    <CalendarIcon className="h-4 w-4 opacity-50" />
                                                                    </Button>
                                                                </FormControl>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-auto p-0 retro-border" align="start">
                                                                <Calendar
                                                                    mode="single"
                                                                    selected={field.value}
                                                                    onSelect={field.onChange}
                                                                    disabled={(date) =>
                                                                    date > new Date() || date < new Date("1900-01-01")
                                                                    }
                                                                    initialFocus
                                                                />
                                                                </PopoverContent>
                                                            </Popover>
                                                            <Separator className="bg-border" />
                                                        </div>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <FormField
                                                control={form.control}
                                                name="trades.0.instrument"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <RadioGroup
                                                                onValueChange={(value) => {
                                                                    field.onChange(value);
                                                                    calculatePnl();
                                                                }}
                                                                value={field.value}
                                                                className="flex items-center space-x-2 pt-2"
                                                            >
                                                                {instrumentOptions.map((opt) => (
                                                                    <FormItem key={opt} className="flex items-center space-x-1 space-y-0">
                                                                        <FormControl>
                                                                            <RadioGroupItem value={opt} id={opt} className="peer sr-only" />
                                                                        </FormControl>
                                                                        <FormLabel
                                                                            htmlFor={opt}
                                                                            className="flex h-7 cursor-pointer items-center justify-center rounded-none border border-foreground bg-transparent px-2 py-1 text-xs font-medium ring-offset-background hover:bg-foreground hover:text-background peer-data-[state=checked]:border-foreground peer-data-[state=checked]:bg-foreground peer-data-[state=checked]:text-background"
                                                                        >
                                                                            {opt}
                                                                        </FormLabel>
                                                                    </FormItem>
                                                                ))}
                                                            </RadioGroup>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="col-span-1">
                                            <TradeDataField label="Entry">
                                                <FormField
                                                    control={form.control}
                                                    name="trades.0.entryTime"
                                                    render={({ field }) => <Input type="time" {...field} className="border-0 p-0 text-base h-auto" />}
                                                />
                                            </TradeDataField>
                                        </div>
                                        <div className="col-span-1">
                                            <TradeDataField label="Exit">
                                                <FormField
                                                    control={form.control}
                                                    name="trades.0.exitTime"
                                                    render={({ field }) => <Input type="time" {...field} className="border-0 p-0 text-base h-auto" />}
                                                />
                                            </TradeDataField>
                                        </div>
                                        
                                        <div className="col-span-1">
                                            <TradeDataField label="Contracts">
                                                <FormField
                                                control={form.control}
                                                name="trades.0.contracts"
                                                render={({ field }) => <Input type="number" {...field} value={field.value ?? ''} onChange={(e) => {field.onChange(e.target.valueAsNumber); calculatePnl();}} className="border-0 p-0 text-base h-auto" />}
                                                />
                                            </TradeDataField>
                                        </div>

                                        <div className="col-span-1">
                                            <TradeDataField label="Points">
                                                <FormField
                                                    control={form.control}
                                                    name="trades.0.totalPoints"
                                                    render={({ field }) => <Input type="number" {...field} value={field.value ?? ''} onChange={(e) => {field.onChange(e.target.valueAsNumber); calculatePnl();}} className="border-0 p-0 text-base h-auto" />}
                                                />
                                            </TradeDataField>
                                        </div>
                                        
                                        <div className="col-span-1">
                                            <TradeDataField label="TP">
                                                <FormField
                                                control={form.control}
                                                name="trades.0.tradeTp"
                                                render={({ field }) => <Input type="number" {...field} value={field.value ?? ''} className="border-0 p-0 text-base h-auto" />}
                                                />
                                            </TradeDataField>
                                        </div>
                                        
                                        <div className="col-span-1">
                                            <TradeDataField label="SL">
                                                <FormField
                                                control={form.control}
                                                name="trades.0.tradeSl"
                                                render={({ field }) => <Input type="number" {...field} value={field.value ?? ''} className="border-0 p-0 text-base h-auto" />}
                                                />
                                            </TradeDataField>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="flex-1 flex flex-col retro-border">
                                <CardHeader className="border-b">
                                    <CardTitle className="font-headline text-base uppercase">Notes</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 pt-4 flex-1">
                                    <FormField
                                        control={form.control}
                                        name="notes"
                                        render={({ field }) => (
                                            <FormItem className="h-full">
                                            <FormControl>
                                                <Textarea className="bg-transparent border-0 p-0 focus-visible:ring-0 text-base h-full resize-none" placeholder="General notes for the day..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>
                        </div>
                        <div className="flex flex-col space-y-6">
                            <Card onPaste={handleImagePaste} className="overflow-hidden flex-1 flex flex-col group retro-border">
                                <CardContent className="p-0 flex-1 flex flex-col relative">
                                    {analysisImage ? (
                                        <div className="w-full h-full relative overflow-hidden">
                                            <div className="absolute" style={{top: '0px', bottom: '0px', left: '0px', right: '0px'}}>
                                                <Image src={analysisImage} alt="Trade analysis" layout="fill" objectFit="cover" />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="icon"
                                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                                onClick={handleRemoveImage}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                <span className="sr-only">Remove image</span>
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground h-full">
                                            <Upload className="h-8 w-8" />
                                            <p className="text-sm font-medium">Paste or upload an image of your trade.</p>
                                            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                                Upload File
                                            </Button>
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleImageUpload}
                                                className="hidden"
                                                accept="image/*"
                                            />
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </form>
            </Form>
        </main>
    </div>
  );
}

    