import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-dvh px-6 py-10">
      <div className="mx-auto max-w-4xl flex flex-col gap-8">
        <h1 className="text-4xl font-bold tracking-tight">Portfolio Manager</h1>
        <p className="max-w-2xl text-base">
          Track deployed capital and real returns. Pure black and white. Local-first.
        </p>
        <div className="flex gap-4">
          <Button asChild arrow>
            <Link href="/dashboard">Open Dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings">Settings</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
