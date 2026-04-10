import React from 'react';
import Link from 'next/link';

interface LinkifiedTextProps {
  text: string;
  className?: string;
}

const LinkifiedText = ({ text, className = "" }: LinkifiedTextProps) => {
  // Regular expression to detect URLs - improved to handle more cases
  const urlRegex = /(https?:\/\/(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?)|(?:www\.(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?)|(?:(?:[a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z]{2,}(?::[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?)/g;
  const tokenRegex = /(https?:\/\/(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?)|(?:www\.(?:[-\w.])+(?::[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?)|(?:(?:[a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z]{2,}(?::[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?)|(@[a-zA-Z0-9_\.]+)|(#(?:[\p{L}0-9_\.]+))/gu;
  
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
          return (
            <Link
              key={index}
              href={`/profile/username/${encodeURIComponent(username)}`}
              className="text-primary-500 hover:text-primary-600 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
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
