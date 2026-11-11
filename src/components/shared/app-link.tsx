import { Link, NavLink, type LinkProps, type NavLinkProps } from 'react-router'

/** A router link that uses the View Transitions API where the browser supports it. */
export function AppLink(props: LinkProps) {
  return <Link viewTransition {...props} />
}

export function AppNavLink(props: NavLinkProps) {
  return <NavLink viewTransition {...props} />
}
