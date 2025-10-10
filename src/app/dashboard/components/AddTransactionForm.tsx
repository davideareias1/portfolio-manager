import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDateUTC } from "./utils";
import { DEFAULT_ASSETS } from "@/lib/domain/assets";

interface AddTransactionFormProps {
  onSubmit: (formData: FormData) => Promise<void>;
}

const assets = [
  { id: "btc", label: "Bitcoin (BTC)" },
  { id: "etf:invesco-ftse-all-world", label: "Invesco FTSE All-World" },
];

export function AddTransactionForm({ onSubmit }: AddTransactionFormProps) {
  const [assetQuery, setAssetQuery] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [dt, setDt] = useState<Date>(() => new Date());

  const selectedDecimals = DEFAULT_ASSETS[selectedAssetId]?.decimals;
  const quantityStep = typeof selectedDecimals === "number"
    ? (selectedDecimals > 0 ? ("0." + "0".repeat(selectedDecimals - 1) + "1") : "1")
    : "any";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Transaction</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end text-sm">
          <div className="grid gap-1 md:col-span-2">
            <Label htmlFor="assetId">Asset</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="justify-start truncate w-full">
                  {assetQuery || "Select asset"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Search assets..." value={assetQuery} onValueChange={setAssetQuery} />
                  <CommandList>
                    <CommandEmpty>No assets found</CommandEmpty>
                    <CommandGroup>
                      {assets
                        .filter((a) => a.label.toLowerCase().includes(assetQuery.toLowerCase()) || a.id.includes(assetQuery))
                        .map((a) => (
                          <CommandItem
                            key={a.id}
                            value={a.id}
                            onSelect={(val) => {
                              setAssetQuery(assets.find((x) => x.id === val)?.label || val);
                              setSelectedAssetId(val);
                              const input = document.getElementById("assetId") as HTMLInputElement | null;
                              if (input) input.value = val;
                            }}
                          >
                            {a.label} <span className="ml-2 text-xs text-muted-foreground">{a.id}</span>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <input id="assetId" name="assetId" type="hidden" />
          </div>
          <div className="grid gap-1 md:col-span-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="justify-start w-full">
                  {formatDateUTC(dt)}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <div className="sm:flex">
                  <Calendar
                    mode="single"
                    selected={dt}
                    onSelect={(d) =>
                      d &&
                      setDt((prev) => {
                        const next = new Date(d);
                        next.setHours(prev.getHours(), prev.getMinutes(), prev.getSeconds(), prev.getMilliseconds());
                        return next;
                      })
                    }
                  />
                  <div className="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x">
                    <ScrollArea className="w-64 sm:w-auto">
                      <div className="flex sm:flex-col p-2">
                        {Array.from({ length: 24 }, (_, i) => i)
                          .reverse()
                          .map((hour) => (
                            <Button
                              key={hour}
                              size="icon"
                              variant={dt.getHours() === hour ? "default" : "ghost"}
                              className="sm:w-full shrink-0 aspect-square"
                              type="button"
                              onClick={() => {
                                setDt((prev) => {
                                  const next = new Date(prev);
                                  next.setHours(hour);
                                  return next;
                                });
                              }}
                            >
                              {hour}
                            </Button>
                          ))}
                      </div>
                      <ScrollBar orientation="horizontal" className="sm:hidden" />
                    </ScrollArea>
                    <ScrollArea className="w-64 sm:w-auto">
                      <div className="flex sm:flex-col p-2">
                        {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                          <Button
                            key={minute}
                            size="icon"
                            variant={dt.getMinutes() === minute ? "default" : "ghost"}
                            className="sm:w-full shrink-0 aspect-square"
                            type="button"
                            onClick={() => {
                              setDt((prev) => {
                                const next = new Date(prev);
                                next.setMinutes(minute);
                                return next;
                              });
                            }}
                          >
                            {minute.toString().padStart(2, "0")}
                          </Button>
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" className="sm:hidden" />
                    </ScrollArea>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <input id="timestamp" name="timestamp" type="hidden" value={dt.toISOString()} readOnly />
          </div>
          
          <div className="grid gap-1">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              step={quantityStep}
              min={0}
              className="h-8"
            />
          </div>
          <div>
            <Button type="submit" size="sm">Add</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
