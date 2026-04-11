"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { bottombarLinks } from "@/constants";

const Bottombar = () => {
  const pathname = usePathname();

  const isRouteActive = (route: string) => {
    if (route === "/") return pathname === "/";
    return pathname === route || pathname?.startsWith(`${route}/`);
  };

  return (
    <section className="bottom-bar" aria-label="Mobile bottom navigation">
      {bottombarLinks.map((link) => {
        const isActive = isRouteActive(link.route);
        return (
          <Link
            key={`bottombar-${link.label}`}
            href={link.route}
            className={`bottom-bar-item ${isActive ? "bottom-bar-item-active" : ""}`}>
            <img
              src={link.imgURL}
              alt={link.label}
              width={20}
              height={20}
              className={`transition-all duration-300 ${isActive ? "invert-white scale-105" : "opacity-85"}`}
            />
            <span
              className={`tiny-medium mt-1.5 tracking-wide transition-colors duration-300 ${isActive ? "text-light-1" : "text-light-4"
                }`}>
              {link.label}
            </span>
            {isActive && <span className="bottom-bar-active-dot" aria-hidden="true" />}
          </Link>
        );
      })}
    </section>
  );
};

export default Bottombar;
