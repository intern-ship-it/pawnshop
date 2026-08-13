/**
 * Landing - Public single-page marketing site, modelled on the
 * "Malaysia Licensed Pawn Brokers" reference design (red / yellow theme).
 *
 * Lives at "/" and requires no authentication. The staff application is
 * mounted under the same origin starting at "/dashboard".
 *
 * Sections: Top bar -> Nav -> Hero -> What We Accept (slider) -> Pawning
 * Process -> FAQ (accordion + pagination) -> Contact -> Disclaimer -> Footer.
 *
 * Photography lives in `public/landing/`; see the README there. A missing
 * file falls back to a branded placeholder tile rather than a broken image.
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  Facebook,
  FileSignature,
  Gem,
  Instagram,
  Layers,
  Mail,
  Menu,
  MessageCircle,
  Phone,
  RefreshCw,
  UserCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

const RED = "#E01F26";
const YELLOW = "#FFCC00";

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  { label: "FAQs", id: "faq" },
  { label: "Blog", id: "blog" },
  { label: "About Us", id: "about" },
  { label: "Career", id: "career" },
  { label: "Contact", id: "contact" },
];

// Photographs live in `public/landing/`. If a file is missing the card falls
// back to a branded placeholder tile rather than a broken image.
const ACCEPTS = [
  {
    icon: Gem,
    title: "Gold Jewellery",
    detail: "24K, 23K, 22K, 18K, 9K, 999, 916, 835, 750, 585, 375, Suasa etc.",
    note: null,
    image: "/landing/gold-jewellery.jpg",
  },
  {
    icon: Layers,
    title: "Gold Bars",
    detail: null,
    note: null,
    image: "/landing/gold-bars.jpg",
  },
  {
    icon: Coins,
    title: "Gold Coins",
    detail: null,
    note: null,
    image: "/landing/gold-coins.jpg",
  },
];

const PROCESS = [
  {
    icon: "RM",
    body: "Valuables are evaluated based on their weight, condition, and current market value.  ",
  },
  {
    icon: UserCheck,
    body: "Customers are required to present a valid National ID or Passport for verification. ",
  },
  {
    icon: FileSignature,
    body: "Once approved, customers will receive a pawn ticket together with the agreed loan amount.",
  },
  {
    icon: RefreshCw,
    body: "Pawn tickets can be renewed or the pledged item can be redeemed within 6 months.",
  },
];

const FAQS = [
  {
    q: "How does pawning work?",
    a: "Your valuables are assessed by a trained valuer and a pawn amount will be given based on current market rates. Present your ID once the pawn amount is agreed upon (pawners must be at least 18 years of age or older). Thereafter, our data operator will record your details and a pawn ticket will be issued. Pawners are required to check if details on pawn ticket are correct.",
  },
  {
    q: "Who can pawn?",
    a: "Anyone aged 18 years or older who owns the item outright. You will need to present your ID, passport, driver's license, work permit or any card issued by an authorised party at the counter.",
  },
  {
    q: "What can I pawn?",
    a: "Gold in all common purities (24K, 23K, 22K, 18K, 9K, 999, 916, 835, 750, 585, 375, Suasa), diamonds, and branded watches at every branch. Designer bags, fine wine and premium spirits are accepted at Damansara Uptown and Jalan Ipoh only.",
  },
  {
    q: "How much is my item worth?",
    a: "Valuation is based on weight, condition and the current market rate for the item. Bring it in for a free appraisal — there is no obligation to proceed once we have quoted you.",
  },
  {
    q: "What is the interest rate charged?",
    a: "The maximum interest charged is 1.5% per month, which makes the total interest charged for 6 months 9%. If you renew for a further 6 months, the annual percentage charged would be 18% in total. Different charges apply for items renewed or redeemed after auction.",
  },
  {
    q: "What is required to pawn?",
    a: "The item itself and a valid form of identification — ID, passport, driver's license, work permit, or any card issued by an authorised party. No credit check is performed.",
  },
  {
    q: "Can I renew my pawn ticket?",
    a: "Yes. At the end of the 6 month period you may renew your pawn ticket for a further 6 months at the standard interest rate not exceeding 1.5% per month.",
  },
  {
    q: "Can I redeem my valuables?",
    a: "Yes, at any time within the 6 month period. Assuming a pawn amount of RM1,000 redeemed at the end of 6 months, the interest payable is RM90 (RM1,000 × 1.5% × 6 months), so the total amount payable is RM1,090.",
  },
  {
    q: "How long can I pawn?",
    a: "There is no minimum pawn period and the maximum is 6 months. You may redeem your valuables within this period or renew your pawn ticket for a further 6 months.",
  },
  {
    q: "What if I lose my pawn ticket?",
    a: "Report the loss to the branch that issued the ticket as soon as possible, bringing the same identification you used to pawn. Our staff will guide you through the replacement procedure before your item can be released.",
  },
];

// Client-supplied copy — published verbatim. Do not paraphrase or reinstate
// figures without sign-off; the rates and worked example were removed
// deliberately.
const DISCLAIMER = [
  "There is no minimum pawn period and the maximum is 6 months. A customer may choose to redeem their valuables within this period or renew their pawn ticket for a further 6 months based on the standard interest rate not exceeding 1.5% per month. (Different charges apply for items renewed/redeemed after auction).",
  "The maximum interest charged is 1.5% per month, which makes the total interest charged for 6 months. (Different charges apply for items renewed/redeemed after auction). In this case, if the customer comes back to renew their ticket for a further 6 months, the annual percentage charged (Different charges apply for items renewed/redeemed after auction).",
  "A fee of RM0.50 is charged for each pawn ticket issued. Additional charges or different terms may apply for items renewed or redeemed after auction.",
];

const CONTACT = {
  company: "Dsara Asset Venture Sdn Bhd",
  phone: "+60 12 650 5430",
  // tel:/wa.me links need the number without spaces or the leading "+".
  phoneHref: "tel:+60126505430",
  whatsappHref: "https://wa.me/60126505430",
};

// `day` matches Date.getDay() so the current day can be highlighted.
const OPENING_HOURS = [
  { day: 1, label: "Monday", hours: "9 am till 6 pm" },
  { day: 2, label: "Tuesday", hours: "9 am till 6 pm" },
  { day: 3, label: "Wednesday", hours: "9 am till 6 pm" },
  { day: 4, label: "Thursday", hours: "9 am till 6 pm" },
  { day: 5, label: "Friday", hours: "9 am till 6 pm" },
  { day: 6, label: "Saturday", hours: "9 am till 6 pm" },
  { day: 0, label: "Sunday", hours: "9 am till 6 pm" },
];

/* ------------------------------------------------------------------ */
/* Animation helpers                                                   */
/* ------------------------------------------------------------------ */

