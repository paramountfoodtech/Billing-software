import Image from "next/image"

export function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6">
        <div className="relative h-20 w-20 flex items-center justify-center">
          <Image
            src="/PFT logo.png"
            alt="Loading"
            width={48}
            height={48}
            className="h-12 w-12 object-contain drop-shadow-lg"
            priority
          />
          <div className="absolute inset-[4px] rounded-full border-2 border-transparent border-t-blue-600 border-r-blue-500 animate-spin" />
        </div>
        <p className="text-white text-lg font-semibold">Loading...</p>
      </div>
    </div>
  )
}
