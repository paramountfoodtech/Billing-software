import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, ShieldCheck, Leaf, Factory } from "lucide-react";

export default function HomePage() {
  const cuts = [
    "Whole Chicken",
    "Hand Diced Chicken Breast",
    "Premium Chicken Breast Boneless",
    "Premium Chicken Thigh Boneless",
    "Chicken Fry Cuts",
    "Chicken Dum Cuts",
    "Chicken Curry Cut",
    "Chicken Legs",
    "Chicken Thighs",
    "Chicken Lollipops",
    "Chicken Wings",
    "Chicken Liver",
    "Chicken Gizzard",
    "Chicken Carcass",
    "Chicken Feet, Heart & Neck",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 text-slate-900">
      <nav className="sticky top-0 z-50 border-b border-white/70 bg-white/80 backdrop-blur-xl">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2">
            <Image
              src="/PFT logo.png"
              alt="Paramount Food Tech logo"
              width={36}
              height={36}
              className="h-9 w-9 rounded-md object-cover"
              priority
            />
            <span className="text-xl font-bold text-slate-900">Paramount Food Tech</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/auth/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative overflow-hidden border-b border-slate-200">
          <Image
            src="/brochure/1.png"
            alt="Paramount Food Tech processing facility"
            width={1800}
            height={950}
            className="h-[calc(100svh-69px)] min-h-[500px] w-full object-cover sm:h-[calc(100svh-73px)] sm:min-h-[560px]"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 via-slate-900/65 to-blue-900/35" />
          <div className="absolute -left-24 top-20 h-60 w-60 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute -right-24 bottom-12 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="absolute inset-0 container mx-auto px-4">
            <div className="flex h-full max-w-3xl flex-col justify-center gap-5 py-6 text-white sm:gap-7">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-200/60 bg-white/15 px-3 py-1.5 text-xs font-medium shadow-lg shadow-blue-900/20 sm:px-4 sm:py-2 sm:text-sm">
                Pioneering Excellence in Food Processing
              </div>
              <h1 className="text-3xl font-bold leading-tight sm:text-4xl md:text-6xl">
                Premium Poultry Processing with
                <span className="block bg-gradient-to-r from-blue-200 to-indigo-200 bg-clip-text text-transparent">
                  Paramount Food Tech
                </span>
              </h1>
              <p className="max-w-2xl text-base text-slate-100 sm:text-lg md:text-xl">
                Established in 2021 and backed by decades of leadership expertise, we deliver hygienic, high-quality, and reliable poultry solutions for modern food businesses.
              </p>
              <div className="flex flex-wrap gap-3 sm:gap-4">
                <Button size="lg" className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-lg shadow-blue-900/25 hover:from-blue-800 hover:to-indigo-800" asChild>
                  <Link href="/auth/login">
                    Get Started <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="border-white/60 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20" asChild>
                  <Link href="/auth/login">Sign In</Link>
                </Button>
              </div>
              <div className="grid gap-2 pt-2 text-xs text-slate-100 sm:gap-3 sm:pt-3 sm:text-sm sm:grid-cols-3">
                <div className="rounded-xl border border-white/30 bg-white/10 px-4 py-3 backdrop-blur-sm">100% Halal Commitment</div>
                <div className="rounded-xl border border-white/30 bg-white/10 px-4 py-3 backdrop-blur-sm">Scientific Quality Control</div>
                <div className="rounded-xl border border-white/30 bg-white/10 px-4 py-3 backdrop-blur-sm">Reliable Supply Chain</div>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto grid gap-4 px-4 py-10 sm:gap-6 sm:py-14 md:grid-cols-3">
          <div className="group rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <Factory className="h-7 w-7 text-blue-700" />
            <p className="mt-4 text-3xl font-bold text-slate-900">30+ Years</p>
            <p className="mt-1 text-slate-600">Combined investor and founder industry expertise</p>
          </div>
          <div className="group rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <ShieldCheck className="h-7 w-7 text-blue-700" />
            <p className="mt-4 text-3xl font-bold text-slate-900">100% Halal</p>
            <p className="mt-1 text-slate-600">Certified and science-backed processing standards</p>
          </div>
          <div className="group rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
            <Leaf className="h-7 w-7 text-blue-700" />
            <p className="mt-4 text-3xl font-bold text-slate-900">End-to-End</p>
            <p className="mt-1 text-slate-600">Procurement, processing, packaging, and delivery</p>
          </div>
        </section>

        <section className="container mx-auto grid gap-6 px-4 pb-6 sm:gap-8 sm:pb-8 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-7 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg">
            <h2 className="mb-3 text-2xl font-semibold text-slate-900">About Us</h2>
            <p className="text-slate-700">
              At Paramount Food Tech, we believe in turning innovation into tradition. Our leadership has stood at the forefront of food processing, delivering uncompromising quality and reliability to every customer segment.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-lg">
            <Image
              src="/brochure/2.png"
              alt="Fresh poultry quality process"
              width={1200}
              height={700}
              className="h-full min-h-[220px] w-full object-cover transition-transform duration-500 hover:scale-105 sm:min-h-[260px]"
            />
          </div>
        </section>

        <section className="container mx-auto grid gap-6 px-4 py-6 sm:gap-8 sm:py-8 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-lg">
            <Image
              src="/brochure/4.png"
              alt="Hygienic egg sorting and packing"
              width={1200}
              height={700}
              className="h-full min-h-[220px] w-full object-cover transition-transform duration-500 hover:scale-105 sm:min-h-[260px]"
            />
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-7 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg">
            <h2 className="mb-3 text-2xl font-semibold text-slate-900">What We Do</h2>
            <p className="text-slate-700">
              We specialize in procurement and processing of poultry meat for wholesale buyers, restaurants, hyper stores, online grocery platforms, and ready-to-cook consumers. Our quality systems focus on efficiency, hygiene, and sustainability.
            </p>
            <div className="mt-5 grid gap-2 text-sm text-slate-700">
              <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-700" />Wholesale and institutional supply</p>
              <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-700" />Restaurant and HORECA fulfillment</p>
              <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-700" />Online and ready-to-cook channels</p>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-6 sm:py-8">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-50 via-white to-indigo-50 p-7 shadow-sm transition-all duration-300 hover:shadow-lg">
            <h2 className="mb-4 text-2xl font-semibold text-slate-900">Our Mission and Vision</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <p className="text-slate-700">
                <span className="font-semibold text-slate-900">Mission:</span> To empower food manufacturers with innovative, reliable, and sustainable processing technologies that enhance productivity, product quality, and food safety.
              </p>
              <p className="text-slate-700">
                <span className="font-semibold text-slate-900">Vision:</span> To be a global leader in food processing, driving the future of food through innovation, integrity, and long-term partnerships.
              </p>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-6 sm:py-8">
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-7 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg">
            <h2 className="mb-4 text-2xl font-semibold text-slate-900">Why Choose Paramount Food Tech</h2>
            <div className="grid gap-3 text-slate-700 md:grid-cols-2">
              <p>A. Commitment to Promises</p>
              <p>B. End-to-End Integration</p>
              <p>C. Technology Inclusion and R&amp;D</p>
              <p>D. Client-Centric Approach</p>
              <p>E. Global Standards, Local Expertise</p>
            </div>
          </div>
        </section>

        <section className="container mx-auto items-stretch grid gap-6 px-4 py-6 sm:gap-8 sm:py-8 md:grid-cols-[1.1fr_1fr]">
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-7 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg">
            <h2 className="mb-4 text-2xl font-semibold text-slate-900">Our Range of Cuts</h2>
            <div className="grid gap-2 text-slate-700 sm:grid-cols-2">
              {cuts.map((cut) => (
                <p key={cut}>- {cut}</p>
              ))}
            </div>
          </div>
          <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-lg">
            <Image
              src="/brochure/5.png"
              alt="Premium poultry cuts display"
              width={1200}
              height={900}
              className="h-full w-full object-cover min-h-[240px] transition-transform duration-500 hover:scale-105 md:min-h-0"
            />
          </div>
        </section>

        <section className="container mx-auto grid gap-6 px-4 py-6 sm:gap-8 sm:py-8 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-lg">
            <Image
              src="/brochure/3.png"
              alt="Farm fresh eggs in hygienic trays"
              width={1200}
              height={900}
              className="h-full min-h-[230px] w-full object-cover transition-transform duration-500 hover:scale-105 sm:min-h-[300px]"
            />
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-7 shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-lg">
            <h2 className="mb-4 text-2xl font-semibold text-slate-900">Egg Supply and Nutrition Focus</h2>
            <div className="space-y-3 text-slate-700">
              <p>Farm-fresh and locally sourced eggs with strict quality checks, hygienic handling, and reliable distribution.</p>
              <p>We provide flexible supply models for households, HORECA, bakeries, catering businesses, schools, hospitals, and retail chains.</p>
              <p>Eco-friendly, tamper-proof packaging protects freshness and product safety through the supply chain.</p>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-8 sm:py-12">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-50 via-white to-indigo-50 p-8 text-center shadow-sm transition-all duration-300 hover:shadow-lg">
            <h2 className="text-3xl font-bold text-slate-900">Our Commitment</h2>
            <p className="mx-auto mt-4 max-w-3xl text-slate-700">
              We do not just deliver products, we build lasting relationships through quality, reliability, and service excellence.
            </p>
            <div className="mt-6 space-y-1 text-sm text-slate-700">
              <p>Ph/W: +91-9177 69 2345 | +91-98702 11940</p>
              <p>Email: paramountfoodtech@gmail.com</p>
              <p>Website: www.paramountfoodtech.com</p>
              <p>Address: Plot 294/E/B, Pedda Rushikonda, IT SEZ</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-slate-600">
            <p>© {new Date().getFullYear()} Paramount Food Tech. Pioneering excellence in food processing.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
