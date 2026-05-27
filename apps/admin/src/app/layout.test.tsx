import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout, { metadata } from "./layout";

describe("Admin root layout", () => {
  it("defines the admin metadata", () => {
    expect(metadata).toEqual({
      title: "PollaVAR Admin",
      description: "Administracion de torneos, pollas, recaudo, premios y resultados.",
    });
  });

  it("renders the Spanish document shell with the provided content", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <span>Contenido admin</span>
      </RootLayout>,
    );

    expect(markup).toContain('<html lang="es" class="h-full antialiased">');
    expect(markup).toContain('<body class="min-h-full flex flex-col">');
    expect(markup).toContain("<span>Contenido admin</span>");
  });
});
