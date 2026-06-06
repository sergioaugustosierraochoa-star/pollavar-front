# pollavar-front

Frontend de PollaVAR en Next.js. Este repositorio contiene dos aplicaciones fisicamente separadas y un paquete compartido de cliente API.

```txt
apps/admin             Aplicacion para administradores de pollas
apps/participants      Aplicacion para participantes
packages/api-client    Cliente compartido para consumir la API/BFF
```

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Vitest y Testing Library
- npm workspaces

## Requisitos

- Node.js compatible con Next.js 16
- npm
- Backend local corriendo en `http://localhost:8080`

El backend vive en:

```txt
../pollavar-back
```

## Variables De Entorno

Copia el ejemplo:

```sh
cp .env.example .env.local
```

Variable principal:

```txt
POLLAVAR_BACKEND_URL=http://localhost:8080
```

Las aplicaciones no llaman directamente al backend desde el browser. Cada app usa un BFF en Next.js:

```txt
apps/admin/src/app/api/v1/[...path]/route.ts
apps/participants/src/app/api/v1/[...path]/route.ts
```

El BFF reenvia las llamadas a `POLLAVAR_BACKEND_URL`.

## Instalar Dependencias

```sh
npm install
```

## Ejecutar Localmente

1. Levantar backend:

```sh
cd ../pollavar-back
docker compose up -d postgres
go run ./cmd/api
```

2. En otra terminal, levantar admin:

```sh
npm run dev:admin
```

3. En otra terminal, levantar participantes:

```sh
npm run dev:participants
```

URLs locales:

```txt
Admin:          http://127.0.0.1:3000
Participantes: http://127.0.0.1:3001
Backend:       http://localhost:8080
```

## Scripts

Desarrollo:

```sh
npm run dev:admin
npm run dev:participants
```

Build:

```sh
npm run build:admin
npm run build:participants
npm run build
```

Lint:

```sh
npm run lint:admin
npm run lint:participants
npm run lint
```

Tests:

```sh
npm run test:admin
npm run test:participants
npm run test
npm run test:coverage
```

## Aplicacion Admin

La app admin permite:

- Crear y seleccionar pollas.
- Configurar tema, reglas de puntaje y modos de prediccion.
- Configurar predicciones globales.
- Gestionar brackets, slots, byes y resultados oficiales.
- Administrar premios, pagos y responsables de recaudo.
- Consultar ranking, desempates y bitacoras.
- Exportar reportes CSV.
- Registrar recalculos manuales.

## Aplicacion Participantes

La app de participantes permite:

- Registrarse, iniciar sesion y gestionar perfil.
- Unirse a pollas.
- Registrar predicciones por partido.
- Registrar predicciones de posiciones y globales.
- Consultar progreso de predicciones.
- Ver ranking, premios, participantes y predicciones cerradas visibles.

## Paquete Compartido

`packages/api-client` contiene tipos y funciones para consumir la API desde ambas apps. Centralizar el cliente evita duplicar endpoints y mantiene consistencia entre admin y participantes.

## Calidad Y Pruebas

Todo archivo de codigo nuevo o modificado en las apps frontend debe quedar con cobertura alta y pruebas enfocadas en comportamiento.

El comando principal de validacion es:

```sh
npm run build
```

Y para pruebas:

```sh
npm run test
npm run test:coverage
```

## Flujo Local Completo

Resumen para levantar todo desde cero:

```sh
# Terminal 1
cd pollavar-back
cp .env.example .env
docker compose up -d postgres
./scripts/run-worldcup-2026-seed.sh
go run ./cmd/api

# Terminal 2
cd pollavar-front
cp .env.example .env.local
npm install
npm run dev:admin

# Terminal 3
cd pollavar-front
npm run dev:participants
```
