import clsx from 'clsx'

type VerificationBadgeType = 'verified' | 'official' | null | undefined

type VerificationBadgeProps = {
  isVerified?: boolean | null
  badgeType?: VerificationBadgeType
  size?: number
  className?: string
  titlePrefix?: string
}

const LABEL_BY_TYPE: Record<'verified' | 'official', string> = {
  verified: 'Verified',
  official: 'Official',
}

export default function VerificationBadge({
  isVerified,
  badgeType,
  size = 14,
  className,
  titlePrefix,
}: VerificationBadgeProps) {
  if (!isVerified) return null

  const resolvedType = badgeType === 'official' ? 'official' : 'verified'
  const label = LABEL_BY_TYPE[resolvedType]

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
