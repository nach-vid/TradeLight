
"use client";

import * as React from "react";
import { format } from "date-fns";
import { Plus, Trash2, CalendarIcon, Upload, ChevronLeft, ChevronRight, Copy, ClipboardPaste, FileUp } from "lucide-react";
import { useForm, useFormContext } from "react-hook-form";
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
  symbol: z.string().optional().default(""),
  points: z.coerce.number().optional(),
  pnl: z.coerce.number().optional(),
  playbook: z.string().optional().default(""),
  entryType: z.string().optional().default(""),
  tp: z.coerce.number().optional(),
  sl: z.coerce.number().optional(),
  maxTp: z.coerce.number().optional(),
  maxSl: z.coerce.number().optional(),
  entryTime: z.string().optional().default(""),
  exitTime: z.string().optional().default(""),
  totalTime: z.string().optional().default(""),
  chartImage: z.string().optional().default(""),
  secChartImage: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export type TradeLog = z.infer<typeof tradeLogSchema>;

const SimpleArrowLeft = () => (
  <svg width="8" height="12" viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7.41 1.41L6 0L0 6L6 12L7.41 10.59L2.83 6L7.41 1.41Z" fill="hsl(var(--foreground))" />
  </svg>
);

const InputCard = ({ label, children, className }: { label: string, children: React.ReactNode, className?: string }) => (
    <Card className={cn("retro-border h-24", className)}>
        <CardHeader className="p-2">
            <CardTitle className="font-headline text-xs uppercase text-muted-foreground">{label}</CardTitle>
        </CardHeader>
        <CardContent className="p-2 pt-0">
            {children}
        </CardContent>
    </Card>
);

