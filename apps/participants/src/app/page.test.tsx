import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ParticipantsHome from "./page";

describe("Participants home", () => {
  it("renders the participant portal header and summary metrics", () => {
    render(<ParticipantsHome />);

    expect(
      screen.getByRole("heading", {
        name: "Portal del participante",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("PollaVAR")).toBeInTheDocument();
    expect(screen.getByText("Mundial 2026 como primera plantilla")).toBeInTheDocument();
    expect(
      screen.getByText("Haz tus picks, revisa tu pago y compite por el ranking"),
    ).toBeInTheDocument();
    expect(screen.getByText("Puntos")).toBeInTheDocument();
    expect(screen.getByText("Posicion")).toBeInTheDocument();
    expect(screen.getByText("Pendientes")).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("renders every upcoming match", () => {
    render(<ParticipantsHome />);

    const matches = screen.getByRole("heading", { name: "Proximos partidos" })
      .closest("aside");

    expect(matches).not.toBeNull();
    expect(within(matches as HTMLElement).getByText("Grupo A")).toBeInTheDocument();
    expect(within(matches as HTMLElement).getByText("Mexico")).toBeInTheDocument();
    expect(within(matches as HTMLElement).getByText("South Africa")).toBeInTheDocument();
    expect(within(matches as HTMLElement).getByText("Grupo B")).toBeInTheDocument();
    expect(within(matches as HTMLElement).getByText("Canada")).toBeInTheDocument();
    expect(
      within(matches as HTMLElement).getByText("Bosnia and Herzegovina"),
    ).toBeInTheDocument();
    expect(within(matches as HTMLElement).getByText("Grupo C")).toBeInTheDocument();
    expect(within(matches as HTMLElement).getByText("Brazil")).toBeInTheDocument();
    expect(within(matches as HTMLElement).getByText("Morocco")).toBeInTheDocument();
    expect(within(matches as HTMLElement).getAllByText("vs")).toHaveLength(3);
  });

  it("renders every participant action with its status", () => {
    render(<ParticipantsHome />);

    expect(
      screen.getByRole("heading", { name: "Acciones del participante" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mis predicciones" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Partidos pendientes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mi pago" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ranking" })).toBeInTheDocument();
    expect(screen.getAllByText("Proximo")).toHaveLength(4);
    expect(
      screen.getAllByText(
        "Flujo separado del administrador para mantener una experiencia limpia y enfocada en jugar la polla.",
      ),
    ).toHaveLength(4);
  });
});
