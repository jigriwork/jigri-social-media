"use client";

import { useStoryRingUsers } from "@/hooks/useStoryRingUsers";
import VerificationBadge from "./VerificationBadge";

type UserAvatarProps = {
  user: {
    id: string;
    image_url?: string;
    name?: string;
    is_verified?: boolean;
    verification_badge_type?: any;
    role?: string;
  };
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showRing?: boolean;
  showBadge?: boolean;
  className?: string;
};

const SIZES = {
  xs: { box: "w-6 h-6", ringPadding: "p-[1.5px]", badge: 8 },
  sm: { box: "w-8 h-8", ringPadding: "p-[2px]", badge: 10 },
  md: { box: "w-10 h-10", ringPadding: "p-[2.5px]", badge: 12 },
  lg: { box: "w-12 h-12", ringPadding: "p-[3px]", badge: 14 },
  xl: { box: "w-20 h-20 md:w-28 md:h-28", ringPadding: "p-[4px]", badge: 18 },
};

const UserAvatar = ({
  user,
  size = "md",
  showRing = true,
  showBadge = false,
  className = "",
}: UserAvatarProps) => {
  const { hasActiveStory } = useStoryRingUsers();
  const hasStory = showRing && hasActiveStory(user.id);
  
  const sizeConfig = SIZES[size];

  const AvatarImage = (
    <img
      src={user.image_url || "/assets/icons/profile-placeholder.svg"}
      alt={user.name || "user"}
      className={`${sizeConfig.box} rounded-full object-cover border border-dark-4`}
    />
  );

  return (
    <div className={`relative shrink-0 ${className}`}>
      {hasStory ? (
        <div className={`story-ring-wrapper ${sizeConfig.ringPadding} story-ring-active cursor-pointer`}>
          <div className="story-ring-inner">
            {AvatarImage}
          </div>
        </div>
      ) : (
        AvatarImage
      )}

      {showBadge && user.is_verified && (
        <div className="absolute -bottom-1 -right-1 bg-dark-1 rounded-full p-0.5 shadow-lg">
          <VerificationBadge
            isVerified={user.is_verified}
            badgeType={user.verification_badge_type}
            role={user.role}
            size={sizeConfig.badge}
          />
        </div>
      )}
    </div>
  );
};

export default UserAvatar;
