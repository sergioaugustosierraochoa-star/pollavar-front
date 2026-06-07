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
  const flagSlotPixels = size === "md" ? 22 : 18;
  const flagScale = nationalFlagVisualScale(team);
  const flagImageScale = nationalFlagImageVisualScale(team);
  const flagFontSize = (size === "md" ? 17 : 12) * flagScale;
  const logoURL = team?.logo_url && !logoFailed ? team.logo_url : "";
  const badgeStyle = {
    width: boxPixels,
    height: boxPixels,
    minWidth: boxPixels,
    minHeight: boxPixels,
    maxWidth: boxPixels,
    maxHeight: boxPixels,
    display: "inline-grid",
    flexShrink: 0,
    marginRight: size === "md" ? 2 : 1,
    placeItems: "center",
  };
  const flagStyle = {
    width: flagSlotPixels,
    height: flagSlotPixels,
    minWidth: flagSlotPixels,
    minHeight: flagSlotPixels,
    maxWidth: flagSlotPixels,
    maxHeight: flagSlotPixels,
    display: "inline-grid",
    flexShrink: 0,
    marginRight: size === "md" ? 2 : 1,
    placeItems: "center",
  };
  const flagVisualStyle = {
    width: flagSlotPixels,
    height: flagSlotPixels,
    maxWidth: flagSlotPixels,
    maxHeight: flagSlotPixels,
    transform: `scale(${flagImageScale})`,
  };

  useEffect(() => {
    setLogoFailed(false);
  }, [team?.logo_url]);

  return (
    <span
      className="inline-flex min-w-0 flex-nowrap items-center whitespace-nowrap align-middle leading-none"
      style={{ columnGap: size === "md" ? 12 : 10 }}
    >
      {logoURL ? (
        isNationalTeam ? (
          <span aria-hidden="true" className="overflow-hidden" style={flagStyle}>
            <img
              alt=""
              className="object-contain"
              onError={() => setLogoFailed(true)}
              src={logoURL}
              style={flagVisualStyle}
            />
          </span>
        ) : (
          <img
            alt=""
            className={`${boxSize} rounded-full border border-zinc-200 object-cover`}
            onError={() => setLogoFailed(true)}
            src={logoURL}
            style={badgeStyle}
          />
        )
      ) : flag ? (
        <span
          aria-hidden="true"
          className="overflow-hidden"
          style={{ ...flagStyle, fontSize: flagFontSize, lineHeight: 1, verticalAlign: "middle" }}
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
      <span
        className="min-w-0 truncate whitespace-nowrap leading-tight"
        style={{ paddingLeft: size === "md" ? 2 : 3 }}
      >
        {label}
      </span>
    </span>
  );
}

function nationalFlagVisualScale(team: Team | null | undefined) {
  const code = (team?.country_code || "").trim().toUpperCase();
  const shortName = (team?.short_name || "").trim().toUpperCase();
  const name = (team?.name || "").trim().toUpperCase();
  const oversizedFlagCodes = new Set(["EN", "ENG", "GB-ENG", "SCO", "GB-SCT"]);
  if (
    oversizedFlagCodes.has(code) ||
    oversizedFlagCodes.has(shortName) ||
    name === "ENGLAND" ||
    name === "SCOTLAND"
  ) {
    return 0.48;
  }
  return 1;
}

function nationalFlagImageVisualScale(team: Team | null | undefined) {
  const code = (team?.country_code || "").trim().toUpperCase();
  const shortName = (team?.short_name || "").trim().toUpperCase();
  const name = (team?.name || "").trim().toUpperCase();
  const oversizedFlagCodes = new Set(["EN", "ENG", "GB-ENG", "SCO", "GB-SCT"]);
  if (
    oversizedFlagCodes.has(code) ||
    oversizedFlagCodes.has(shortName) ||
    name === "ENGLAND" ||
    name === "SCOTLAND"
  ) {
    return 0.7;
  }
  return 1;
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
