import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const StudioApp = lazy(() => import("@/studio/App"));

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "StickStory Studio — Criador de animações stickman" },
      {
        name: "description",
        content:
          "Crie animações cinematográficas estilo stickman com roteiro, narração sincronizada e exportação de vídeo.",
      },
      { property: "og:title", content: "StickStory Studio — Criador de animações stickman" },
      {
        property: "og:description",
        content: "Crie animações cinematográficas estilo stickman com roteiro, narração e exportação de vídeo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Loading() {
  return (
    <div className="studio-loading">
      <span>Carregando estúdio…</span>
    </div>
  );
}

function Index() {
  return (
    <ClientOnly fallback={<Loading />}>
      <Suspense fallback={<Loading />}>
        <StudioApp />
      </Suspense>
    </ClientOnly>
  );
}
