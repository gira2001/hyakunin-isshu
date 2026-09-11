"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "ホーム" },
  { href: "/hyakunin", label: "百人一首" },
  { href: "/battle", label: "対戦" },
  { href: "/karuta", label: "四択" },
  { href: "/list", label: "一覧" },
  { href: "/progress", label: "進捗" },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-purple-900 text-white shadow-md">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-base sm:text-xl font-bold tracking-widest text-amber-300 shrink-0">
          百人一首
        </Link>

        <ul className="flex gap-0.5 sm:gap-1 overflow-x-auto">
          {links.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <li key={href} className="shrink-0">
                <Link
                  href={href}
                  className={`px-2 py-1 sm:px-4 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? "bg-purple-700 text-amber-300"
                      : "text-purple-200 hover:bg-purple-700 hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
