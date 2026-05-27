# pollavar-front

Frontend de PollaVAR en Next.js. Este proyecto contiene dos aplicaciones:

```txt
apps/admin          App para administradores de pollas
apps/participants   App para participantes
```

## Desarrollo Local

Crear `.env.local` desde `.env.example` si necesitas cambiar la URL del API.

Instalar dependencias:

```sh
npm install
```

Levantar frontend:

```sh
npm run dev:admin
npm run dev:participants
```

URLs locales:

```txt
Admin:         http://127.0.0.1:3000
Participantes: http://127.0.0.1:3001
```

## Scripts

```sh
npm run dev:admin
npm run dev:participants
npm run build:admin
npm run build:participants
npm run lint:admin
npm run lint:participants
npm run test:admin
npm run test:participants
npm run test
npm run test:coverage
npm run build
npm run lint
```

## Calidad Y Pruebas

Todo archivo de codigo nuevo o modificado en las apps frontend debe quedar con
100% de cobertura en pruebas unitarias. Esto aplica a componentes, hooks,
utilidades, servicios, pages/layouts con logica propia y adaptadores de API.

La cobertura se valida con `npm run test:coverage`, que incluye los archivos
`apps/*/src/**/*.{ts,tsx}` y exige 100% en statements, branches, functions y
lines.
