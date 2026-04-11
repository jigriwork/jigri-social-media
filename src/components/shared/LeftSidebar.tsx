"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

import { INavLink } from "@/types";
import { sidebarLinks } from "@/constants";
import { INITIAL_USER } from "@/constants";

import { Button } from "@/components/ui/button";
import { useSignOutAccount, useCheckAdminAccess } from "@/lib/react-query/queriesAndMutations";
import { useUserContext } from "@/context/SupabaseAuthContext";
import Loader from "./Loader";

const LeftSidebar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, setIsAuthenticated, isLoading } = useUserContext();
  const { data: hasAdminAccess } = useCheckAdminAccess();

  const { mutate: signOut } = useSignOutAccount();

  const handleSignOut = async (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    e.preventDefault();
    signOut();
    setIsAuthenticated(false);
    setUser(INITIAL_USER);
    router.push("/sign-in");
  };

  // Filter sidebar links based on admin access
  const filteredSidebarLinks = sidebarLinks.filter((link) => {
    // Show admin link only if user has admin access
    if (link.route === "/admin") {
      return hasAdminAccess === true;
    }
    // Show all other links
    return true;
  });

  return (
    <nav className="leftsidebar">
      <div className="flex flex-col gap-8 min-h-0">
        <Link href="/" className="flex gap-3 items-center -mt-1 pl-2">
          <img
            src="/assets/images/logo.svg"
            alt="logo"
            width={120}
            height={28}
          />
        </Link>

        {isLoading || !user?.email ? (
          <div className="h-14">
            <Loader />
          </div>
        ) : (
          <>

              <Link href={`/profile/${user.id}`} className="flex gap-3 items-center min-w-0 pr-2 group/profile">
                <img
                  src={user.image_url || "/assets/icons/profile-placeholder.svg"}
                  alt="profile"
                  className="h-12 w-12 rounded-full border-2 border-transparent group-hover/profile:border-primary-500 transition-all"
                />
                <div className="flex flex-col min-w-0">
                  <p className="body-bold text-light-1 group-hover/profile:text-primary-500 transition-colors truncate max-w-[200px]">{user.name}</p>
                  <p className="small-regular text-light-3 truncate max-w-[200px]">@{user.username}</p>
                </div>
              </Link>


          </>
        )}

        <ul className="flex flex-col gap-4 overflow-y-auto pr-1 custom-scrollbar">
          {filteredSidebarLinks.map((link: INavLink) => {
            const isActive = pathname === link.route;

            return (
              <li
                key={link.label}
                className={`leftsidebar-link group ${
                  isActive ? "bg-primary-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] border border-primary-500/50" : ""
                }`}>
                <Link
                  href={link.route}
                  className="flex gap-4 items-center p-4">
                  <img
                    src={link.imgURL}
                    alt={link.label}
                    className={`group-hover:invert-white ${isActive && "invert-white"
                      }`}
                  />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <Button
        className="shad-button_ghost mt-6"
        onClick={(e) => handleSignOut(e)}>
        <img src="/assets/icons/logout.svg" alt="logout" />
        <p className="small-medium lg:base-medium">Logout</p>
      </Button>
    </nav>
  );
};

export default LeftSidebar;
