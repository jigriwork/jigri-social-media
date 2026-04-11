'use client'

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { User as SupabaseUser } from '@supabase/supabase-js'
import { createClient } from '../lib/supabase/client'
import { getCurrentUser, User } from '../lib/supabase/api'

interface AuthContextType {
  user: User | null
  supabaseUser: SupabaseUser | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: React.Dispatch<React.SetStateAction<User | null>>
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>
  checkAuthUser: () => Promise<boolean>
}

const INITIAL_STATE: AuthContextType = {
  user: null,
  supabaseUser: null,
  isLoading: false,
  isAuthenticated: false,
  setUser: () => { },
  setIsAuthenticated: () => { },
  checkAuthUser: async () => false as boolean,
}

const AuthContext = createContext<AuthContextType>(INITIAL_STATE)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Use refs to always have current state values in event handlers
  const userRef = useRef<User | null>(null)
  const isAuthenticatedRef = useRef(false)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Keep refs in sync with state
  useEffect(() => {
    userRef.current = user
    isAuthenticatedRef.current = isAuthenticated
  }, [user, isAuthenticated])

  // Add a safety timeout to prevent infinite loading
  useEffect(() => {
    if (isLoading) {
      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }

      // Set a timeout to force loading to false after 8 seconds
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('Auth loading timeout reached, forcing loading to false')
        setIsLoading(false)
        // Also ensure we try to recover the auth state
        const recoverAuthState = async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
              console.log('Timeout recovery: Session exists, updating state...')
              setSupabaseUser(session.user)
              const currentAccount = await getCurrentUser()
              if (currentAccount) {
                setUser(currentAccount)
                setIsAuthenticated(true)
                console.log('Timeout recovery: Auth state restored successfully')
              }
            }
          } catch (error) {
            console.error('Timeout recovery failed:', error)
          }
        }
        recoverAuthState()
      }, 8000) // 8 second timeout
    } else {
      // Clear timeout when not loading
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
    }
  }, [isLoading])

  const supabase = createClient()

  const clearCachedAuth = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jigri_user')
      localStorage.removeItem('jigri_auth')
    }
  }

  const cacheAuthenticatedUser = (currentAccount: User) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jigri_user', JSON.stringify(currentAccount))
      localStorage.setItem('jigri_auth', 'true')
    }
  }

  const applyAuthenticatedUser = (currentAccount: User, sessionUser?: SupabaseUser | null) => {
    setUser(currentAccount)
    setIsAuthenticated(true)
    if (sessionUser) {
      setSupabaseUser(sessionUser)
    }
    cacheAuthenticatedUser(currentAccount)
  }

  const clearAuthState = () => {
    setSupabaseUser(null)
    setUser(null)
    setIsAuthenticated(false)
    clearCachedAuth()
  }

  const restoreCachedUserIfMatchesSession = (sessionUser?: SupabaseUser | null) => {
    if (typeof window === 'undefined') return false

    const cachedUser = localStorage.getItem('jigri_user')
    const cachedAuth = localStorage.getItem('jigri_auth')

    if (!cachedUser || cachedAuth !== 'true' || !sessionUser?.id) {
      return false
    }

    try {
      const parsedUser = JSON.parse(cachedUser)
      if (parsedUser?.id !== sessionUser.id) {
        console.warn('Cached auth user does not match active session. Clearing stale cache.')
        clearCachedAuth()
        return false
      }

      setSupabaseUser(sessionUser)
      setUser(parsedUser)
      setIsAuthenticated(true)
      return true
    } catch (error) {
      console.error('Error parsing cached user:', error)
      clearCachedAuth()
      return false
    }
  }

  // Initialize from localStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cachedUser = localStorage.getItem('jigri_user')
      const cachedAuth = localStorage.getItem('jigri_auth')

      if (cachedUser && cachedAuth === 'true') {
        try {
          const userData = JSON.parse(cachedUser)
          setUser(userData)
          setIsAuthenticated(true)
        } catch (error) {
          console.error('Error parsing cached user:', error)
          clearCachedAuth()
        }
      }
    }
  }, [])

  const checkAuthUser = async () => {
    setIsLoading(true)
    try {
      const currentAccount = await getCurrentUser()
      if (currentAccount) {
        const { data: { user: sessionUser } } = await supabase.auth.getUser()
        applyAuthenticatedUser(currentAccount, sessionUser)
        return true
      } else {
        // Only clear user data if we're sure there's no session
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          clearAuthState()
        }
      }
      return false
    } catch (error) {
      // Only log non-session related errors
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes('session_missing') && !errorMessage.includes('Auth session missing')) {
        console.error('Auth check error:', error)
      }
      // Don't clear user data on error - might be temporary network issue
      // But ensure loading state is cleared
      return false
    } finally {
      // Always ensure loading is set to false
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession()

        if (!mounted) return

        if (session?.user) {
          setSupabaseUser(session.user)
          await checkAuthUser()
        } else {
          clearAuthState()
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        console.log('Auth state changed:', event, session?.user?.id)

        if (event === 'SIGNED_IN') {
          if (session?.user) {
            setSupabaseUser(session.user)
            if (restoreCachedUserIfMatchesSession(session.user)) {
              setIsLoading(false)
            } else {
              console.log('Fetching fresh signed-in user data')
              await checkAuthUser()
            }
          }
        } else if (event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            setSupabaseUser(session.user)
            // Token refresh should never show loading
            try {
              const currentAccount = await getCurrentUser()
              if (currentAccount) {
                applyAuthenticatedUser(currentAccount, session.user)
              }
            } catch (error) {
              console.error('Token refresh error:', error)
            }
          }
        } else if (event === 'SIGNED_OUT') {
          clearAuthState()
          setIsLoading(false)
        }
        // For other events, don't automatically clear state
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Re-check auth when window regains focus
  useEffect(() => {
    let refreshTimeout: NodeJS.Timeout

    const handleFocus = async () => {
      clearTimeout(refreshTimeout)
      refreshTimeout = setTimeout(async () => {
        console.log('Window focused, checking auth state...')
        try {
          // Check if we have a valid session first
          const { data: { session } } = await supabase.auth.getSession()

          if (session?.user) {
            // If we have a session but no user data, refresh
            if (!userRef.current?.id || !isAuthenticatedRef.current) {
              console.log('Session exists but user data missing, refreshing...')
              await checkAuthUser()
            } else {
              // Silent refresh for existing user
              console.log('User already exists, silent refresh...')
              const currentAccount = await getCurrentUser()
              if (currentAccount) {
                applyAuthenticatedUser(currentAccount, session.user)
              }
            }
          } else {
            // No session - check if we have cached data that needs to be cleared
            if (userRef.current?.id || isAuthenticatedRef.current) {
              console.log('No session but user data exists, clearing...')
              clearAuthState()
              setIsLoading(false)
            }
          }
        } catch (error) {
          console.error('Focus auth refresh error:', error)
          // Don't clear user data on error - might be temporary network issue
        }
      }, 100) // Debounce by 100ms
    }

    const handleVisibilityChange = async () => {
      clearTimeout(refreshTimeout)
      if (!document.hidden) {
        refreshTimeout = setTimeout(async () => {
          console.log('Tab became visible, checking auth state...')
          try {
            // Check if we have a valid session first
            const { data: { session } } = await supabase.auth.getSession()

            if (session?.user) {
              // If we have a session but no user data, refresh
              if (!userRef.current?.id || !isAuthenticatedRef.current) {
                console.log('Session exists but user data missing, refreshing...')
                await checkAuthUser()
              } else {
                // Silent refresh for existing user
                console.log('User already exists, silent refresh...')
                const currentAccount = await getCurrentUser()
                if (currentAccount) {
                  applyAuthenticatedUser(currentAccount, session.user)
                }
              }
            } else {
              // No session - check if we have cached data that needs to be cleared
              if (userRef.current?.id || isAuthenticatedRef.current) {
                console.log('No session but user data exists, clearing...')
                clearAuthState()
                setIsLoading(false)
              }
            }
          } catch (error) {
            console.error('Visibility auth refresh error:', error)
            // Don't clear user data on error - might be temporary network issue
          }
        }, 100) // Debounce by 100ms
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimeout(refreshTimeout)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, []) // No dependencies needed since we're using refs

  const value = {
    user,
    supabaseUser,
    setUser,
    isLoading,
    isAuthenticated,
    setIsAuthenticated,
    checkAuthUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useUserContext = () => useContext(AuthContext)
