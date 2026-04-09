import Link from "next/link";
import { Button } from "../ui/button";
import { useIsFollowing, useFollowUser, useUnfollowUser } from "@/lib/react-query/queriesAndMutations";
import { useUserContext } from "@/context/SupabaseAuthContext";
import VerificationBadge from "@/components/shared/VerificationBadge";

type UserCardProps = {
  user: any; // TODO: Add proper Supabase user type
  showActivity?: boolean;
};

const getActivityLabel = (user: any) => {
  if (!user) return null;
  if (user.is_active) return "Active now";

  if (!user.last_active) return "Active recently";

  const lastActive = new Date(user.last_active).getTime();
  if (Number.isNaN(lastActive)) return "Active recently";

  const hoursAgo = (Date.now() - lastActive) / (1000 * 60 * 60);
  if (hoursAgo <= 24) return "Active recently";
  if (hoursAgo <= 24 * 7) return "Active this week";
  return "Active recently";
};

const UserCard = ({ user, showActivity = true }: UserCardProps) => {
  const { user: currentUser } = useUserContext();
  const { data: isCurrentlyFollowing, isLoading: isFollowingLoading } = useIsFollowing(user.id);
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();
  const activityLabel = getActivityLabel(user);
  
  const handleFollowToggle = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation when clicking the button
    e.stopPropagation();
    
    if (isCurrentlyFollowing) {
      unfollowMutation.mutate(user.id);
    } else {
      followMutation.mutate(user.id);
    }
  };

  const isOwnProfile = currentUser?.id === user.id;

  return (
    <Link href={`/profile/${user.id}`} className="user-card">
      <img
        src={user.image_url || "/assets/icons/profile-placeholder.svg"}
        alt="creator"
        className="rounded-full w-14 h-14"
      />

      <div className="flex-center flex-col gap-1">
        <div className="flex items-center gap-1 max-w-full">
          <p className="base-medium text-light-1 text-center line-clamp-1">
            {user.name}
          </p>
          <VerificationBadge
            isVerified={user.is_verified}
            badgeType={user.verification_badge_type}
            size={14}
          />
        </div>
        <p className="small-regular text-light-3 text-center line-clamp-1">
          @{user.username}
        </p>
        {showActivity && activityLabel && (
          <p className="text-[11px] text-primary-400 text-center">{activityLabel}</p>
        )}
      </div>

      {!isOwnProfile && (
        <Button 
          type="button" 
          size="sm" 
          className={`px-5 ${
            isCurrentlyFollowing 
              ? "bg-dark-4 hover:bg-dark-3 text-light-1" 
              : "shad-button_primary"
          }`}
          onClick={handleFollowToggle}
          disabled={followMutation.isPending || unfollowMutation.isPending || isFollowingLoading}
        >
          {followMutation.isPending || unfollowMutation.isPending 
            ? "Loading..." 
            : isCurrentlyFollowing 
              ? "Following" 
              : "Follow"
          }
        </Button>
      )}
    </Link>
  );
};

export default UserCard;
