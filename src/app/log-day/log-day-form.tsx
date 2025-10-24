
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
import { useDebouncedCallback } from "use-debounce";
import { Separator } from "@/components/ui/separator";

const tradeSchema = z.object({
  instrument: z.string().min(1, "Instrument is required."),
  pnl: z.coerce.number(),
  date: z.date(),
  side: z.enum(["buy", "sell"]).optional(),
  entryTime: z.string().optional().default(""),
  exitTime: z.string().optional().default(""),
  contracts: z.coerce.number().optional(),
  tradeTp: z.coerce.number().optional(),
  tradeSl: z.coerce.number().optional(),
  totalPoints: z.coerce.number().optional(),
  analysisImages: z.array(z.string()).default([]),
  notes: z.string().optional().default(""),
});

const dayLogSchema = z.object({
  trades: z.array(tradeSchema),
});

export type DayLog = {
    trades: z.infer<typeof tradeSchema>[]
};

const instrumentOptions = ["MNQ", "NQ", "ES", "MES"];
const instrumentPointValues: { [key: string]: number } = {
  "MNQ": 2, "NQ": 20, "ES": 50, "MES": 5,
};

const optionalFields = [
    { id: 'contracts', label: 'Quantity' },
    { id: 'tradeSl', label: 'Stop Loss' },
    { id: 'tradeTp', label: 'Take Profit' },
    { id: 'entryTime', label: 'Entry Time' },
    { id: 'exitTime', label: 'Exit Time' },
    { id: 'totalPoints', label: 'Points' }
] as const;

type OptionalFieldId = typeof optionalFields[number]['id'];


const SimpleArrowLeft = () => (
  <svg width="8" height="12" viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.41 1.41L6 0L0 6L6 12L7.41 10.59L2.83 6L7.41 1.41Z" fill="hsl(var(--foreground))" />
  </svg>
);

const FormRow = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div className="flex items-center gap-4">
        <FormLabel className="w-28 text-right text-sm text-muted-foreground shrink-0">{label}</FormLabel>
        <div className="flex-1">
            {children}
        </div>
    </div>
);


