import React, { useMemo } from 'react';
import Link from 'next/link';
import { useGetMentionedUsers } from '@/lib/react-query/queriesAndMutations';
import VerificationBadge from './VerificationBadge';

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

const LinkifiedText = ({ text, className = "" }: LinkifiedTextProps) => {
  // Regular expression to detect URLs - improved to handle more cases
  const urlRegex = /(https?:\/\/(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?)|(?:www\.(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?)|(?:(?:[a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z]{2,}(?::[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?)/g;
  const tokenRegex = /(https?:\/\/(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?)|(?:www\.(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?)|(?:(?:[a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z]{2,}(?::[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?)|(@[a-zA-Z0-9_\.]+)|(#(?:[\p{L}0-9_\.]+))/gu;
  
  // Extract all unique usernames mentioned in the text
  const mentionedUsernames = useMemo(() => {
    if (!text) return [];
    const matches = text.match(/@[a-zA-Z0-9_\.]+/g) || [];
    return Array.from(new Set(matches.map(m => m.slice(1).toLowerCase())));
  }, [text]);

  // Fetch their verification statuses in one bulk query
  const { data: mentionedUsers } = useGetMentionedUsers(mentionedUsernames);
  
  if (!text) return <p className={className}></p>;
  
  const parts = text.split(tokenRegex);
  
  return (
    <p className={className}>
      {parts.map((part, index) => {
        if (!part) return null;
        
        // Check if this part is a URL
        if (part.match(urlRegex)) {
          let href = part;
          
          // Add https:// if the URL doesn't have a protocol
          if (!part.startsWith('http://') && !part.startsWith('https://')) {
            href = `https://${part}`;
          }
          
          return (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-500 hover:text-primary-600 underline transition-colors"
              onClick={(e) => e.stopPropagation()} // Prevent any parent click handlers
            >
              {part}
            </a>
          );
        }

        if (part.startsWith('@') && part.length > 1) {
          const username = part.slice(1);
          // Look up if user is in our fetched mentions dictionary
          const userMeta = mentionedUsers?.find((u: any) => u.username.toLowerCase() === username.toLowerCase());
          
          return (
            <Link
              key={index}
              href={`/profile/username/${encodeURIComponent(username)}`}
              className="text-primary-500 hover:text-primary-600 inline-flex items-center align-middle gap-0.5 transition-colors font-medium px-0.5 bg-primary-500/10 rounded-md"
              title={userMeta ? userMeta.role : 'User'}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="truncate max-w-[150px]">{part}</span>
              {userMeta?.is_verified && (
                <VerificationBadge 
                  isVerified={true} 
                  badgeType={userMeta.verification_badge_type} 
                  role={userMeta.role} 
                  size={14}
                />
              )}
            </Link>
          );
        }

        if (part.startsWith('#') && part.length > 1) {
          return (
            <Link
              key={index}
              href={`/explore?search=${encodeURIComponent(part)}`}
              className="text-primary-500 hover:text-primary-600 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }
        
        // Split by line breaks and render with <br> tags
        return part.split('\n').map((line, lineIndex, array) => (
          <React.Fragment key={`${index}-${lineIndex}`}>
            {line}
            {lineIndex < array.length - 1 && <br />}
          </React.Fragment>
        ));
      })}
    </p>
  );
};

export default LinkifiedText;
