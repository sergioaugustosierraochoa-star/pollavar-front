import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout, { metadata } from "./layout";

describe("Participants root layout", () => {
  it("defines the participant metadata", () => {
    expect(metadata).toEqual({
      title: "PollaVAR Participantes",
      description: "Predicciones, pagos, ranking y premios para participantes.",
    });
  });

  it("renders the Spanish document shell with the provided content", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <span>Contenido participante</span>
      </RootLayout>,
    );

    expect(markup).toContain('<html lang="es" class="h-full antialiased">');
    expect(markup).toContain('<body class="min-h-full flex flex-col">');
    expect(markup).toContain("<span>Contenido participante</span>");
  });
});