const ImagePasteCard = ({ label, fieldName, setValue }: { label: string, fieldName: "chartImage" | "secChartImage", setValue: any }) => {
    const { watch } = useFormContext();
    const imageUrl = watch(fieldName);
    const { toast } = useToast();
    
    const handlePaste = async () => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                if (item.types.some(t => t.startsWith("image/"))) {
                    const blob = await item.getType(item.types.find(t => t.startsWith("image/"))!);
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        setValue(fieldName, e.target?.result as string, { shouldDirty: true });
                    };
                    reader.readAsDataURL(blob);
                    toast({ title: "Image Pasted!", description: "The image from your clipboard has been added."});
                    return;
                }
            }
            toast({ variant: "destructive", title: "No Image Found", description: "No image was found on your clipboard." });
        } catch (error) {
            console.error("Failed to read clipboard contents: ", error);
            toast({ variant: "destructive", title: "Paste Failed", description: "Could not paste image from clipboard. Please ensure you have granted permissions." });
        }
    };
    
    return (
        <Card className="retro-border aspect-video flex items-center justify-center relative group">
            {imageUrl ? (
                <>
                    <Image src={imageUrl} alt={label} layout="fill" objectFit="cover" />
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
                    <button type="button" onClick={handlePaste} className="flex flex-col items-center gap-2 hover:text-foreground">
                         <ClipboardPaste className="h-8 w-8" />
                         <span className="text-sm font-headline uppercase">{label}</span>
                    </button>
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
    },
  });

  const { control, getValues, setValue, watch, reset } = form;

    const saveChanges = React.useCallback((values: TradeLog) => {
        if (!values.date) return;
        const key = `trade-log-${format(values.date, 'yyyy-MM-dd')}`;
        
        const dataToSave = {
          ...values,
          date: values.date.toISOString(),
          // We only save the single trade from this form now
          trades: [
            {
              instrument: values.symbol,
              pnl: values.pnl,
              date: values.date,
              notes: values.notes,
              points: values.points,
              playbook: values.playbook,
              entryType: values.entryType,
              tp: values.tp,
              sl: values.sl,
              maxTp: values.maxTp,
              maxSl: values.maxSl,
              entryTime: values.entryTime,
              exitTime: values.exitTime,
              analysisImage: values.chartImage, // Saving main chart image for compatibility
            }
          ]
        };

        const existingLogsRaw = localStorage.getItem('all-trades') || '[]';
        let existingLogs: any[] = [];
        try {
            existingLogs = JSON.parse(existingLogsRaw);
        } catch {
            existingLogs = [];
        }

        const logDateStr = format(values.date, 'yyyy-MM-dd');
        const dayIndex = existingLogs.findIndex(log => log.date && format(new Date(log.date), 'yyyy-MM-dd') === logDateStr);

        if (dayIndex > -1) {
            existingLogs[dayIndex] = dataToSave;
        } else {
            existingLogs.push(dataToSave);
        }
        
        localStorage.setItem(`trade-log-${logDateStr}`, JSON.stringify(dataToSave));
        localStorage.setItem('all-trades', JSON.stringify(existingLogs));

  }, []);

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
            symbol: "", pnl: undefined, points: undefined, playbook: "", entryType: "",
            tp: undefined, sl: undefined, maxTp: undefined, maxSl: undefined,
            entryTime: "", exitTime: "", totalTime: "",
            chartImage: "", secChartImage: "", notes: "",
        };
        
        if (savedData) {
            const parsedData = JSON.parse(savedData);
            reset({ ...parsedData, date: new Date(parsedData.date) });
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
  const pnlBgClass = pnlValue > 0 ? 'bg-green-500/10' : pnlValue < 0 ? 'bg-red-500/10' : 'bg-secondary';

  const dateValue = watch("date");
  
  function nextDay() {
    if (dateValue) {
        setValue("date", new Date(new Date(dateValue).setDate(dateValue.getDate() + 1)), { shouldDirty: true });
    }
  }

  function prevDay() {
     if (dateValue) {
        setValue("date", new Date(new Date(dateValue).setDate(dateValue.getDate() - 1)), { shouldDirty: true });
    }
  }
  
  return (
    <div className="max-w-7xl mx-auto p-4 w-full min-h-screen flex flex-col">
      <header className="relative grid grid-cols-3 items-center h-16 mb-4">
        <div className="flex justify-start">
            <Button variant="ghost" size="icon" asChild>
                <a href="/" onClick={handleBackClick}>
                    <SimpleArrowLeft />
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
                    onSelect={(d) => d && setValue("date", d, { shouldDirty: true })}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                    initialFocus
                />
                </PopoverContent>
            </Popover>
             <Button variant="ghost" size="icon" onClick={nextDay}><ChevronRight/></Button>
        </div>
        <div className="flex justify-end">
            <FormField
                control={control}
                name="pnl"
                render={({ field }) => (
                    <div className={cn("flex items-center rounded-none border border-foreground h-10 w-32", pnlBgClass)}>
                        <span className="px-3 font-bold text-lg">$</span>
                        <Input 
                            type="number"
                            {...field}
                            className={cn(pnlColorClass, 'font-bold text-lg border-0 bg-transparent h-full p-0 text-right pr-3')}
                            placeholder="0" 
                        />
                    </div>
                )}
            />
        </div>
      </header>

      <main className="flex-1">
        <Form {...form}>
          <form className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
            
            <div className="col-span-1 flex flex-col gap-4">
                <InputCard label="Symbol">
                     <FormField control={control} name="symbol" render={({ field }) => (
                        <Input {...field} className="text-xl"/>
                     )}/>
                </InputCard>
                 <InputCard label="Points">
                     <FormField control={control} name="points" render={({ field }) => (
                        <Input type="number" {...field} className="text-xl"/>
                     )}/>
                </InputCard>
                 <InputCard label="Playbook">
                     <FormField control={control} name="playbook" render={({ field }) => (
                        <Input {...field} className="text-xl"/>
                     )}/>
                </InputCard>
                 <InputCard label="Entry Type">
                     <FormField control={control} name="entryType" render={({ field }) => (
                        <Input {...field} className="text-xl"/>
                     )}/>
                </InputCard>
                <Card className="retro-border">
                    <CardHeader className="p-2"><CardTitle className="font-headline text-xs uppercase text-muted-foreground">Performance</CardTitle></CardHeader>
                    <CardContent className="p-2 pt-0 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            <FormField control={control} name="tp" render={({ field }) => (<Input type="number" {...field} placeholder="TP"/>)}/>
                            <FormField control={control} name="sl" render={({ field }) => (<Input type="number" {...field} placeholder="SL"/>)}/>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <FormField control={control} name="maxTp" render={({ field }) => (<Input type="number" {...field} placeholder="Max TP"/>)}/>
                            <FormField control={control} name="maxSl" render={({ field }) => (<Input type="number" {...field} placeholder="Max SL"/>)}/>
                        </div>
                         <div className="grid grid-cols-2 gap-2">
                            <FormField control={control} name="entryTime" render={({ field }) => (<Input type="time" {...field} placeholder="Entry.T"/>)}/>
                            <FormField control={control} name="exitTime" render={({ field }) => (<Input type="time" {...field} placeholder="Exit.T"/>)}/>
                        </div>
                         <FormField control={control} name="totalTime" render={({ field }) => (<Input {...field} placeholder="Total.T"/>)}/>
                    </CardContent>
                </Card>
            </div>

            <div className="col-span-2 flex flex-col gap-6">
                <div className="grid grid-cols-2 gap-6">
                    <ImagePasteCard label="Chart (Paste Image)" fieldName="chartImage" setValue={setValue} />
                    <ImagePasteCard label="Sec Chart (Paste Image)" fieldName="secChartImage" setValue={setValue} />
                </div>
                <Card className="retro-border flex-1 flex flex-col">
                  <CardHeader className="p-2 border-b flex-row items-center justify-between">
                    <CardTitle className="font-headline text-xs uppercase text-muted-foreground">Free Notes</CardTitle>
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
                            <Textarea className="bg-transparent border-0 p-2 focus-visible:ring-0 text-base h-full resize-none" placeholder="Start writing your notes..." {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
