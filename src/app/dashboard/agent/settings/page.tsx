"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import {
  SettingsSection,
  Field,
  ToggleRow,
  SaveButton,
  useSettingsForm,
} from "@/components/dashboard/settings-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AgentProfile {
  fullName: string;
  phone: string;
  wilayaCode: number | null;
  isOnline: boolean;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
}

interface AgentPrefs {
  language: string;
  darkMode: boolean;
  notifications: Record<string, boolean>;
  settings: {
    gpsEnabled: boolean;
    gpsPingIntervalSec: number;
    showDistance: boolean;
    autoSubmitEod: boolean;
    eodReportTime: string;
    cashDropOffLocation: string;
  };
}

export default function AgentSettingsPage() {
  const { data: profileData } = useQuery<{ profile: AgentProfile }>({
    queryKey: ["profile-settings"],
    queryFn: async () => {
      const res = await fetch("/api/profile/settings");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: prefsData } = useQuery<{ preferences: AgentPrefs }>({
    queryKey: ["preferences"],
    queryFn: async () => {
      const res = await fetch("/api/preferences");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const profile = useSettingsForm(profileData?.profile, "/api/profile/settings", (v) => ({
    fullName: v.fullName,
    isOnline: v.isOnline,
    workingHoursStart: v.workingHoursStart,
    workingHoursEnd: v.workingHoursEnd,
  }));

  const device = useSettingsForm(prefsData?.preferences.settings, "/api/preferences", (v) => ({
    settings: v,
  }));

  const display = useSettingsForm(
    prefsData?.preferences
      ? {
          language: prefsData.preferences.language,
          darkMode: prefsData.preferences.darkMode,
        }
      : undefined,
    "/api/preferences"
  );

  const notifs = useSettingsForm(
    prefsData?.preferences.notifications,
    "/api/preferences",
    (v) => ({ notifications: v })
  );

  if (!profileData || !prefsData || !profile.values || !device.values) {
    return (
      <div className="mx-auto flex max-w-[430px] justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const p = profile.values;
  const d = device.values;
  const disp = display.values;
  const n = notifs.values ?? {};

  return (
    <div className="mx-auto max-w-[430px] space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Réglages</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/agent">← Tournées</Link>
        </Button>
      </div>

      <SettingsSection
        title="Profil et disponibilité"
        footer={<SaveButton onSave={profile.save} dirty={profile.dirty} />}
      >
        <Field label="Nom complet">
          <Input
            value={p.fullName}
            onChange={(e) => profile.set("fullName", e.target.value)}
          />
        </Field>
        <Field label="Téléphone" hint="Modifiable depuis vos paramètres de compte (code SMS requis).">
          <Input value={p.phone} readOnly className="bg-muted" />
        </Field>
        <Field label="Wilaya assignée" hint="Définie par le manager logistique.">
          <div className="flex h-9 items-center rounded-md border bg-muted px-3">
            <Badge variant="secondary">
              {p.wilayaCode ? `Wilaya ${p.wilayaCode}` : "Non assignée"}
            </Badge>
          </div>
        </Field>
        <ToggleRow
          label="Disponible pour de nouvelles courses"
          description="Hors ligne, vous ne recevez plus d'affectation automatique."
          checked={p.isOnline}
          onChange={(v) => profile.set("isOnline", v)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début de service">
            <Input
              type="time"
              value={p.workingHoursStart ?? "08:00"}
              onChange={(e) => profile.set("workingHoursStart", e.target.value)}
            />
          </Field>
          <Field label="Fin de service">
            <Input
              type="time"
              value={p.workingHoursEnd ?? "17:00"}
              onChange={(e) => profile.set("workingHoursEnd", e.target.value)}
            />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Appareil et notifications"
        footer={
          <div className="flex gap-2">
            <SaveButton onSave={device.save} dirty={device.dirty} />
            <SaveButton
              onSave={notifs.save}
              dirty={notifs.dirty}
              label="Enregistrer les alertes"
            />
          </div>
        }
      >
        <ToggleRow
          label="Suivi GPS"
          description="Partage votre position avec l'acheteur pendant la livraison."
          checked={d.gpsEnabled}
          onChange={(v) => device.set("gpsEnabled", v)}
        />
        <Field
          label="Intervalle d'envoi GPS (secondes)"
          hint="Un intervalle court consomme davantage de batterie."
        >
          <Input
            type="number"
            className="max-w-[120px]"
            value={d.gpsPingIntervalSec}
            onChange={(e) => device.set("gpsPingIntervalSec", Number(e.target.value))}
          />
        </Field>
        <ToggleRow
          label="Sons de notification"
          checked={Boolean(n.soundNotifications)}
          onChange={(v) => notifs.set("soundNotifications", v)}
        />
        <ToggleRow
          label="Notifications push"
          checked={Boolean(n.pushNotifications)}
          onChange={(v) => notifs.set("pushNotifications", v)}
        />
      </SettingsSection>

      {disp && (
        <SettingsSection
          title="Langue et affichage"
          footer={<SaveButton onSave={display.save} dirty={display.dirty} />}
        >
          <Field label="Langue de l'application">
            <Select
              value={disp.language}
              onValueChange={(v) => display.set("language", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <ToggleRow
            label="Mode sombre"
            checked={disp.darkMode}
            onChange={(v) => display.set("darkMode", v)}
          />
          <ToggleRow
            label="Afficher la distance restante"
            description="Sur chaque carte de tâche."
            checked={d.showDistance}
            onChange={(v) => device.set("showDistance", v)}
          />
        </SettingsSection>
      )}

      <SettingsSection
        title="Fin de journée"
        footer={<SaveButton onSave={device.save} dirty={device.dirty} />}
      >
        <ToggleRow
          label="Envoi automatique du rapport"
          description="Soumet le récapitulatif de fin de journée à l'heure choisie."
          checked={d.autoSubmitEod}
          onChange={(v) => device.set("autoSubmitEod", v)}
        />
        <Field label="Heure d'envoi">
          <Input
            type="time"
            className="max-w-[140px]"
            value={d.eodReportTime}
            onChange={(e) => device.set("eodReportTime", e.target.value)}
          />
        </Field>
        <Field label="Lieu de dépôt des espèces">
          <Input
            value={d.cashDropOffLocation}
            placeholder="Ex : Bureau Alger Centre"
            onChange={(e) => device.set("cashDropOffLocation", e.target.value)}
          />
        </Field>
      </SettingsSection>
    </div>
  );
}
