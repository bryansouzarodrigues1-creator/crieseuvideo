import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const StudioApp = lazy(() => import("@/studio/App"));

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "StickStory Studio — Produção de animações por IA" },
      {
        name: "description",
        content:
          "Produza cenas originais com IA em 2D, 3D, anime e motion graphics, com histórico privado e download MP4.",
      },
      { property: "og:title", content: "StickStory Studio — Produção de animações por IA" },
      {
        property: "og:description",
        content: "Crie cenas originais em 2D, 3D, anime e motion graphics com direção livre por IA.",
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
