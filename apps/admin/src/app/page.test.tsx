import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminHome from "./page";

describe("Admin home", () => {
  it("renders the admin dashboard header and summary metrics", () => {
    render(<AdminHome />);

    expect(
      screen.getByRole("heading", {
        name: "Configuracion de pollas y torneos",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("PollaVAR Admin")).toBeInTheDocument();
    expect(screen.getByText("Panel de administracion")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Controla reglas, recaudo, premios y resultados desde un solo lugar",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Pollas activas")).toBeInTheDocument();
    expect(screen.getByText("Recaudo confirmado")).toBeInTheDocument();
    expect(screen.getByText("Resultados cargados")).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(screen.getByText("$0")).toBeInTheDocument();
  });

  it("renders every setup step in order", () => {
    render(<AdminHome />);

    const setupFlow = screen.getByRole("heading", { name: "Flujo del admin" })
      .closest("aside");

    expect(setupFlow).not.toBeNull();
    expect(within(setupFlow as HTMLElement).getByText("1")).toBeInTheDocument();
    expect(within(setupFlow as HTMLElement).getByText("Crear torneo o elegir plantilla")).toBeInTheDocument();
    expect(within(setupFlow as HTMLElement).getByText("2")).toBeInTheDocument();
    expect(within(setupFlow as HTMLElement).getByText("Configurar polla privada")).toBeInTheDocument();
    expect(within(setupFlow as HTMLElement).getByText("3")).toBeInTheDocument();
    expect(within(setupFlow as HTMLElement).getByText("Definir reglas de puntaje")).toBeInTheDocument();
    expect(within(setupFlow as HTMLElement).getByText("4")).toBeInTheDocument();
    expect(within(setupFlow as HTMLElement).getByText("Configurar recaudo y premios")).toBeInTheDocument();
    expect(within(setupFlow as HTMLElement).getByText("5")).toBeInTheDocument();
    expect(within(setupFlow as HTMLElement).getByText("Invitar participantes")).toBeInTheDocument();
  });

  it("renders every admin module with its status", () => {
    render(<AdminHome />);

    expect(screen.getByRole("heading", { name: "Modulos admin" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Torneos" })).toBeInTheDocument();
    expect(screen.getByText("Modelo base")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pollas privadas" })).toBeInTheDocument();
    expect(screen.getAllByText("Pendiente API")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Puntajes" })).toBeInTheDocument();
    expect(screen.getAllByText("Por configurar")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Recaudo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Premios" })).toBeInTheDocument();
    expect(screen.getAllByText("Diseno listo")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Resultados" })).toBeInTheDocument();
    expect(screen.getAllByText("Por construir")).toHaveLength(1);
    expect(
      screen.getAllByText(
        "Preparado para conectarse al API de PollaVAR conforme avancemos por las historias del backlog.",
      ),
    ).toHaveLength(6);
  });
});
