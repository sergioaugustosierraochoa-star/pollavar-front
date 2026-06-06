"use client";

import type { Team } from "@pollavar/api-client";
import { useEffect, useState } from "react";

type TeamBadgeProps = {
  label: string;
  team?: Team | null;
  size?: "sm" | "md";
};

export function TeamBadge({ label, team, size = "sm" }: TeamBadgeProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const flag = teamFlag(team, Boolean(team?.logo_url && !logoFailed));
  const initials = teamInitials(team?.short_name || label);
  const isNationalTeam = team?.kind !== "club" && team?.kind !== "custom";
  const boxSize = size === "md" ? "h-8 w-8 text-sm" : "h-6 w-6 text-xs";
  const boxPixels = size === "md" ? 32 : 24;
  const flagPixels = size === "md" ? 22 : 18;
  const logoURL = team?.logo_url && !logoFailed ? team.logo_url : "";
  const badgeStyle = {
    width: boxPixels,
    height: boxPixels,
    minWidth: boxPixels,
    minHeight: boxPixels,
    maxWidth: boxPixels,
    maxHeight: boxPixels,
    flexShrink: 0,
  };
  const flagStyle = {
    width: flagPixels,
    height: flagPixels,
    minWidth: flagPixels,
    minHeight: flagPixels,
    maxWidth: flagPixels,
    maxHeight: flagPixels,
    flexShrink: 0,
  };

  useEffect(() => {
    setLogoFailed(false);
  }, [team?.logo_url]);

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {logoURL ? (
        <img
          alt=""
          className={
            isNationalTeam
              ? "object-contain"
              : `${boxSize} rounded-full border border-zinc-200 object-cover`
          }
          onError={() => setLogoFailed(true)}
          src={logoURL}
          style={isNationalTeam ? flagStyle : badgeStyle}
        />
      ) : flag ? (
        <span
          aria-hidden="true"
          className={`${boxSize} inline-flex items-center justify-center`}
          style={{ ...flagStyle, fontSize: size === "md" ? 20 : 16, lineHeight: 1 }}
        >
          {flag}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={`${boxSize} inline-flex items-center justify-center rounded-full border border-zinc-200 font-semibold`}
          style={{
            ...badgeStyle,
            backgroundColor: safeColor(team?.primary_color) || "#f4f4f5",
            color: safeColor(team?.secondary_color) || "#18181b",
          }}
        >
          {initials}
        </span>
      )}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

function teamFlag(team: Team | null | undefined, hasActiveLogo: boolean) {
  if (!team || hasActiveLogo || team.kind === "club" || team.kind === "custom") {
    return "";
  }
  const code = (team.country_code || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return "";
  }
  return [...code].map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join("");
}

function teamInitials(value: string) {
  return (value || "?").trim().slice(0, 3).toUpperCase();
}

function safeColor(value?: string) {
  const trimmed = value?.trim() ?? "";
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed : "";
}
