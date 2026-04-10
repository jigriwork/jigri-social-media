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

function OfficialLikeBadge({
  size,
  className,
  title,
  symbol = '★',
}: {
  size: number
  className?: string
  title: string
  symbol?: string
}) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center justify-center rounded-full bg-amber-400 text-black font-bold shrink-0',
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(8, Math.floor(size * 0.65)) }}
    >
      {symbol}
    </span>
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
  if (role === 'super_admin') {
    return (
      <OfficialLikeBadge
        size={size}
        className={className}
        title={titlePrefix ? `${titlePrefix} Super admin` : 'Super admin'}
        symbol="★"
      />
    )
  }

  if (!isVerified) return null

  const resolvedType = badgeType === 'official' ? 'official' : 'verified'
  const label = LABEL_BY_TYPE[resolvedType]

  if (resolvedType === 'official') {
    return (
      <OfficialLikeBadge
        size={size}
        className={className}
        title={titlePrefix ? `${titlePrefix} ${label}` : label}
      />
    )
  }

  return (
    <img
      src="/assets/icons/verified.svg"
      alt={label}
      title={titlePrefix ? `${titlePrefix} ${label}` : label}
      width={size}
      height={size}
      className={clsx('inline-block shrink-0', className)}
    />
  )
}
