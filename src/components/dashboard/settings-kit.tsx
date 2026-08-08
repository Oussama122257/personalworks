"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

/**
 * Shared building blocks for the nine settings pages: a titled section, a
 * labelled row, a toggle row, a colour field, and the save hook that PUTs a
 * patch and reports the outcome.
 */

export function SettingsSection({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
      {footer && <div className="border-t px-6 py-3">{footer}</div>}
    </Card>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-32 font-mono text-xs uppercase"
        />
      </div>
    </div>
  );
}

/** Uploads a file to /api/upload and returns its public URL. */
export function UploadField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Échec de l'upload");
        return;
      }
      onChange(data.url);
      toast.success("Fichier téléversé");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="h-12 w-12 rounded border object-contain p-1"
          />
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy && <Loader2 className="animate-spin" />}
          {value ? "Remplacer" : "Téléverser"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Retirer
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SaveButton({
  onSave,
  dirty,
  label = "Enregistrer",
}: {
  onSave: () => Promise<void>;
  dirty: boolean;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      disabled={busy || !dirty}
      onClick={async () => {
        setBusy(true);
        try {
          await onSave();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Save />}
      {label}
    </Button>
  );
}

/**
 * Local form state seeded from a fetched value, with a PUT helper.
 * `dirty` compares against the last saved snapshot so the Save button only
 * lights up on real changes.
 */
export function useSettingsForm<T extends object>(
  initial: T | undefined,
  endpoint: string,
  buildBody: (values: T) => unknown = (v) => v
) {
  const [values, setValues] = useState<T | undefined>(initial);
  const savedRef = useRef<string>(JSON.stringify(initial ?? {}));

  useEffect(() => {
    if (initial && values === undefined) {
      setValues(initial);
      savedRef.current = JSON.stringify(initial);
    }
  }, [initial, values]);

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const dirty = values !== undefined && JSON.stringify(values) !== savedRef.current;

  const save = useCallback(async () => {
    if (!values) return;
    const res = await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(values)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Échec de l'enregistrement");
      return;
    }
    savedRef.current = JSON.stringify(values);
    toast.success("Paramètres enregistrés");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, endpoint]);

  return { values, set, setValues, dirty, save };
}
