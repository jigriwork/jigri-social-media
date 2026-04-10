import clsx from 'clsx'

type VerificationBadgeType = 'verified' | 'official' | null | undefined

type VerificationBadgeProps = {
  isVerified?: boolean | null
  badgeType?: VerificationBadgeType
  role?: string | null
  size?: number
  className?: string
  titlePrefix?: string
}

const LABEL_BY_TYPE: Record<'verified' | 'official', string> = {
  verified: 'Verified',
  official: 'Official',
}

function ImageBadge({
  size,
  className,
  title,
  src,
  alt,
}: {
  size: number
  className?: string
  title: string
  src: string
  alt: string
}) {
  return (
    <img
      src={src}
      alt={alt}
      title={title}
      width={size}
      height={size}
      className={clsx('inline-block shrink-0', className)}
    />
  )
}

export default function VerificationBadge({
  isVerified,
  badgeType,
  role,
  size = 14,
  className,
  titlePrefix,
}: VerificationBadgeProps) {
  if (role === 'super_admin' || role === 'admin') {
    return (
      <ImageBadge
        size={size}
        className={className}
        title={titlePrefix ? `${titlePrefix} Admin verified` : 'Admin verified'}
        src="/assets/icons/adminverification.svg"
        alt="Admin verified"
      />
    )
  }

  if (role === 'moderator') {
    return (
      <ImageBadge
        size={size}
        className={className}
        title={titlePrefix ? `${titlePrefix} Team member` : 'Team member'}
        src="/assets/icons/teamverification.svg"
        alt="Team member"
      />
    )
  }

  if (!isVerified) return null

  const resolvedType = badgeType === 'official' ? 'official' : 'verified'
  const label = LABEL_BY_TYPE[resolvedType]

  if (resolvedType === 'official') {
    return (
      <ImageBadge
        size={size}
        className={className}
        title={titlePrefix ? `${titlePrefix} ${label}` : label}
        src="/assets/icons/officialverified.svg"
        alt={label}
      />
    )
  }

  return (
    <ImageBadge
      size={size}
      className={className}
      title={titlePrefix ? `${titlePrefix} ${label}` : label}
      src="/assets/icons/verified.svg"
      alt={label}
    />
  )
}
