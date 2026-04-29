import * as TabsPrimitive from "@radix-ui/react-tabs";

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ children }: { children: React.ReactNode }) {
  return <TabsPrimitive.List className="inline-flex gap-1 overflow-x-auto rounded-full bg-gray-100 p-1 dark:bg-gray-800">{children}</TabsPrimitive.List>;
}

export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className="rounded-full px-3 py-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700 data-[state=active]:bg-gray-900 data-[state=active]:text-white dark:hover:text-gray-300 dark:data-[state=active]:bg-gray-100 dark:data-[state=active]:text-gray-900"
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}
