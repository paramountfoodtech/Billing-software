import { PageLoadingFallback } from "@/components/page-loading-fallback";

export default function RootLoading() {
  return (
    <PageLoadingFallback
      scope="page"
      className="flex min-h-screen items-start justify-center p-8"
    />
  );
}
