"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { bottombarLinks } from "@/constants";

const Bottombar = () => {
  const pathname = usePathname();

  return (
    <section className="bottom-bar">
      {bottombarLinks.map((link) => {
        const isActive = pathname === link.route;
        return (
          <Link
            key={`bottombar-${link.label}`}
            href={link.route}
            className={`${
              isActive && "bg-primary-500 shadow-[0_4px_20px_rgba(139,92,246,0.4)]"
            } flex-center rounded-full p-2.5 transition-all duration-300 hover:scale-110 active:scale-95`}>
            <img
              src={link.imgURL}
              alt={link.label}
              width={22}
              height={22}
              className={`${isActive && "invert-white"}`}
            />
          </Link>
        );
      })}
    </section>
  );
};

export default Bottombar;