export default function LogDayForm() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isClient, setIsClient] = React.useState(false);
  const [visibleOptionalFields, setVisibleOptionalFields] = React.useState<Set<OptionalFieldId>>(new Set());

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const form = useForm<z.infer<typeof dayLogSchema>>({
    resolver: zodResolver(dayLogSchema),
    defaultValues: {
      trades: [{
        instrument: "NQ",
        pnl: 0,
        date: new Date(),
        analysisImages: [],
        notes: "",
      }],
    },
  });

  const { control, getValues, setValue, watch, reset } = form;

    const saveChanges = React.useCallback((values: DayLog) => {
        const trade = values.trades[0];
        if (!trade) return;
        const key = `trade-log-${format(trade.date, 'yyyy-MM-dd')}`;
        
        const dataToSave = {
          ...trade,
          date: trade.date.toISOString(),
        };

        const existingLogsRaw = localStorage.getItem('all-trades') || '[]';
        let existingLogs: any[] = [];
        try {
            existingLogs = JSON.parse(existingLogsRaw);
        } catch {
            existingLogs = [];
        }

        const logDateStr = format(trade.date, 'yyyy-MM-dd');
        const dayIndex = existingLogs.findIndex(log => log.date && format(new Date(log.date), 'yyyy-MM-dd') === logDateStr);

        let dayLog;
        if (dayIndex > -1) {
            dayLog = existingLogs[dayIndex];
            // For now, we only support one trade per day in this form.
            // Replace the first trade or add if none exist.
            if (!dayLog.trades) dayLog.trades = [];
            dayLog.trades[0] = dataToSave;
            dayLog.notes = dataToSave.notes;
        } else {
            dayLog = {
                date: trade.date.toISOString(),
                notes: dataToSave.notes,
                trades: [dataToSave]
            }
            existingLogs.push(dayLog);
        }
        
        localStorage.setItem(`trade-log-${logDateStr}`, JSON.stringify(dayLog));
        localStorage.setItem('all-trades', JSON.stringify(existingLogs));

  }, []);

  const debouncedSaveChanges = useDebouncedCallback(saveChanges, 1000);

  React.useEffect(() => {
    if (!isClient) return;
    const subscription = watch((value) => {
        debouncedSaveChanges(value as DayLog);
    });
    return () => subscription.unsubscribe();
  }, [isClient, watch, debouncedSaveChanges]);

    const calculatePnl = () => {
        const trade = getValues("trades.0");
        if (!trade) return;

        const pointValue = instrumentPointValues[trade.instrument] || 0;
        const points = trade.totalPoints || 0;
        const contracts = trade.contracts || 0;
        
        if (points !== 0 && contracts !== 0) {
            const calculatedPnl = points * pointValue * contracts;
            if (getValues("trades.0.pnl") !== calculatedPnl) {
                setValue("trades.0.pnl", calculatedPnl, { shouldDirty: true });
            }
        }
    };

    const addOptionalField = (fieldId: OptionalFieldId) => {
        setVisibleOptionalFields(prev => new Set(prev).add(fieldId));
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
            date: date,
            side: undefined,
            analysisImages: [],
            notes: "",
            entryTime: "",
            exitTime: "",
            contracts: undefined,
            tradeTp: undefined,
            tradeSl: undefined,
            totalPoints: undefined,
        };
        
        if (savedData) {
            const parsedDay = JSON.parse(savedData);
            const parsedTrade = parsedDay.trades?.[0] || {};

            const dataWithDefaults = {
                ...emptyTrade,
                ...parsedTrade,
                date: new Date(parsedDay.date),
                notes: parsedDay.notes || parsedTrade.notes || "",
            };

            const newVisibleFields = new Set<OptionalFieldId>();
            optionalFields.forEach(field => {
                if (dataWithDefaults[field.id] !== undefined && dataWithDefaults[field.id] !== '' && dataWithDefaults[field.id] !== null) {
                    newVisibleFields.add(field.id);
                }
            });
            setVisibleOptionalFields(newVisibleFields);
            
            reset({ trades: [dataWithDefaults] });
        } else {
             reset({
                trades: [emptyTrade],
             });
             setVisibleOptionalFields(new Set());
        }
    }, [searchParams, reset, isClient]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const currentImages = getValues("trades.0.analysisImages") || [];
      const newImages: string[] = [...currentImages];
      
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            newImages.push(e.target.result as string);
            setValue("trades.0.analysisImages", newImages, { shouldDirty: true });
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleRemoveImage = (index: number) => {
    const currentImages = getValues("trades.0.analysisImages") || [];
    const newImages = currentImages.filter((_, i) => i !== index);
    setValue("trades.0.analysisImages", newImages, { shouldDirty: true });
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

  const analysisImages = watch("trades.0.analysisImages") || [];
  const pnlValue = watch("trades.0.pnl") || 0;
  const pnlColorClass = pnlValue > 0 ? 'text-green-500' : pnlValue < 0 ? 'text-red-500' : 'text-foreground';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <header className="relative flex-shrink-0 flex items-center justify-between h-12 px-4 md:px-0 border-b mb-6">
        <Button variant="ghost" size="icon" asChild className="absolute left-0 top-1/2 -translate-y-1/2">
          <a href="/" onClick={handleBackClick}>
            <SimpleArrowLeft />
            <span className="sr-only">Back</span>
          </a>
        </Button>
        <h1 className="text-base font-bold font-headline uppercase mx-auto">
          {isClient ? `Recap ${format(watch("trades.0.date"), "M/d/yy")}` : ' '}
        </h1>
        <div className="w-10"></div>
      </header>

      <main>
        <Form {...form}>
          <form>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="flex flex-col space-y-6">
                <Card className="flex-1 flex flex-col retro-border min-h-[300px]">
                  <CardHeader className="border-b">
                    <CardTitle className="font-headline text-base uppercase">Notes</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-4 flex-1">
                    <FormField
                      control={control}
                      name="trades.0.notes"
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
                <Card className="flex-1 flex flex-col retro-border min-h-[300px]">
                   <CardHeader className="border-b flex-row items-center justify-between">
                        <CardTitle className="font-headline text-base uppercase">Library</CardTitle>
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="h-3 w-3 mr-2" />
                            Upload
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageUpload}
                            className="hidden"
                            accept="image/*"
                            multiple
                        />
                    </CardHeader>
                  <CardContent className="p-4 flex-1">
                    <ScrollArea className="h-full">
                        <div className="grid grid-cols-2 gap-4">
                        {analysisImages.map((src, index) => (
                            <div key={index} className="relative group aspect-video">
                            <Image src={src} alt={`Trade analysis ${index + 1}`} layout="fill" objectFit="cover" />
                            <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                onClick={() => handleRemoveImage(index)}
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                            </div>
                        ))}
                         {analysisImages.length === 0 && (
                            <div className="col-span-2 flex flex-col items-center justify-center gap-2 text-muted-foreground h-full py-10">
                                <Upload className="h-8 w-8" />
                                <p className="text-sm font-medium">Upload screenshots of your trade.</p>
                            </div>
                        )}
                        </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col space-y-4">
                <Card className="retro-border p-4">
                    <div className="space-y-4">
                        <FormRow label="Symbol">
                             <FormField
                                control={control}
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
                                                className="flex items-center space-x-2"
                                            >
                                                {instrumentOptions.map((opt) => (
                                                    <FormItem key={opt} className="flex items-center space-x-1 space-y-0">
                                                        <FormControl>
                                                            <RadioGroupItem value={opt} id={`sym_${opt}`} className="peer sr-only" />
                                                        </FormControl>
                                                        <FormLabel
                                                            htmlFor={`sym_${opt}`}
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
                        </FormRow>
                        <FormRow label="Date">
                             <FormField
                                control={control}
                                name="trades.0.date"
                                render={({ field }) => (
                                    <FormItem>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                variant={"outline"}
                                                className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                                                >
                                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0 retro-border" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                                initialFocus
                                            />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                        </FormRow>
                        <FormRow label="Side">
                            <FormField
                                control={control}
                                name="trades.0.side"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <RadioGroup
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                className="flex items-center space-x-2"
                                            >
                                                <FormItem className="flex items-center space-x-1 space-y-0">
                                                    <FormControl><RadioGroupItem value="buy" id="side_buy" className="peer sr-only" /></FormControl>
                                                    <FormLabel htmlFor="side_buy" className="flex h-7 cursor-pointer items-center justify-center rounded-none border border-foreground bg-transparent px-4 py-1 text-xs font-medium ring-offset-background hover:bg-foreground hover:text-background peer-data-[state=checked]:border-foreground peer-data-[state=checked]:bg-foreground peer-data-[state=checked]:text-background">Buy</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-1 space-y-0">
                                                    <FormControl><RadioGroupItem value="sell" id="side_sell" className="peer sr-only" /></FormControl>
                                                    <FormLabel htmlFor="side_sell" className="flex h-7 cursor-pointer items-center justify-center rounded-none border border-foreground bg-transparent px-4 py-1 text-xs font-medium ring-offset-background hover:bg-foreground hover:text-background peer-data-[state=checked]:border-foreground peer-data-[state=checked]:bg-foreground peer-data-[state=checked]:text-background">Sell</FormLabel>
                                                </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </FormRow>
                        <FormRow label="Gross P&L">
                             <FormField
                                control={control}
                                name="trades.0.pnl"
                                render={({ field }) => (
                                    <Input 
                                        type="number" 
                                        {...field} 
                                        className={cn(pnlColorClass, 'font-bold')}
                                        placeholder="$0.00" 
                                    />
                                )}
                            />
                        </FormRow>
                        
                        {Array.from(visibleOptionalFields).map(fieldId => {
                           const fieldInfo = optionalFields.find(f => f.id === fieldId);
                           if (!fieldInfo) return null;
                           
                           const inputType = (fieldId === 'entryTime' || fieldId === 'exitTime') ? 'time' : 'number';

                           return (
                               <FormRow key={fieldId} label={fieldInfo.label}>
                                   <FormField
                                       control={control}
                                       name={`trades.0.${fieldId}`}
                                       render={({ field }) => (
                                          <Input 
                                            type={inputType}
                                            {...field}
                                            value={field.value ?? ''}
                                            onChange={(e) => {
                                                const val = inputType === 'number' ? e.target.valueAsNumber : e.target.value;
                                                field.onChange(val);
                                                if (fieldId === 'contracts' || fieldId === 'totalPoints') {
                                                    calculatePnl();
                                                }
                                            }}
                                           />
                                       )}
                                   />
                               </FormRow>
                           );
                        })}

                         <div className="flex items-center gap-4">
                            <div className="w-28 text-right text-sm shrink-0"></div>
                            <div className="flex-1">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button type="button" variant="ghost" className="text-green-500 hover:text-green-600 p-0 justify-start">
                                            <Plus className="h-4 w-4 mr-1" /> Add Field
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 p-1 retro-border">
                                        <ul>
                                            {optionalFields.filter(f => !visibleOptionalFields.has(f.id)).map(field => (
                                                <li key={field.id}>
                                                    <Button variant="ghost" className="w-full justify-start" onClick={() => addOptionalField(field.id)}>
                                                        {field.label}
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </div>
                </Card>
              </div>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
