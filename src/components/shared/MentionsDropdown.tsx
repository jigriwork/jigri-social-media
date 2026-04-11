import React from 'react';
import VerificationBadge from './VerificationBadge';

interface MentionsDropdownProps {
  isVisible: boolean;
  users: any[];
  isFetching: boolean;
  onSelect: (username: string) => void;
  onClose: () => void;
}

const MentionsDropdown = ({ isVisible, users, isFetching, onSelect }: MentionsDropdownProps) => {
  if (!isVisible) return null;

  return (
    <div className="absolute z-50 mt-1 w-64 md:w-80 bg-dark-2 border border-dark-4 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
      <div className="max-h-60 overflow-y-auto custom-scrollbar">
        {isFetching ? (
          <div className="p-4 text-center text-light-3 text-sm">Searching users...</div>
        ) : users.length === 0 ? (
          <div className="p-4 text-center text-light-3 text-sm">No users found</div>
        ) : (
          <ul className="py-1">
            {users.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  className="w-full text-left px-4 py-2 hover:bg-dark-4 flex items-center gap-3 transition-colors"
                  onClick={() => onSelect(user.username)}
                >
                  <img
                    src={user.image_url || "/assets/icons/profile-placeholder.svg"}
                    alt="avatar"
                    className="w-8 h-8 rounded-full border border-dark-4"
                  />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-light-1 font-medium truncate max-w-[120px] md:max-w-[160px]">{user.name}</span>
                      {user.is_verified && (
                        <VerificationBadge 
                          isVerified={true} 
                          badgeType={user.verification_badge_type} 
                          role={user.role} 
                          size={14}
                        />
                      )}
                    </div>
                    <span className="text-light-3 text-xs">@{user.username}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MentionsDropdown;
