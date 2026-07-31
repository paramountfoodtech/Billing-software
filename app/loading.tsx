// This file is a client component that is rendered during the loading state of the root layout.
import { PageLoadingFallback } from "@/components/page-loading-fallback";

export default function RootLoading() {
  return (
    <PageLoadingFallback
      scope="page"
      className="flex min-h-screen items-start justify-center p-8"
    />
  );
}