const EASE = [0.22, 1, 0.36, 1];

/** Fade + rise a block into view the first time it is scrolled to. */
function Reveal({ children, delay = 0, y = 26, className }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

const revealParent = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const revealChild = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

/** The 當 roundel used as the brand mark. */
function Logo({ size = 40 }) {
  return (
    <img
      src="/landing/logo.png"
      alt="Dsara Asset Ventures"
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

function SectionTitle({ children, sub }) {
  return (
    <Reveal className="text-center">
      <h2
        className="text-2xl font-bold tracking-tight sm:text-3xl"
        style={{ color: RED }}
      >
        {children}
      </h2>
      {sub && (
        <p className="mt-3 text-base font-semibold text-zinc-700">{sub}</p>
      )}
    </Reveal>
  );
}

/**
 * Placeholder artwork for a card until a real photograph is supplied.
 * Renders the image when `src` is set, otherwise a branded tile.
 */
function CardImage({ src, alt, icon: Icon, className }) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "grid h-full w-full place-items-center bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-200",
        className,
      )}
    >
      {Icon ? (
        <Icon className="h-10 w-10" style={{ color: RED }} strokeWidth={1.5} />
      ) : (
        <Logo size={44} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function TopBar() {
  return (
    <div className="text-white" style={{ background: RED }}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-2 lg:px-8">
        <p className="text-[11px] font-bold sm:text-xs">
          Licensed Pawn Brokers in Kuala Lumpur and Selangor, Malaysia.
        </p>
        <div className="flex shrink-0 items-center gap-3">
          {[Facebook, Instagram, Mail].map((Icon, i) => (
            <a
              key={i}
              href="#contact"
              className="transition-opacity hover:opacity-70"
              aria-label="Social link"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const goTo = useCallback((id) => {
    setMobileOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 lg:px-8">
        <button onClick={() => goTo("home")} aria-label="Home">
          <Logo size={40} />
        </button>

        {/* Desktop menu */}
        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map(({ label, id }) => (
            <li key={id}>
              <button
                onClick={() => goTo(id)}
                className="rounded px-3 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:text-[#E01F26]"
              >
                {label}
              </button>
            </li>
          ))}

        </ul>

        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-zinc-300 text-zinc-700 lg:hidden"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden border-t border-zinc-200 bg-white lg:hidden"
          >
            <ul className="px-5 py-3">
              {NAV_LINKS.map(({ label, id }) => (
                <li key={id}>
                  <button
                    onClick={() => goTo(id)}
                    className="w-full rounded px-2 py-2.5 text-left text-sm font-semibold text-zinc-800 hover:text-[#E01F26]"
                  >
                    {label}
                  </button>
                </li>
              ))}
              <li className="pt-2">
                <Link
                  to="/dashboard"
                  className="block rounded px-2 py-2.5 text-sm font-bold"
                  style={{ color: RED }}
                >
                  Staff Portal →
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section
      id="home"
      className="px-5 py-16 text-center lg:px-8 lg:py-20"
      style={{ background: YELLOW }}
    >
      <motion.div
        variants={revealParent}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-3xl"
      >
        <motion.div variants={revealChild} className="flex justify-center">
          <motion.span
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="inline-block"
          >
            <Logo size={92} />
          </motion.span>
        </motion.div>

        <motion.p
          variants={revealChild}
          className="mt-10 text-2xl font-bold sm:text-3xl"
          style={{ color: "#4A6C8A" }}
        >
Trusted & Secure Pawnbroking Services </motion.p>
 Fair appraisals, competitive pawn values and a simple redemption process.        

        <motion.h1
          variants={revealChild}
          className="mt-2 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
          style={{ color: RED }}
        >
        </motion.h1>

        <motion.p
          variants={revealChild}
          className="mt-3 text-2xl font-bold sm:text-3xl"
          style={{ color: "#4A6C8A" }}
        >
        </motion.p>

        <motion.p
          variants={revealChild}
          className="mt-7 text-lg font-bold italic text-zinc-900 sm:text-xl"
        >
        </motion.p>
      </motion.div>
    </section>
  );
}

/** "What our Pawn Shop accepts?" — auto-advancing slider. */
function Accepts() {
  const [rawIndex, setIndex] = useState(0);
  const [perView, setPerView] = useState(1);
  const [paused, setPaused] = useState(false);

  // Responsive slides-per-view without a media-query library.
  useEffect(() => {
    const sync = () => {
      const w = window.innerWidth;
      setPerView(w >= 1024 ? 3 : w >= 640 ? 2 : 1);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const maxIndex = Math.max(0, ACCEPTS.length - perView);
  // Clamp during render rather than in an effect: when the viewport grows,
  // fewer slides remain and a stale index would scroll past the last card.
  const index = Math.min(rawIndex, maxIndex);

  const paginate = useCallback(
    (step) => {
      setIndex((i) => {
        const next = Math.min(i, maxIndex) + step;
        if (next < 0) return maxIndex;
        if (next > maxIndex) return 0;
        return next;
      });
    },
    [maxIndex],
  );

  useEffect(() => {
    if (paused || maxIndex === 0) return;
    const timer = setInterval(() => paginate(1), 4000);
    return () => clearInterval(timer);
  }, [paused, paginate, maxIndex]);

  return (
    <section id="accepts" className="bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <SectionTitle>What our Pawn Shop accepts?</SectionTitle>

        <div
          className="relative mt-12"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="overflow-hidden">
            <motion.div
              className="flex"
              animate={{ x: `-${index * (100 / perView)}%` }}
              transition={{ duration: 0.55, ease: EASE }}
            >
              {ACCEPTS.map((item) => (
                <div
                  key={item.title}
                  className="shrink-0 px-3"
                  style={{ width: `${100 / perView}%` }}
                >
                  <motion.article
                    whileHover={{ y: -6 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    className="flex h-full flex-col text-center"
                  >
                    <div className="mb-4 aspect-[4/3] overflow-hidden rounded-lg">
                      <CardImage
                        src={item.image}
                        alt={item.title}
                        icon={item.icon}
                      />
                    </div>

                    <p className="text-sm font-semibold text-zinc-800">
                      {item.title}
                      {item.isNew && (
                        <span
                          className="ml-1 font-bold"
                          style={{ color: RED }}
                        >
                          (NEW)
                        </span>
                      )}
                    </p>

                    {item.detail && (
                      <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                        ({item.detail})
                      </p>
                    )}

                    {item.note && (
                      <p className="mt-2 text-[11px] font-medium uppercase italic tracking-wide text-zinc-500">
                        {item.note}
                      </p>
                    )}
                  </motion.article>
                </div>
              ))}
            </motion.div>
          </div>

          {maxIndex > 0 && (
            <>
              <button
                onClick={() => paginate(-1)}
                aria-label="Previous"
                className="absolute -left-2 top-[28%] grid h-10 w-10 place-items-center rounded-full bg-white text-zinc-700 shadow-lg ring-1 ring-zinc-200 transition-colors hover:text-[#E01F26] lg:-left-5"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => paginate(1)}
                aria-label="Next"
                className="absolute -right-2 top-[28%] grid h-10 w-10 place-items-center rounded-full bg-white text-zinc-700 shadow-lg ring-1 ring-zinc-200 transition-colors hover:text-[#E01F26] lg:-right-5"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              <div className="mt-8 flex justify-center gap-2">
                {Array.from({ length: maxIndex + 1 }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    aria-label={`Slide ${i + 1}`}
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      i === index ? "w-7" : "w-2 bg-zinc-300 hover:bg-zinc-400",
                    )}
                    style={i === index ? { background: RED } : undefined}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/** Reusable pagination control. Renders nothing for a single page. */
function Pagination({ page, pageCount, onChange, className }) {
  if (pageCount <= 1) return null;

  const btn =
    "grid h-10 w-10 place-items-center rounded-lg border border-zinc-300 bg-white text-zinc-600 transition-colors hover:border-[#E01F26] hover:text-[#E01F26] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-zinc-300 disabled:hover:text-zinc-600";

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <button
        onClick={() => onChange(Math.max(0, page - 1))}
        disabled={page === 0}
        aria-label="Previous page"
        className={btn}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {Array.from({ length: pageCount }, (_, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          aria-current={page === i ? "page" : undefined}
          className={cn(
            "h-10 w-10 rounded-lg text-sm font-bold transition-all",
            page === i
              ? "text-white shadow-md"
              : "border border-zinc-300 bg-white text-zinc-600 hover:border-[#E01F26] hover:text-[#E01F26]",
          )}
          style={page === i ? { background: RED } : undefined}
        >
          {i + 1}
        </button>
      ))}

      <button
        onClick={() => onChange(Math.min(pageCount - 1, page + 1))}
        disabled={page === pageCount - 1}
        aria-label="Next page"
        className={btn}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Process() {
  return (
    <section id="about" className="bg-[#EFEDE8] py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <SectionTitle>How is the Pawning Process?</SectionTitle>

        <motion.div
          variants={revealParent}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4"
        >
          {PROCESS.map(({ icon: Icon, body }, i) => (
            <motion.div
              key={i}
              variants={revealChild}
              className="text-center"
            >
              <motion.span
                whileHover={{ scale: 1.12, rotate: 6 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className="mx-auto grid h-16 w-16 place-items-center rounded-full"
                style={{ background: YELLOW }}
              >
                {typeof Icon === "string" ? (
                  <span
                    className="text-lg font-extrabold"
                    style={{ color: RED }}
                  >
                    {Icon}
                  </span>
                ) : (
                  <Icon className="h-7 w-7" style={{ color: RED }} />
                )}
              </motion.span>
              <p className="mt-5 text-sm leading-relaxed text-zinc-700">
                {body}
              </p>
            </motion.div>
          ))}
        </motion.div>

        <Reveal delay={0.2} className="mt-12 text-center">
          <button
            onClick={() =>
              document
                .getElementById("faq")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="rounded px-6 py-3 text-sm font-bold text-zinc-900 shadow-md transition-transform hover:scale-105"
            style={{ background: YELLOW }}
          >
            Learn More about Pawning
          </button>
        </Reveal>
      </div>
    </section>
  );
}

const FAQS_PER_PAGE = 5;

function Faq() {
  const [page, setPage] = useState(0);
  // Index is relative to the visible page, so it resets on page change.
  const [open, setOpen] = useState(0);

  const pageCount = Math.ceil(FAQS.length / FAQS_PER_PAGE);
  const start = page * FAQS_PER_PAGE;
  const visible = FAQS.slice(start, start + FAQS_PER_PAGE);

  const changePage = (next) => {
    setPage(next);
    setOpen(0);
  };

  return (
    <section id="faq" className="bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-3xl px-5 lg:px-8">
        <SectionTitle>Frequently asked questions</SectionTitle>

        <Reveal delay={0.05} className="mt-3 text-center">
          <p className="text-sm text-zinc-600">
            Don&apos;t see an answer to your question below?{" "}
            <a
              href={CONTACT.whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline-offset-2 hover:underline"
              style={{ color: RED }}
            >
              Message us on WhatsApp.
            </a>
          </p>
        </Reveal>

        <motion.div
          key={page}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="mt-10 space-y-3"
        >
          {visible.map(({ q, a }, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={q} delay={i * 0.05}>
                <div
                  className={cn(
                    "overflow-hidden rounded-md border transition-colors",
                    isOpen ? "border-[#FFCC00]" : "border-zinc-200",
                  )}
                >
                  <button
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-5 px-5 py-4 text-left"
                  >
                    <span
                      className="text-sm font-semibold"
                      style={{ color: isOpen ? RED : "#3f3f46" }}
                    >
                      {q}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.28, ease: EASE }}
                      className="shrink-0"
                      style={{ color: isOpen ? RED : "#a1a1aa" }}
                    >
                      <ChevronDown className="h-5 w-5" />
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.32, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-sm leading-relaxed text-zinc-600">
                          {a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </motion.div>

        <Pagination
          page={page}
          pageCount={pageCount}
          onChange={changePage}
          className="mt-8"
        />

        <p className="mt-3 text-center text-xs text-zinc-500">
          Showing {start + 1}–{start + visible.length} of {FAQS.length}{" "}
          questions
        </p>
      </div>
    </section>
  );
}

function ContactSection() {
  // Highlight the row for today so visitors can see at a glance we are open.
  const today = new Date().getDay();

  return (
    <section id="contact" className="bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-5xl px-5 lg:px-8">
        <SectionTitle sub="Open 7 days a week — walk in for a free appraisal">
          Contact Us
        </SectionTitle>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {/* Company + phone */}
          <Reveal>
            <div className="flex h-full flex-col rounded-lg border border-zinc-200 bg-[#F7F5F1] p-7">
              <Logo size={48} />

              <p className="mt-5 text-lg font-bold" style={{ color: RED }}>
                {CONTACT.company}
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Licensed Pawn Brokers
              </p>

              <a
                href={CONTACT.phoneHref}
                className="mt-6 flex items-center gap-3 text-2xl font-extrabold tracking-tight transition-opacity hover:opacity-75"
                style={{ color: RED }}
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
                  style={{ background: YELLOW }}
                >
                  <Phone className="h-5 w-5" style={{ color: RED }} />
                </span>
                {CONTACT.phone}
              </a>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={CONTACT.phoneHref}
                  className="inline-flex items-center gap-2 rounded px-5 py-2.5 text-sm font-bold text-zinc-900 shadow-md transition-transform hover:scale-105"
                  style={{ background: YELLOW }}
                >
                  <Phone className="h-4 w-4" />
                  Call Us
                </a>
                <a
                  href={CONTACT.whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded border border-zinc-300 bg-white px-5 py-2.5 text-sm font-bold text-zinc-800 transition-colors hover:border-[#E01F26] hover:text-[#E01F26]"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              </div>
            </div>
          </Reveal>

          {/* Opening hours */}
          <Reveal delay={0.12}>
            <div className="h-full rounded-lg border border-zinc-200 bg-white p-7 shadow-sm">
              <p
                className="text-sm font-bold uppercase tracking-wide"
                style={{ color: RED }}
              >
                Opening Time
              </p>

              <ul className="mt-5 space-y-1">
                {OPENING_HOURS.map(({ day, label, hours }, i) => {
                  const isToday = day === today;
                  return (
                    <motion.li
                      key={label}
                      initial={{ opacity: 0, x: -12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{ delay: i * 0.05, duration: 0.4, ease: EASE }}
                      className={cn(
                        "flex items-center justify-between rounded px-3 py-2.5 text-sm",
                        isToday ? "font-bold" : "text-zinc-700",
                      )}
                      style={isToday ? { background: YELLOW } : undefined}
                    >
                      <span className="flex items-center gap-2">
                        {label}
                        {isToday && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                            style={{ background: RED }}
                          >
                            Today
                          </span>
                        )}
                      </span>
                      <span className={isToday ? "" : "text-zinc-600"}>
                        {hours}
                      </span>
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Disclaimer() {
  return (
    <section className="py-12" style={{ background: YELLOW }}>
      <div className="mx-auto max-w-4xl px-5 text-center lg:px-8">
        <Reveal>
          <h2 className="text-sm font-bold tracking-wide" style={{ color: RED }}>
            DISCLAIMER
          </h2>
        </Reveal>
        <div className="mt-5 space-y-4">
          {DISCLAIMER.map((para, i) => (
            <Reveal key={i} delay={i * 0.06}>
              <p className="text-xs leading-relaxed text-zinc-800">{para}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div>
          <Logo size={44} />
          <p
            className="mt-4 text-sm font-bold leading-snug"
            style={{ color: RED }}
          >
            {CONTACT.company.toUpperCase()}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-600">
            Licensed pawnbroker in Kuala Lumpur and Selangor, Malaysia.
          </p>

          <a
            href={CONTACT.phoneHref}
            className="mt-4 flex items-center gap-1.5 text-xs font-bold transition-opacity hover:opacity-75"
            style={{ color: RED }}
          >
            <Phone className="h-3.5 w-3.5" />
            {CONTACT.phone}
          </a>
          <p className="mt-2 text-xs text-zinc-600">
            Open daily &middot; 9 am till 6 pm
          </p>
        </div>

        <div id="blog">
          <p className="text-sm font-bold" style={{ color: RED }}>
            GOLD PRICE
          </p>
          <div className="mt-4 space-y-2">
            {[
              { k: "999", v: "486.20" },
              { k: "916", v: "445.40" },
              { k: "835", v: "405.95" },
              { k: "750", v: "364.65" },
            ].map((row) => (
              <div
                key={row.k}
                className="flex items-center justify-between border-b border-zinc-100 pb-1.5 text-xs"
              >
                <span className="font-semibold text-zinc-700">{row.k}</span>
                <span className="font-bold" style={{ color: RED }}>
                  RM {row.v}/g
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] italic text-zinc-400">
            Indicative rates — confirm in branch.
          </p>
        </div>

        <div>
          <p className="text-sm font-bold" style={{ color: RED }}>
            OPENING TIME
          </p>
          <ul className="mt-4 space-y-1.5">
            {OPENING_HOURS.map(({ label, hours }) => (
              <li
                key={label}
                className="flex items-center justify-between text-xs text-zinc-600"
              >
                <span>{label}</span>
                <span className="font-semibold text-zinc-800">{hours}</span>
              </li>
            ))}
          </ul>
        </div>

        <div id="career">
          <p className="text-sm font-bold" style={{ color: RED }}>
            ABOUT
          </p>
          <ul className="mt-4 space-y-2">
            {[
              { label: "FAQs", href: "#faq" },
              { label: "About Us", href: "#about" },
              { label: "Career", href: "#career" },
              { label: "Contact", href: "#contact" },
            ].map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  className="text-xs text-zinc-600 transition-colors hover:text-[#E01F26]"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <Link
                to="/dashboard"
                className="text-xs font-semibold text-zinc-600 transition-colors hover:text-[#E01F26]"
              >
                Staff Portal →
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="text-white" style={{ background: RED }}>
        <p className="mx-auto max-w-7xl px-5 py-3.5 text-center text-[11px] lg:px-8">
          © {new Date().getFullYear()} {CONTACT.company}. All Rights Reserved.
          Licensed Pawnbroker in Kuala Lumpur and Selangor.
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Landing() {
  // The page owns the full viewport and scrolls its own sections.
  return (
    <div className="min-h-screen scroll-smooth bg-white">
      <TopBar />
      <Navbar />
      <main>
        <Hero />
        <Accepts />
        <Process />
        <Faq />
        <ContactSection />
        <Disclaimer />
      </main>
      <Footer />
    </div>
  );
}
