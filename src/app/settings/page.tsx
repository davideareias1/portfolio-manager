"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { DirectoryHandle } from "@/lib/storage/fs";
import { chooseDataDirectory, getPersistedDirectory } from "@/lib/storage/fs";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [dir, setDir] = useState<DirectoryHandle | null>(null);
  const [dirName, setDirName] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const persisted = await getPersistedDirectory();
        if (persisted) {
          setDir(persisted);
          try {
            // Chromium exposes .name on directory handles
            setDirName((persisted as unknown as { name?: string }).name ?? "Selected Folder");
          } catch {
            setDirName("Selected Folder");
          }
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  async function onPickFolder() {
    try {
      const handle = await chooseDataDirectory();
      setDir(handle);
      try {
        setDirName((handle as unknown as { name?: string }).name ?? "Selected Folder");
      } catch {
        setDirName("Selected Folder");
      }
      toast.success("Folder selected");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not select folder";
      toast.error(message);
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>

      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.back()}>← Back</Button>
        <Button onClick={onPickFolder}>Choose Data Folder</Button>
        <span className="text-sm" aria-live="polite">{dir ? `Folder: ${dirName}` : "No folder selected"}</span>
      </div>

      <Separator className="my-8" />

      <section className="text-sm">
        <p>Data is stored locally in the selected folder as JSON.</p>
      </section>
    </main>
  );
}
